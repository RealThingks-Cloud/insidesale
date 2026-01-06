import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailAttachment {
  name: string;
  contentType: string;
  contentBytes: string; // Base64 encoded
}

interface EmailRequest {
  to: string;
  subject: string;
  body: string;
  toName?: string;
  from: string;
  attachments?: EmailAttachment[];
  entityType?: string; // 'lead', 'contact', 'account'
  entityId?: string;
}

async function getAccessToken(): Promise<string> {
  // Use email-specific Azure credentials
  const tenantId = Deno.env.get("AZURE_EMAIL_TENANT_ID");
  const clientId = Deno.env.get("AZURE_EMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("AZURE_EMAIL_CLIENT_SECRET");

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Azure email credentials not configured. Please set AZURE_EMAIL_TENANT_ID, AZURE_EMAIL_CLIENT_ID, and AZURE_EMAIL_CLIENT_SECRET.");
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);
  params.append("scope", "https://graph.microsoft.com/.default");
  params.append("grant_type", "client_credentials");

  console.log("Requesting access token from Azure AD...");

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to get access token:", errorText);
    throw new Error(`Failed to get access token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  console.log("Successfully obtained access token");
  return data.access_token as string;
}

// Rewrite links in HTML body for click tracking
function rewriteLinksForTracking(htmlBody: string, emailHistoryId: string, supabaseUrl: string): string {
  const clickTrackingBaseUrl = `${supabaseUrl}/functions/v1/track-email-click`;
  
  // Match href attributes in anchor tags
  const linkRegex = /<a\s+([^>]*?)href=["']([^"']+)["']([^>]*)>/gi;
  
  return htmlBody.replace(linkRegex, (match, before, url, after) => {
    // Skip tracking for mailto: links, tel: links, and anchor links
    if (url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('#')) {
      return match;
    }
    
    // Skip if it's already a tracking URL
    if (url.includes('track-email-click')) {
      return match;
    }
    
    const encodedUrl = encodeURIComponent(url);
    const trackingUrl = `${clickTrackingBaseUrl}?id=${emailHistoryId}&url=${encodedUrl}`;
    
    return `<a ${before}href="${trackingUrl}"${after}>`;
  });
}

async function sendEmail(accessToken: string, emailRequest: EmailRequest, emailHistoryId: string): Promise<void> {
  const graphUrl = `https://graph.microsoft.com/v1.0/users/${emailRequest.from}/sendMail`;

  // Build attachments array for Microsoft Graph API
  const attachments = emailRequest.attachments?.map(att => ({
    "@odata.type": "#microsoft.graph.fileAttachment",
    name: att.name,
    contentType: att.contentType,
    contentBytes: att.contentBytes,
  })) || [];

  // Generate tracking pixel URL
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const trackingPixelUrl = `${supabaseUrl}/functions/v1/track-email-open?id=${emailHistoryId}`;
  
  // Rewrite links for click tracking
  const bodyWithClickTracking = rewriteLinksForTracking(emailRequest.body, emailHistoryId, supabaseUrl);
  
  // Embed tracking pixel in email body (append to HTML content)
  const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
  const bodyWithTracking = bodyWithClickTracking + trackingPixel;

  console.log(`Rewritten ${(emailRequest.body.match(/<a\s+[^>]*href=/gi) || []).length} link(s) for click tracking`);

  const emailPayload: any = {
    message: {
      subject: emailRequest.subject,
      body: {
        contentType: "HTML",
        content: bodyWithTracking,
      },
      toRecipients: [
        {
          emailAddress: {
            address: emailRequest.to,
            name: emailRequest.toName || emailRequest.to,
          },
        },
      ],
    },
    saveToSentItems: true,
  };

  // Add attachments if present
  if (attachments.length > 0) {
    emailPayload.message.attachments = attachments;
    console.log(`Adding ${attachments.length} attachment(s) to email`);
  }

  console.log(`Sending email to ${emailRequest.to} with tracking pixel and click tracking...`);

  const response = await fetch(graphUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emailPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to send email:", errorText);
    throw new Error(`Failed to send email: ${response.status} ${errorText}`);
  }

  console.log("Email sent successfully with tracking pixel and click tracking embedded");
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, body, toName, from, attachments, entityType, entityId }: EmailRequest = await req.json();

    if (!to || !subject || !from) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, from" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Processing email request from ${from} to: ${to}${attachments?.length ? ` with ${attachments.length} attachment(s)` : ''}`);

    // Create Supabase client for storing email history
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the user ID from the authorization header
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    // Create email history record first to get the ID for tracking
    const emailHistoryData: any = {
      recipient_email: to,
      recipient_name: toName || to,
      sender_email: from,
      subject: subject,
      body: body,
      status: "sent",
      sent_by: userId,
    };

    // Add entity references if provided
    if (entityType === "lead" && entityId) {
      emailHistoryData.lead_id = entityId;
    } else if (entityType === "contact" && entityId) {
      emailHistoryData.contact_id = entityId;
    } else if (entityType === "account" && entityId) {
      emailHistoryData.account_id = entityId;
    }

    const { data: emailRecord, error: insertError } = await supabase
      .from("email_history")
      .insert(emailHistoryData)
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create email history record:", insertError);
      throw new Error(`Failed to create email history: ${insertError.message}`);
    }

    console.log(`Created email history record with ID: ${emailRecord.id}`);

    // Get access token from Azure AD
    const accessToken = await getAccessToken();

    // Send email via Microsoft Graph API with tracking pixel and click tracking
    await sendEmail(accessToken, { to, subject, body, toName, from, attachments }, emailRecord.id);

    // Update email history to mark as delivered
    await supabase
      .from("email_history")
      .update({ 
        status: "delivered",
        delivered_at: new Date().toISOString()
      })
      .eq("id", emailRecord.id);

    console.log(`Email marked as delivered for record: ${emailRecord.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email sent successfully",
        emailId: emailRecord.id 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send email" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
