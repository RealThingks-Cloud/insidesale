import React, { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUpcomingDeadlines, useUserCurrency } from "@/hooks/useDashboardData";
import { WidgetLoadingSkeleton } from "./WidgetLoadingSkeleton";
import { CalendarClock, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays, isToday, isTomorrow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/shared/EmptyState";

interface UpcomingDeadlinesWidgetProps {
  isResizeMode?: boolean;
}

const formatCurrency = (value: number, currency: string = 'USD') => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toString();
};

export const UpcomingDeadlinesWidget = memo(({ isResizeMode }: UpcomingDeadlinesWidgetProps) => {
  const { data: deadlines, isLoading } = useUpcomingDeadlines();
  const { data: currencyData } = useUserCurrency();
  const navigate = useNavigate();

  if (isLoading) return <WidgetLoadingSkeleton showHeader rows={3} />;

  const currency = currencyData?.currency || 'USD';

  const getDaysLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return { label: 'Today', urgent: true };
    if (isTomorrow(date)) return { label: 'Tomorrow', urgent: true };
    const days = differenceInDays(date, new Date());
    if (days <= 3) return { label: `${days}d`, urgent: true };
    if (days <= 7) return { label: `${days}d`, urgent: false };
    return { label: format(date, 'MMM d'), urgent: false };
  };

  return (
    <Card className="h-full hover:shadow-lg transition-shadow animate-fade-in overflow-hidden flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between py-2 px-3 flex-shrink-0">
        <CardTitle className="text-sm font-medium truncate flex items-center gap-1.5">
          <CalendarClock className="w-4 h-4 text-amber-500" />
          Upcoming Deadlines
        </CardTitle>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 text-xs"
          onClick={() => !isResizeMode && navigate('/deals')}
        >
          View All
        </Button>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 flex-1 min-h-0 flex flex-col">
        {deadlines && deadlines.length > 0 ? (
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-1.5 pr-2">
              {deadlines.map((deal: any) => {
                const daysInfo = getDaysLabel(deal.expected_closing_date);
                return (
                  <div 
                    key={deal.id}
                    className={`p-2 rounded text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                      daysInfo.urgent 
                        ? 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30' 
                        : 'bg-muted/50 hover:bg-muted'
                    }`}
                    onClick={() => !isResizeMode && navigate(`/deals?search=${encodeURIComponent(deal.deal_name)}`)}
                  >
                    {daysInfo.urgent && (
                      <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{deal.deal_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {deal.stage} • {currency} {formatCurrency(deal.total_contract_value || 0, currency)}
                      </p>
                    </div>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                      daysInfo.urgent 
                        ? 'bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {daysInfo.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <EmptyState
              title="No upcoming deadlines"
              description="Deals closing in the next 2 weeks will appear here"
              illustration="calendar"
              variant="compact"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
});

UpcomingDeadlinesWidget.displayName = "UpcomingDeadlinesWidget";
