import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, Send, Eye, Reply, AlertTriangle, Clock, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface EmailStatusPopoverProps {
  children: ReactNode;
  entityId: string;
  entityType: 'contact' | 'lead';
  entityName: string;
  entityEmail?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendEmail?: () => void;
}

export const EmailStatusPopover = ({
  children,
  entityId,
  entityType,
  entityName,
  entityEmail,
  open,
  onOpenChange,
  onSendEmail,
}: EmailStatusPopoverProps) => {
  const idField = entityType === 'contact' ? 'contact_id' : 'lead_id';

  const { data: emailHistory, isLoading } = useQuery({
    queryKey: ['email-history-popover', entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_history')
        .select('*')
        .eq(idField, entityId)
        .order('sent_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    enabled: open,
    staleTime: 60 * 1000, // 1 minute
  });

  const getStatusBadge = (email: typeof emailHistory extends (infer T)[] ? T : never) => {
    if (email.status === 'bounced') {
      return (
        <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 text-xs">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Bounced
        </Badge>
      );
    }
    if (email.reply_count && email.reply_count > 0) {
      return (
        <Badge variant="outline" className="bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 text-xs">
          <Reply className="w-3 h-3 mr-1" />
          Replied
        </Badge>
      );
    }
    if (email.opened_at || email.status === 'opened') {
      return (
        <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 text-xs">
          <Eye className="w-3 h-3 mr-1" />
          Opened {email.open_count && email.open_count > 1 ? `(${email.open_count}x)` : ''}
        </Badge>
      );
    }
    if (email.status === 'delivered') {
      return (
        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 text-xs">
          <Mail className="w-3 h-3 mr-1" />
          Delivered
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 text-xs">
        <Send className="w-3 h-3 mr-1" />
        Sent
      </Badge>
    );
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Email History</h4>
            <span className="text-xs text-muted-foreground">{entityName}</span>
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : emailHistory && emailHistory.length > 0 ? (
            <div className="divide-y">
              {emailHistory.map((email) => (
                <div key={email.id} className="p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" title={email.subject}>
                        {email.subject}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(email.sent_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    {getStatusBadge(email)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center">
              <Mail className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No emails sent yet</p>
            </div>
          )}
        </div>

        <Separator />
        
        <div className="p-2 flex gap-2">
          {entityEmail && onSendEmail && (
            <Button 
              size="sm" 
              className="flex-1"
              onClick={() => {
                onOpenChange(false);
                onSendEmail();
              }}
            >
              <Send className="w-4 h-4 mr-1" />
              Send Email
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
