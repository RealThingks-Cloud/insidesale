import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Mail,
  Eye,
  Clock,
  ExternalLink,
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
}

interface EntityEmailHistoryProps {
  entityType: 'contact' | 'lead' | 'account';
  entityId: string;
}

export const EntityEmailHistory = ({ entityType, entityId }: EntityEmailHistoryProps) => {
  const [emails, setEmails] = useState<EmailHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<EmailHistoryItem | null>(null);

  useEffect(() => {
    const fetchEmails = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('email_history')
          .select('id, subject, recipient_email, recipient_name, sender_email, body, status, sent_at, opened_at, open_count')
          .order('sent_at', { ascending: false });

        // Apply filter based on entity type
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

    if (entityId) {
      fetchEmails();
    }
  }, [entityType, entityId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'opened': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'bounced': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
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
              className="cursor-pointer hover:bg-accent/50 transition-colors"
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
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {email.open_count || 0} opens
                      </span>
                    </div>
                  </div>
                  <Badge className={getStatusColor(email.status)}>
                    {email.status}
                  </Badge>
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
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Subject</p>
                  <p className="text-sm">{selectedEmail.subject}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge className={getStatusColor(selectedEmail.status)}>
                    {selectedEmail.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">To</p>
                  <p className="text-sm">{selectedEmail.recipient_name || selectedEmail.recipient_email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">From</p>
                  <p className="text-sm">{selectedEmail.sender_email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Sent At</p>
                  <p className="text-sm">{format(new Date(selectedEmail.sent_at), 'dd/MM/yyyy HH:mm')}</p>
                </div>
                {selectedEmail.opened_at && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">First Opened</p>
                    <p className="text-sm">{format(new Date(selectedEmail.opened_at), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-center">
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Eye className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="text-2xl font-bold">{selectedEmail.open_count || 0}</p>
                      <p className="text-xs text-muted-foreground">Opens</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {selectedEmail.body && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Email Body</p>
                  <div 
                    className="border rounded-md p-4 bg-muted/30 text-sm max-h-[200px] overflow-y-auto"
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
