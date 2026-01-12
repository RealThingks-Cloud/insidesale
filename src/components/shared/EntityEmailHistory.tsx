import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Mail,
  Eye,
  Clock,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Send,
  Users,
  ChevronDown,
  MailX,
  Info,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface EmailHistoryItem {
  id: string;
  subject: string;
  recipient_email: string;
  recipient_name: string | null;
  sender_email: string;
  body: string | null;
  status: string;
  sent_at: string;
  opened_at: string | null;
  open_count: number | null;
  unique_opens: number | null;
  bounce_type: string | null;
  bounce_reason: string | null;
  bounced_at: string | null;
  is_valid_open: boolean | null;
}

interface EntityEmailHistoryProps {
  entityType: 'contact' | 'lead' | 'account';
  entityId: string;
}

// Helper function to get user-friendly bounce explanation
const getBounceExplanation = (bounceType: string | null, bounceReason: string | null) => {
  if (bounceType === 'hard') {
    return {
      title: "Delivery Failed",
      subtitle: "Email address doesn't exist",
      description: "This email could not be delivered because the recipient's email address was not found or is invalid. Please verify the email address and try again with a correct one.",
      Icon: MailX,
      severity: 'error' as const,
    };
  }
  if (bounceType === 'soft') {
    return {
      title: "Delivery Delayed",
      subtitle: "Temporary delivery issue",
      description: "This email couldn't be delivered due to a temporary issue (e.g., full mailbox, server busy). The system may retry automatically.",
      Icon: AlertTriangle,
      severity: 'warning' as const,
    };
  }
  return {
    title: "Delivery Failed",
    subtitle: "Unable to deliver email",
    description: "This email could not be delivered to the recipient. The email address may be invalid or the recipient's server rejected the message.",
    Icon: XCircle,
    severity: 'error' as const,
  };
};

// Helper function to clean and parse technical bounce reasons
const cleanBounceReason = (reason: string | null): { summary: string; technical: string | null } => {
  if (!reason) return { summary: '', technical: null };
  
  // Strip HTML tags
  let cleaned = reason.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Common patterns to extract meaningful message
  const patterns = [
    /The email account that you tried to reach does not exist/i,
    /address rejected/i,
    /user unknown/i,
    /mailbox not found/i,
    /recipient rejected/i,
    /no such user/i,
    /invalid recipient/i,
    /delivery.*failed/i,
    /undeliverable/i,
  ];
  
  // Check if it matches any pattern for a cleaner summary
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      return {
        summary: "The recipient's email address was not found or is invalid.",
        technical: cleaned,
      };
    }
  }
  
  // If contains error codes, provide a generic summary
  if (/^\d{3}\s+\d+\.\d+\.\d+/.test(cleaned) || /error code/i.test(cleaned)) {
    return {
      summary: "The email server rejected the message.",
      technical: cleaned,
    };
  }
  
  // Return first sentence if reasonable length
  const firstSentence = cleaned.split(/[.!?]/)[0];
  if (firstSentence && firstSentence.length > 10 && firstSentence.length < 200) {
    return {
      summary: firstSentence + '.',
      technical: cleaned !== firstSentence + '.' ? cleaned : null,
    };
  }
  
  return { summary: cleaned, technical: null };
};

