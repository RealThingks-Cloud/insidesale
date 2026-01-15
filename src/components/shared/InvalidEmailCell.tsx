import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Pencil } from "lucide-react";
import { format } from "date-fns";
import { HighlightedText } from "./HighlightedText";

interface InvalidEmailCellProps {
  email?: string | null;
  isInvalid?: boolean;
  invalidReason?: string | null;
  invalidAt?: string | null;
  searchTerm?: string;
  onEditClick?: () => void;
}

export const InvalidEmailCell = ({
  email,
  isInvalid,
  invalidReason,
  invalidAt,
  searchTerm,
  onEditClick,
}: InvalidEmailCellProps) => {
  if (!email) {
    return <span className="text-muted-foreground">-</span>;
  }

  if (!isInvalid) {
    return <HighlightedText text={email} highlight={searchTerm} />;
  }

  const formattedDate = invalidAt ? format(new Date(invalidAt), 'MMMM d, yyyy \'at\' h:mm a') : null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onEditClick}
            className="flex items-center gap-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors cursor-pointer group"
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate underline decoration-red-400/50 underline-offset-2">
              <HighlightedText text={email} highlight={searchTerm} />
            </span>
            <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs p-3" side="bottom">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-medium">
              <AlertTriangle className="w-4 h-4" />
              Email Delivery Failed
            </div>
            {formattedDate && (
              <p className="text-sm text-muted-foreground">
                This email address bounced on {formattedDate}
              </p>
            )}
            {invalidReason && (
              <p className="text-sm">
                <span className="text-muted-foreground">Reason:</span> {invalidReason}
              </p>
            )}
            <p className="text-xs text-muted-foreground italic">
              Click to update email address
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
