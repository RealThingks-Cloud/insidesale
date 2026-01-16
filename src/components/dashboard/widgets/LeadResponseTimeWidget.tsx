import React, { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLeadResponseTime } from "@/hooks/useDashboardData";
import { WidgetLoadingSkeleton } from "./WidgetLoadingSkeleton";
import { Clock, Zap, AlertTriangle, CheckCircle } from "lucide-react";

interface LeadResponseTimeWidgetProps {
  isResizeMode?: boolean;
}

export const LeadResponseTimeWidget = memo(({ isResizeMode }: LeadResponseTimeWidgetProps) => {
  const { data, isLoading } = useLeadResponseTime();

  if (isLoading) return <WidgetLoadingSkeleton showHeader rows={2} />;

  const avgHours = data?.avgResponseHours || 0;
  const totalLeads = data?.totalLeads || 0;
  const contactedCount = data?.contactedCount || 0;
  const contactRate = totalLeads > 0 ? Math.round((contactedCount / totalLeads) * 100) : 0;

  // Determine performance level
  const getPerformanceLevel = (hours: number) => {
    if (hours === 0) return { label: 'No data', color: 'text-muted-foreground', icon: Clock, bg: 'bg-muted/30' };
    if (hours <= 1) return { label: 'Excellent', color: 'text-green-600', icon: Zap, bg: 'bg-green-50 dark:bg-green-950/20' };
    if (hours <= 4) return { label: 'Good', color: 'text-blue-600', icon: CheckCircle, bg: 'bg-blue-50 dark:bg-blue-950/20' };
    if (hours <= 24) return { label: 'Average', color: 'text-amber-600', icon: Clock, bg: 'bg-amber-50 dark:bg-amber-950/20' };
    return { label: 'Needs Improvement', color: 'text-red-600', icon: AlertTriangle, bg: 'bg-red-50 dark:bg-red-950/20' };
  };

  const performance = getPerformanceLevel(avgHours);
  const PerformanceIcon = performance.icon;

  const formatTime = (hours: number) => {
    if (hours === 0) return '-';
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
  };

  return (
    <Card className="h-full hover:shadow-lg transition-shadow animate-fade-in overflow-hidden flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between py-2 px-3 flex-shrink-0">
        <CardTitle className="text-sm font-medium truncate">Lead Response Time</CardTitle>
        <PerformanceIcon className={`w-4 h-4 ${performance.color}`} />
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 flex-1 min-h-0 flex flex-col justify-center">
        <div className={`text-center p-3 rounded-lg ${performance.bg} mb-2`}>
          <p className={`text-2xl font-bold ${performance.color}`}>
            {formatTime(avgHours)}
          </p>
          <p className="text-[10px] text-muted-foreground">Avg Response (30 days)</p>
          <span className={`text-[9px] font-medium ${performance.color}`}>
            {performance.label}
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-1.5 bg-muted/30 rounded">
            <p className="text-sm font-bold">{totalLeads}</p>
            <p className="text-[9px] text-muted-foreground">New Leads</p>
          </div>
          <div className="p-1.5 bg-muted/30 rounded">
            <p className="text-sm font-bold">{contactRate}%</p>
            <p className="text-[9px] text-muted-foreground">Contact Rate</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

LeadResponseTimeWidget.displayName = "LeadResponseTimeWidget";
