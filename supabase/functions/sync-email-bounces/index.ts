import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncRequest {
  fromEmail?: string;
  sinceHours?: number;
}

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

function parseNDRContent(subject: string, body: string): { recipientEmail: string | null; reason: string | null; originalSubject: string | null } {
  let recipientEmail: string | null = null;
  let reason: string | null = null;
  let originalSubject: string | null = null;

  // Extract original subject from NDR subject line
  // Common patterns: "Undeliverable: Original Subject" or "Delivery Status Notification (Failure)"
  const subjectMatch = subject.match(/Undeliverable:\s*(.+)/i);
  if (subjectMatch) {
    originalSubject = subjectMatch[1].trim();
  }

  // Extract recipient email from body
  // Common patterns in NDR bodies
  const emailPatterns = [
    /(?:To|Recipient|Address):\s*<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i,
    /couldn't be delivered to\s+<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i,
    /delivery.*failed.*<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i,
    /<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/,
  ];

  for (const pattern of emailPatterns) {
    const match = body.match(pattern);
    if (match) {
      recipientEmail = match[1].toLowerCase();
      break;
    }
  }

  // Extract bounce reason
  const reasonPatterns = [
    /(?:Remote Server returned|Diagnostic information).*?['"]?(\d{3}\s+\d\.\d\.\d+[^'"]*?)['"]?(?:\s|$)/i,
    /(550\s+\d\.\d\.\d+[^\n]*)/i,
    /(mailbox.*(?:not found|unavailable|full|disabled))/i,
    /(user.*(?:unknown|doesn't exist|not found))/i,
    /(address rejected)/i,
    /(permanent failure)/i,
  ];

  for (const pattern of reasonPatterns) {
    const match = body.match(pattern);
    if (match) {
      reason = match[1].trim().substring(0, 500); // Limit length
      break;
    }
  }

  // Default reason if we couldn't parse one
  if (!reason && (subject.toLowerCase().includes('undeliverable') || subject.toLowerCase().includes('failure'))) {
    reason = 'Email could not be delivered';
  }

  return { recipientEmail, reason, originalSubject };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { fromEmail, sinceHours = 48 }: SyncRequest = await req.json().catch(() => ({}));
    
    console.log(`Syncing bounces for ${fromEmail || 'all senders'} from last ${sinceHours} hours`);

    // Get unique sender emails from recent email history
    let senderEmails: string[] = [];
    if (fromEmail) {
      senderEmails = [fromEmail];
    } else {
      const sinceDate = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
      const { data: recentEmails } = await supabase
        .from('email_history')
        .select('sender_email')
        .gte('sent_at', sinceDate)
        .not('status', 'eq', 'bounced');
      
      if (recentEmails) {
        senderEmails = [...new Set(recentEmails.map(e => e.sender_email))];
      }
    }

    if (senderEmails.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No recent emails to check for bounces",
        bouncesFound: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getAccessToken();
    let totalBouncesFound = 0;
    const bouncedEmails: string[] = [];

    for (const senderEmail of senderEmails) {
      try {
        // Search for NDR messages in the sender's mailbox
        const searchDate = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
        const searchUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}/messages?$filter=receivedDateTime ge ${searchDate} and (contains(subject,'Undeliverable') or contains(subject,'Delivery Status') or contains(subject,'Mail Delivery Failed') or from/emailAddress/address eq 'postmaster@outlook.com' or from/emailAddress/address eq 'mailer-daemon@'))&$select=id,subject,body,receivedDateTime,from&$top=50`;

        const messagesResponse = await fetch(searchUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!messagesResponse.ok) {
          console.log(`Could not fetch messages for ${senderEmail}: ${messagesResponse.status}`);
          continue;
        }

        const messagesData = await messagesResponse.json();
        const ndrMessages = messagesData.value || [];

        console.log(`Found ${ndrMessages.length} potential NDR messages for ${senderEmail}`);

        for (const ndr of ndrMessages) {
          const { recipientEmail, reason, originalSubject } = parseNDRContent(
            ndr.subject || '',
            ndr.body?.content || ''
          );

          if (!recipientEmail) {
            console.log(`Could not parse recipient from NDR: ${ndr.subject}`);
            continue;
          }

          console.log(`Parsed bounce for ${recipientEmail}: ${reason}`);

          // Find matching email_history records
          let query = supabase
            .from('email_history')
            .select('id, contact_id, open_count, unique_opens, status')
            .eq('sender_email', senderEmail)
            .ilike('recipient_email', recipientEmail)
            .not('status', 'eq', 'bounced')
            .gte('sent_at', new Date(Date.now() - (sinceHours + 24) * 60 * 60 * 1000).toISOString());

          if (originalSubject) {
            query = query.ilike('subject', `%${originalSubject.substring(0, 50)}%`);
          }

          const { data: matchingEmails } = await query.limit(5);

          if (matchingEmails && matchingEmails.length > 0) {
            for (const email of matchingEmails) {
              // Update email as bounced
              await supabase
                .from('email_history')
                .update({
                  status: 'bounced',
                  bounce_type: 'hard',
                  bounce_reason: reason,
                  bounced_at: ndr.receivedDateTime || new Date().toISOString(),
                  open_count: 0,
                  unique_opens: 0,
                  opened_at: null,
                  is_valid_open: false,
                })
                .eq('id', email.id);

              // Correct contact engagement if needed
              if (email.contact_id && email.open_count && email.open_count > 0) {
                const { data: contact } = await supabase
                  .from('contacts')
                  .select('email_opens, engagement_score')
                  .eq('id', email.contact_id)
                  .single();

                if (contact) {
                  const newOpens = Math.max(0, (contact.email_opens || 0) - 1);
                  const newScore = Math.max(0, (contact.engagement_score || 0) - 10);
                  
                  await supabase
                    .from('contacts')
                    .update({
                      email_opens: newOpens,
                      engagement_score: newScore,
                    })
                    .eq('id', email.contact_id);
                }
              }

              totalBouncesFound++;
              bouncedEmails.push(recipientEmail);
            }
          }
        }
      } catch (senderError) {
        console.error(`Error processing sender ${senderEmail}:`, senderError);
      }
    }

    console.log(`Sync complete. Found ${totalBouncesFound} bounced emails`);

    return new Response(JSON.stringify({
      success: true,
      bouncesFound: totalBouncesFound,
      bouncedEmails: [...new Set(bouncedEmails)],
      message: totalBouncesFound > 0 
        ? `Found and marked ${totalBouncesFound} bounced email(s)` 
        : 'No new bounces detected',
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error syncing bounces:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      hint: errorMessage.includes('credentials') 
        ? 'Azure credentials may not be configured. Check AZURE_EMAIL_* secrets.'
        : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
