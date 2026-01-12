import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
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
  ChevronDown,
  ChevronRight,
  MailX,
  Info,
  Reply,
  Loader2,
  MessageSquare,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { EmailReplyModal } from '@/components/email/EmailReplyModal';

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
  reply_count: number | null;
  replied_at: string | null;
  last_reply_at: string | null;
  lead_id?: string | null;
  contact_id?: string | null;
  account_id?: string | null;
  thread_id?: string | null;
  parent_email_id?: string | null;
  is_reply?: boolean;
  message_id?: string | null;
}

interface EmailReply {
  id: string;
  from_email: string;
  from_name: string | null;
  received_at: string;
  body_preview: string | null;
  subject: string | null;
}

interface ThreadMessage {
  id: string;
  type: 'sent' | 'received';
  timestamp: string;
  subject: string | null;
  body: string | null;
  from_email: string;
  from_name: string | null;
  to_email: string;
  to_name: string | null;
  status?: string;
  bounce_type?: string | null;
  is_valid_open?: boolean | null;
  open_count?: number | null;
  originalEmail?: EmailHistoryItem;
  originalReply?: EmailReply;
}

interface EmailThread {
  threadId: string;
  subject: string;
  messages: ThreadMessage[];
  lastActivity: string;
  totalMessages: number;
  hasReplies: boolean;
  hasBounce: boolean;
  latestStatus: string;
}

interface EntityEmailHistoryProps {
  entityType: 'contact' | 'lead' | 'account';
  entityId: string;
}

// Helper function to get user-friendly bounce explanation
const getBounceExplanation = (bounceType: string | null) => {
  if (bounceType === 'hard') {
    return { title: "Delivery Failed", Icon: MailX, severity: 'error' as const };
  }
  if (bounceType === 'soft') {
    return { title: "Delivery Delayed", Icon: AlertTriangle, severity: 'warning' as const };
  }
  return { title: "Delivery Failed", Icon: XCircle, severity: 'error' as const };
};