export const EntityEmailHistory = ({ entityType, entityId }: EntityEmailHistoryProps) => {
  const [emails, setEmails] = useState<EmailHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<EmailHistoryItem | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('email_history')
        .select('id, subject, recipient_email, recipient_name, sender_email, body, status, sent_at, opened_at, open_count, unique_opens, bounce_type, bounce_reason, bounced_at, is_valid_open')
        .order('sent_at', { ascending: false });

      if (entityType === 'contact') {
        query = query.eq('contact_id', entityId);
      } else if (entityType === 'lead') {
        query = query.eq('lead_id', entityId);
      } else if (entityType === 'account') {
        query = query.eq('account_id', entityId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEmails((data as EmailHistoryItem[]) || []);
    } catch (error) {
      console.error('Error fetching email history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (entityId) {
      fetchEmails();
    }
  }, [entityType, entityId]);

  // Reset technical details view when dialog closes
  useEffect(() => {
    if (!selectedEmail) {
      setShowTechnicalDetails(false);
    }
  }, [selectedEmail]);

  const getStatusBadge = (email: EmailHistoryItem) => {
    const { status, bounce_type } = email;

    if (status === 'bounced' || bounce_type) {
      const bounceInfo = getBounceExplanation(bounce_type, null);
      return (
        <Badge className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20">
          <XCircle className="h-3 w-3 mr-1" />
          {bounceInfo.title}
        </Badge>
      );
    }

    if (status === 'opened') {
      if (email.is_valid_open === false) {
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Suspicious
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Opens may be from email scanners, not real users</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <Eye className="h-3 w-3 mr-1" />
          Opened
        </Badge>
      );
    }

    if (status === 'delivered') {
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Delivered
        </Badge>
      );
    }

    return (
      <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
        <Send className="h-3 w-3 mr-1" />
        Sent
      </Badge>
    );
  };

  const getOpenCountDisplay = (email: EmailHistoryItem) => {
    if (email.status === 'bounced' || email.bounce_type) {
      const bounceInfo = getBounceExplanation(email.bounce_type, null);
      return (
        <span className="flex items-center gap-1 text-destructive">
          <XCircle className="h-3 w-3" />
          {bounceInfo.title}
        </span>
      );
    }

    const uniqueOpens = email.unique_opens || 0;
    const totalOpens = email.open_count || 0;

    if (totalOpens === 0) {
      return (
        <span className="flex items-center gap-1">
          <Eye className="h-3 w-3" />
          0 opens
        </span>
      );
    }

    if (email.is_valid_open === false) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <span className="flex items-center gap-1 text-yellow-600">
                <AlertTriangle className="h-3 w-3" />
                {totalOpens} (suspicious)
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>These opens may be from automated email scanners</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {uniqueOpens > 0 ? `${uniqueOpens} unique` : `${totalOpens} opens`}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Total opens: {totalOpens}</p>
            <p>Unique opens: {uniqueOpens}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Mail className="h-10 w-10 mb-2 opacity-50" />
        <p className="text-sm">No emails sent to this {entityType} yet</p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-[300px] pr-4">
        <div className="space-y-3">
          {emails.map((email) => (
            <Card 
              key={email.id} 
              className={`cursor-pointer hover:bg-accent/50 transition-colors ${
                email.status === 'bounced' || email.bounce_type ? 'border-destructive/30' : ''
              }`}
              onClick={() => setSelectedEmail(email)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium truncate">{email.subject}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(email.sent_at), 'dd/MM/yyyy HH:mm')}
                      </span>
                      {getOpenCountDisplay(email)}
                    </div>
                  </div>
                  {getStatusBadge(email)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedEmail && (
            <div className="space-y-5">
              {/* Subject and Status */}
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subject</p>
                  <p className="text-base font-medium mt-1">{selectedEmail.subject}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status:</span>
                  {getStatusBadge(selectedEmail)}
                </div>
              </div>

              {/* From/To Grid */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">From</p>
                  <p className="text-sm mt-0.5">{selectedEmail.sender_email}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">To</p>
                  <p className="text-sm mt-0.5">{selectedEmail.recipient_name || selectedEmail.recipient_email}</p>
                </div>
              </div>

              {/* Dates Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Sent</p>
                  <p className="text-sm mt-0.5">{format(new Date(selectedEmail.sent_at), 'dd/MM/yyyy HH:mm')}</p>
                </div>
                {selectedEmail.bounced_at && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Failed</p>
                    <p className="text-sm mt-0.5 text-destructive">{format(new Date(selectedEmail.bounced_at), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                )}
                {selectedEmail.opened_at && !selectedEmail.bounce_type && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">First Opened</p>
                    <p className="text-sm mt-0.5">{format(new Date(selectedEmail.opened_at), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                )}
              </div>

              {/* Bounce Information - User Friendly */}
              {selectedEmail.bounce_type && (() => {
                const bounceInfo = getBounceExplanation(selectedEmail.bounce_type, selectedEmail.bounce_reason);
                const cleanedReason = cleanBounceReason(selectedEmail.bounce_reason);
                const BounceIcon = bounceInfo.Icon;
                
                return (
                  <div className={`rounded-lg border p-4 ${
                    bounceInfo.severity === 'error' 
                      ? 'bg-destructive/5 border-destructive/20' 
                      : 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800/30'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${
                        bounceInfo.severity === 'error'
                          ? 'bg-destructive/10'
                          : 'bg-yellow-100 dark:bg-yellow-900/30'
                      }`}>
                        <BounceIcon className={`h-5 w-5 ${
                          bounceInfo.severity === 'error'
                            ? 'text-destructive'
                            : 'text-yellow-600 dark:text-yellow-400'
                        }`} />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div>
                          <h4 className={`font-semibold ${
                            bounceInfo.severity === 'error'
                              ? 'text-destructive'
                              : 'text-yellow-700 dark:text-yellow-300'
                          }`}>
                            {bounceInfo.title}
                          </h4>
                          <p className={`text-sm ${
                            bounceInfo.severity === 'error'
                              ? 'text-destructive/80'
                              : 'text-yellow-600 dark:text-yellow-400'
                          }`}>
                            {bounceInfo.subtitle}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {bounceInfo.description}
                        </p>
                        
                        {/* Technical Details Collapsible */}
                        {cleanedReason.technical && (
                          <Collapsible open={showTechnicalDetails} onOpenChange={setShowTechnicalDetails}>
                            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2">
                              <ChevronDown className={`h-3 w-3 transition-transform ${showTechnicalDetails ? 'rotate-180' : ''}`} />
                              <Info className="h-3 w-3" />
                              View technical details
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2">
                              <div className="text-xs font-mono bg-muted/50 rounded p-2 text-muted-foreground break-all">
                                {cleanedReason.technical}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Open Stats - Only show for non-bounced emails */}
              {!selectedEmail.bounce_type && (
                <div className="flex justify-center gap-4">
                  <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                      <Eye className="h-8 w-8 text-blue-500" />
                      <div>
                        <p className="text-2xl font-bold">{selectedEmail.open_count || 0}</p>
                        <p className="text-xs text-muted-foreground">Total Opens</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                      <Users className="h-8 w-8 text-green-500" />
                      <div>
                        <p className="text-2xl font-bold">{selectedEmail.unique_opens || 0}</p>
                        <p className="text-xs text-muted-foreground">Unique Opens</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Suspicious Activity Warning */}
              {selectedEmail.is_valid_open === false && !selectedEmail.bounce_type && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300 font-medium">
                    <AlertTriangle className="h-4 w-4" />
                    Suspicious Activity Detected
                  </div>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                    The opens for this email may be from automated email security scanners, not actual recipients.
                  </p>
                </div>
              )}

              {/* Email Body */}
              {selectedEmail.body && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Message</p>
                  <div 
                    className="border rounded-lg p-4 bg-background text-sm max-h-[200px] overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
