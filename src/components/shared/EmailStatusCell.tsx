import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Mail, MailOpen, Reply, AlertTriangle, Send, Clock } from "lucide-react";
import { format } from "date-fns";
import { EmailStats } from "@/hooks/useEntityEmailStats";
import { EmailStatusPopover } from "./EmailStatusPopover";

interface EmailStatusCellProps {
  stats: EmailStats | null;
  entityId: string;
  entityType: 'contact' | 'lead';
  entityName: string;
  entityEmail?: string;
  onSendEmail?: () => void;
}

const statusConfig = {
  bounced: {
    label: 'Bounced',
    icon: AlertTriangle,
    className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
    iconColor: 'text-red-600 dark:text-red-400',
  },
  replied: {
    label: 'Replied',
    icon: Reply,
    className: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
  },
  opened: {
    label: 'Opened',
    icon: MailOpen,
    className: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
    iconColor: 'text-purple-600 dark:text-purple-400',
  },
  delivered: {
    label: 'Delivered',
    icon: Mail,
    className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
    iconColor: 'text-green-600 dark:text-green-400',
  },
  sent: {
    label: 'Sent',
    icon: Send,
    className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
};

export const EmailStatusCell = ({
  stats,
  entityId,
  entityType,
  entityName,
  entityEmail,
  onSendEmail,
}: EmailStatusCellProps) => {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const displayContent = useMemo(() => {
    if (!stats || stats.totalEmails === 0) {
      return {
        isEmpty: true,
        label: 'No emails',
        date: null,
        statsText: null,
      };
    }

    const config = stats.latestStatus ? statusConfig[stats.latestStatus] : statusConfig.sent;
    const StatusIcon = config.icon;
    const formattedDate = stats.lastSentAt ? format(new Date(stats.lastSentAt), 'MMM d') : null;
    
    let statsText = `${stats.totalEmails} sent`;
    if (stats.replyCount > 0) {
      statsText += ` • ${stats.replyCount} ${stats.replyCount === 1 ? 'reply' : 'replies'}`;
    }

    return {
      isEmpty: false,
      label: config.label,
      icon: StatusIcon,
      iconColor: config.iconColor,
      className: config.className,
      date: formattedDate,
      statsText,
      status: stats.latestStatus,
    };
  }, [stats]);

  if (displayContent.isEmpty) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              onClick={onSendEmail}
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs">No emails</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>No emails sent yet. Click to send an email.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const StatusIcon = displayContent.icon!;

  return (
    <EmailStatusPopover
      entityId={entityId}
      entityType={entityType}
      entityName={entityName}
      entityEmail={entityEmail}
      open={popoverOpen}
      onOpenChange={setPopoverOpen}
      onSendEmail={onSendEmail}
    >
      <button 
        className="flex flex-col items-start gap-0.5 cursor-pointer hover:opacity-80 transition-opacity text-left"
        onClick={() => setPopoverOpen(true)}
      >
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className={`${displayContent.className} text-xs px-1.5 py-0 h-5 font-medium`}>
            <StatusIcon className={`w-3 h-3 mr-1 ${displayContent.iconColor}`} />
            {displayContent.label}
          </Badge>
          {displayContent.date && (
            <span className="text-xs text-muted-foreground">• {displayContent.date}</span>
          )}
        </div>
        {displayContent.statsText && (
          <span className="text-xs text-muted-foreground">{displayContent.statsText}</span>
        )}
      </button>
    </EmailStatusPopover>
  );
};
