import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 1x1 transparent GIF pixel
const TRACKING_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

const handler = async (req: Request): Promise<Response> => {
  try {
    const url = new URL(req.url);
    const emailId = url.searchParams.get("id");

    if (!emailId) {
      console.log("No email ID provided, returning pixel only");
      return new Response(TRACKING_PIXEL, {
        headers: {
          "Content-Type": "image/gif",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      });
    }

    console.log(`Tracking email open for ID: ${emailId}`);

    // Create Supabase client with service role for updating
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch email record to get current open_count and entity references
    const { data: emailData, error: fetchError } = await supabase
      .from("email_history")
      .select("open_count, contact_id, lead_id, account_id")
      .eq("id", emailId)
      .single();

    if (fetchError) {
      console.error("Error fetching email record:", fetchError);
      return new Response(TRACKING_PIXEL, {
        headers: {
          "Content-Type": "image/gif",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      });
    }

    const currentOpenCount = emailData?.open_count || 0;
    const isFirstOpen = currentOpenCount === 0;

    // Update email history with open tracking
    const { error: updateError } = await supabase
      .from("email_history")
      .update({
        status: "opened",
        open_count: currentOpenCount + 1,
        opened_at: isFirstOpen ? new Date().toISOString() : undefined,
      })
      .eq("id", emailId);

    if (updateError) {
      console.error("Error updating email history:", updateError);
    } else {
      console.log(`Successfully tracked open for email ${emailId}, total opens: ${currentOpenCount + 1}`);
    }

    // Update contact/lead email_opens and engagement_score if this is the first open
    if (isFirstOpen && emailData) {
      if (emailData.contact_id) {
        const { data: contact } = await supabase
          .from("contacts")
          .select("email_opens, engagement_score")
          .eq("id", emailData.contact_id)
          .single();

        if (contact) {
          const newOpens = (contact.email_opens || 0) + 1;
          const newScore = Math.min((contact.engagement_score || 0) + 5, 100);
          
          await supabase
            .from("contacts")
            .update({
              email_opens: newOpens,
              engagement_score: newScore,
            })
            .eq("id", emailData.contact_id);
          
          console.log(`Updated contact ${emailData.contact_id} - opens: ${newOpens}, score: ${newScore}`);
        }
      }

      if (emailData.lead_id) {
        console.log(`Email associated with lead ${emailData.lead_id} - opened`);
      }

      if (emailData.account_id) {
        console.log(`Email associated with account ${emailData.account_id} - opened`);
      }
    }

    // Return the tracking pixel
    return new Response(TRACKING_PIXEL, {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("Error tracking email open:", error);
    // Still return the pixel even on error
    return new Response(TRACKING_PIXEL, {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  }
};

serve(handler);