export const EntityEmailHistory = ({ entityType, entityId }: EntityEmailHistoryProps) => {
  const [emails, setEmails] = useState<EmailHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [repliesMap, setRepliesMap] = useState<Record<string, EmailReply[]>>({});
  
  // Reply modal state
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [selectedEmailForReply, setSelectedEmailForReply] = useState<EmailHistoryItem | null>(null);
  const [replyToData, setReplyToData] = useState<{ from_email: string; from_name: string | null; body_preview?: string | null; received_at?: string; subject?: string | null } | undefined>(undefined);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('email_history')
        .select('id, subject, recipient_email, recipient_name, sender_email, body, status, sent_at, opened_at, open_count, unique_opens, bounce_type, bounce_reason, bounced_at, is_valid_open, reply_count, replied_at, last_reply_at, lead_id, contact_id, account_id, thread_id, parent_email_id, is_reply, message_id')
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

      // Fetch all replies for emails that have them
      const emailsWithReplies = (data || []).filter((e: EmailHistoryItem) => (e.reply_count || 0) > 0);
      if (emailsWithReplies.length > 0) {
        const { data: allReplies } = await supabase
          .from('email_replies')
          .select('id, from_email, from_name, received_at, body_preview, subject, email_history_id')
          .in('email_history_id', emailsWithReplies.map((e: EmailHistoryItem) => e.id))
          .order('received_at', { ascending: true });

        if (allReplies) {
          const grouped: Record<string, EmailReply[]> = {};
          allReplies.forEach((reply: any) => {
            if (!grouped[reply.email_history_id]) {
              grouped[reply.email_history_id] = [];
            }
            grouped[reply.email_history_id].push(reply);
          });
          setRepliesMap(grouped);
        }
      }
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

  // Real-time subscription for email status updates
  useEffect(() => {
    if (!entityId) return;

    const channel = supabase
      .channel(`email-updates-${entityType}-${entityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_history',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newEmail = payload.new as EmailHistoryItem;
            const belongsToEntity = 
              (entityType === 'lead' && newEmail.lead_id === entityId) ||
              (entityType === 'contact' && newEmail.contact_id === entityId) ||
              (entityType === 'account' && newEmail.account_id === entityId);
            
            if (belongsToEntity) {
              setEmails(prev => [newEmail, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedEmail = payload.new as EmailHistoryItem;
            setEmails(prev => prev.map(e => 
              e.id === updatedEmail.id ? { ...e, ...updatedEmail } : e
            ));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [entityType, entityId]);

  // Group emails into threads
  const threads = useMemo(() => {
    const threadMap = new Map<string, EmailHistoryItem[]>();
    
    // Group emails by thread_id (or id if no thread_id)
    emails.forEach(email => {
      const threadId = email.thread_id || email.id;
      if (!threadMap.has(threadId)) {
        threadMap.set(threadId, []);
      }
      threadMap.get(threadId)!.push(email);
    });

    // Build thread objects
    const result: EmailThread[] = [];
    
    threadMap.forEach((threadEmails, threadId) => {
      // Sort emails in thread by sent_at ascending (oldest first)
      threadEmails.sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());
      
      // Get the first (original) email for the subject
      const firstEmail = threadEmails[0];
      const subject = firstEmail.subject.replace(/^(Re:\s*)+/i, '').trim();
      
      // Build messages array combining outgoing emails and incoming replies
      const messages: ThreadMessage[] = [];
      
      threadEmails.forEach(email => {
        // Add the sent email
        messages.push({
          id: email.id,
          type: 'sent',
          timestamp: email.sent_at,
          subject: email.subject,
          body: email.body,
          from_email: email.sender_email,
          from_name: null,
          to_email: email.recipient_email,
          to_name: email.recipient_name,
          status: email.status,
          bounce_type: email.bounce_type,
          is_valid_open: email.is_valid_open,
          open_count: email.open_count,
          originalEmail: email,
        });
        
        // Add any received replies for this email
        const emailReplies = repliesMap[email.id] || [];
        emailReplies.forEach(reply => {
          messages.push({
            id: reply.id,
            type: 'received',
            timestamp: reply.received_at,
            subject: reply.subject,
            body: reply.body_preview,
            from_email: reply.from_email,
            from_name: reply.from_name,
            to_email: email.sender_email,
            to_name: null,
            originalReply: reply,
          });
        });
      });
      
      // Sort all messages by timestamp
      messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      // Determine latest status
      const lastSentEmail = [...threadEmails].reverse().find(e => !e.is_reply || !e.parent_email_id);
      const hasReplies = messages.some(m => m.type === 'received') || threadEmails.some(e => e.reply_count && e.reply_count > 0);
      const hasBounce = threadEmails.some(e => e.bounce_type);
      
      let latestStatus = 'sent';
      if (hasBounce) latestStatus = 'bounced';
      else if (hasReplies) latestStatus = 'replied';
      else if (threadEmails.some(e => e.status === 'opened')) latestStatus = 'opened';
      else if (threadEmails.some(e => e.status === 'delivered')) latestStatus = 'delivered';
      
      result.push({
        threadId,
        subject,
        messages,
        lastActivity: messages.length > 0 ? messages[messages.length - 1].timestamp : firstEmail.sent_at,
        totalMessages: messages.length,
        hasReplies,
        hasBounce,
        latestStatus,
      });
    });
    
    // Sort threads by last activity (newest first)
    result.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
    
    return result;
  }, [emails, repliesMap]);

  const toggleThread = (threadId: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  };

  const toggleMessage = (messageId: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const handleReplyToThread = (thread: EmailThread) => {
    // Get the last sent email in the thread for context
    const lastSentMessage = [...thread.messages].reverse().find(m => m.type === 'sent');
    if (lastSentMessage?.originalEmail) {
      setSelectedEmailForReply(lastSentMessage.originalEmail);
      setReplyToData(undefined);
      setShowReplyModal(true);
    }
  };

  const handleReplyToMessage = (message: ThreadMessage, thread: EmailThread) => {
    // Find the original email in the thread
    const originalEmail = thread.messages.find(m => m.type === 'sent')?.originalEmail;
    if (!originalEmail) return;

    if (message.type === 'received' && message.originalReply) {
      setSelectedEmailForReply(originalEmail);
      setReplyToData({
        from_email: message.from_email,
        from_name: message.from_name,
        body_preview: message.body,
        received_at: message.timestamp,
        subject: message.subject,
      });
    } else {
      setSelectedEmailForReply(originalEmail);
      setReplyToData(undefined);
    }
    setShowReplyModal(true);
  };

  const getStatusBadge = (status: string, bounceType?: string | null, hasReplies?: boolean) => {
    if (bounceType) {
      const bounceInfo = getBounceExplanation(bounceType);
      return (
        <Badge className="bg-destructive/10 text-destructive border-destructive/20">
          <XCircle className="h-3 w-3 mr-1" />
          {bounceInfo.title}
        </Badge>
      );
    }

    if (hasReplies || status === 'replied') {
      return (
        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
          <Reply className="h-3 w-3 mr-1" />
          Replied
        </Badge>
      );
    }

    if (status === 'opened') {
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

  const stripHtml = (html: string | null) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
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

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Mail className="h-10 w-10 mb-2 opacity-50" />
        <p className="text-sm">No emails sent to this {entityType} yet</p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-2">
          {threads.map((thread) => {
            const isExpanded = expandedThreads.has(thread.threadId);
            const isSingleMessage = thread.totalMessages === 1;
            
            return (
              <Card 
                key={thread.threadId} 
                className={`overflow-hidden transition-colors ${
                  thread.hasBounce ? 'border-destructive/30' : ''
                }`}
              >
                {/* Thread Header */}
                <div 
                  className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => toggleThread(thread.threadId)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <div className="mt-0.5">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate">{thread.subject}</span>
                          {thread.totalMessages > 1 && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {thread.totalMessages}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(thread.lastActivity), 'dd/MM/yyyy HH:mm')}
                          </span>
                          {thread.hasReplies && (
                            <span className="flex items-center gap-1 text-purple-600">
                              <Reply className="h-3 w-3" />
                              Has replies
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {getStatusBadge(thread.latestStatus, thread.hasBounce ? 'hard' : null, thread.hasReplies)}
                    </div>
                  </div>
                </div>

                {/* Expanded Thread Messages */}
                {isExpanded && (
                  <div className="border-t bg-muted/20">
                    <div className="p-2 space-y-2">
                      {thread.messages.map((message, idx) => {
                        const isMessageExpanded = expandedMessages.has(message.id);
                        const isLast = idx === thread.messages.length - 1;
                        const preview = stripHtml(message.body).substring(0, 100);
                        
                        return (
                          <div 
                            key={message.id}
                            className={`rounded-lg border transition-colors ${
                              message.type === 'sent' 
                                ? 'bg-background border-border' 
                                : 'bg-purple-50/50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800/30'
                            }`}
                          >
                            {/* Message Header (always visible) */}
                            <div 
                              className="p-3 cursor-pointer"
                              onClick={() => toggleMessage(message.id)}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className={`p-1 rounded-full shrink-0 ${
                                    message.type === 'sent' 
                                      ? 'bg-blue-100 dark:bg-blue-900/30' 
                                      : 'bg-purple-100 dark:bg-purple-900/30'
                                  }`}>
                                    {message.type === 'sent' ? (
                                      <ArrowUpRight className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                    ) : (
                                      <ArrowDownLeft className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm truncate">
                                        {message.type === 'sent' ? 'You' : (message.from_name || message.from_email)}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {message.type === 'sent' 
                                          ? `to ${message.to_name || message.to_email}`
                                          : `(${message.from_email})`
                                        }
                                      </span>
                                    </div>
                                    {!isMessageExpanded && preview && (
                                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                                        {preview}...
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(message.timestamp), 'dd MMM HH:mm')}
                                  </span>
                                  {isMessageExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Expanded Message Content */}
                            {isMessageExpanded && (
                              <div className="px-3 pb-3 pt-0">
                                <div className="border-t pt-3">
                                  {/* Email details */}
                                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                    <div>
                                      <span className="text-muted-foreground">From:</span>{' '}
                                      <span>{message.type === 'sent' ? message.from_email : (message.from_name || message.from_email)}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">To:</span>{' '}
                                      <span>{message.to_name || message.to_email}</span>
                                    </div>
                                  </div>

                                  {/* Message body */}
                                  {message.body && (
                                    <div 
                                      className="text-sm prose prose-sm max-w-none dark:prose-invert mb-3 max-h-[200px] overflow-y-auto"
                                      dangerouslySetInnerHTML={{ __html: message.body }}
                                    />
                                  )}

                                  {/* Status & Actions */}
                                  <div className="flex items-center justify-between pt-2 border-t">
                                    <div className="flex items-center gap-2">
                                      {message.type === 'sent' && message.originalEmail && (
                                        <>
                                          {message.bounce_type ? (
                                            <Badge className="bg-destructive/10 text-destructive text-xs">
                                              <XCircle className="h-3 w-3 mr-1" />
                                              Bounced
                                            </Badge>
                                          ) : message.open_count && message.open_count > 0 ? (
                                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                                              <Eye className="h-3 w-3 mr-1" />
                                              Opened {message.open_count > 1 ? `(${message.open_count}x)` : ''}
                                            </Badge>
                                          ) : (
                                            <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 text-xs">
                                              <Send className="h-3 w-3 mr-1" />
                                              Sent
                                            </Badge>
                                          )}
                                        </>
                                      )}
                                    </div>
                                    {!message.bounce_type && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleReplyToMessage(message, thread);
                                        }}
                                        className="h-7 text-xs gap-1"
                                      >
                                        <Reply className="h-3 w-3" />
                                        Reply
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Thread Actions Footer */}
                    <div className="p-2 border-t bg-muted/30 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReplyToThread(thread);
                        }}
                        className="gap-1"
                      >
                        <Reply className="h-4 w-4" />
                        Reply to Thread
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Reply Modal */}
      {selectedEmailForReply && (
        <EmailReplyModal
          open={showReplyModal}
          onOpenChange={setShowReplyModal}
          originalEmail={{
            id: selectedEmailForReply.id,
            recipient_email: selectedEmailForReply.recipient_email,
            recipient_name: selectedEmailForReply.recipient_name,
            sender_email: selectedEmailForReply.sender_email,
            subject: selectedEmailForReply.subject,
            body: selectedEmailForReply.body,
            sent_at: selectedEmailForReply.sent_at,
            contact_id: selectedEmailForReply.contact_id,
            lead_id: selectedEmailForReply.lead_id,
            account_id: selectedEmailForReply.account_id,
            thread_id: selectedEmailForReply.thread_id,
            message_id: selectedEmailForReply.message_id,
          }}
          replyTo={replyToData}
          onReplySent={() => {
            fetchEmails();
            setShowReplyModal(false);
          }}
        />
      )}
    </>
  );
};
