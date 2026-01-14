import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAccessToken(): Promise<string> {
  const tenantId = Deno.env.get("AZURE_EMAIL_TENANT_ID") || Deno.env.get("AZURE_TENANT_ID");
  const clientId = Deno.env.get("AZURE_EMAIL_CLIENT_ID") || Deno.env.get("AZURE_CLIENT_ID");
  const clientSecret = Deno.env.get("AZURE_EMAIL_CLIENT_SECRET") || Deno.env.get("AZURE_CLIENT_SECRET");

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Azure credentials not configured");
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("=".repeat(50));
  console.log("Starting Message-ID backfill process...");
  console.log("=".repeat(50));

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get access token
    let accessToken: string;
    try {
      accessToken = await getAccessToken();
      console.log("Successfully obtained Azure access token");
    } catch (tokenError) {
      console.error("Failed to get access token:", tokenError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Azure authentication failed",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get emails without message_id from the last 30 days
    const sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: emailsWithoutMsgId, error: fetchError } = await supabase
      .from('email_history')
      .select('id, sender_email, recipient_email, subject, sent_at')
      .gte('sent_at', sinceDate)
      .is('message_id', null)
      .not('status', 'eq', 'bounced')
      .order('sent_at', { ascending: false })
      .limit(100); // Process in batches

    if (fetchError) {
      console.error("Error fetching emails:", fetchError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Failed to fetch emails",
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!emailsWithoutMsgId || emailsWithoutMsgId.length === 0) {
      console.log("No emails without message_id found");
      return new Response(JSON.stringify({
        success: true,
        message: "No emails need message_id backfill",
        backfilled: 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${emailsWithoutMsgId.length} emails without message_id`);

    // Group by sender
    const emailsBySender = new Map<string, typeof emailsWithoutMsgId>();
    for (const email of emailsWithoutMsgId) {
      const existing = emailsBySender.get(email.sender_email) || [];
      existing.push(email);
      emailsBySender.set(email.sender_email, existing);
    }

    let backfilledCount = 0;
    const backfilledIds: string[] = [];

    for (const [senderEmail, emails] of emailsBySender.entries()) {
      console.log(`Processing ${emails.length} emails for sender: ${senderEmail}`);
      
      try {
        // Fetch sent items from Microsoft Graph (last 30 days)
        const searchUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}/mailFolders/SentItems/messages?$filter=sentDateTime ge ${sinceDate}&$select=internetMessageId,subject,sentDateTime,toRecipients&$top=200&$orderby=sentDateTime desc`;

        const response = await fetch(searchUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          console.error(`Failed to fetch sent items for ${senderEmail}: ${response.status}`);
          continue;
        }

        const sentData = await response.json();
        const sentMessages = sentData.value || [];
        console.log(`Found ${sentMessages.length} sent messages in mailbox`);

        // Try to match each email without message_id
        for (const email of emails) {
          const emailSentTime = new Date(email.sent_at).getTime();
          
          // Find matching sent message by recipient + time proximity
          for (const msg of sentMessages) {
            const msgSentTime = new Date(msg.sentDateTime).getTime();
            const timeDiff = Math.abs(msgSentTime - emailSentTime);
            
            // Must be within 5 minutes of each other
            if (timeDiff > 5 * 60 * 1000) continue;
            
            // Check recipient match
            const msgRecipients = msg.toRecipients || [];
            const recipientMatch = msgRecipients.some((r: any) => 
              r.emailAddress?.address?.toLowerCase() === email.recipient_email.toLowerCase()
            );
            
            if (recipientMatch) {
              // Found a match!
              console.log(`✅ Matched email ${email.id} to message_id: ${msg.internetMessageId}`);
              
              const { error: updateError } = await supabase
                .from('email_history')
                .update({ message_id: msg.internetMessageId })
                .eq('id', email.id);
              
              if (updateError) {
                console.error(`Failed to update email ${email.id}:`, updateError);
              } else {
                backfilledCount++;
                backfilledIds.push(email.id);
              }
              break;
            }
          }
        }
      } catch (senderError) {
        console.error(`Error processing sender ${senderEmail}:`, senderError);
      }
    }

    const processingTime = Date.now() - startTime;

    console.log("=".repeat(50));
    console.log(`Backfill complete in ${processingTime}ms. Updated ${backfilledCount} email(s).`);
    console.log("=".repeat(50));

    return new Response(JSON.stringify({
      success: true,
      emailsChecked: emailsWithoutMsgId.length,
      backfilled: backfilledCount,
      backfilledIds,
      processingTimeMs: processingTime,
      message: backfilledCount > 0 
        ? `Backfilled message_id for ${backfilledCount} email(s)` 
        : 'No matches found for emails without message_id',
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error in backfill process:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
