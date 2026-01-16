import React, { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDealsData } from "@/hooks/useDashboardData";
import { WidgetLoadingSkeleton } from "./WidgetLoadingSkeleton";
import { useNavigate } from "react-router-dom";

interface PipelineFunnelWidgetProps {
  isResizeMode?: boolean;
}

export const PipelineFunnelWidget = memo(({ isResizeMode }: PipelineFunnelWidgetProps) => {
  const { data: dealsData, isLoading } = useDealsData();
  const navigate = useNavigate();

  if (isLoading) return <WidgetLoadingSkeleton showHeader rows={4} />;

  const stages = [
    { key: 'lead', label: 'Lead', count: dealsData?.funnelData?.lead || 0, color: 'bg-blue-500' },
    { key: 'discussions', label: 'Discussions', count: dealsData?.funnelData?.discussions || 0, color: 'bg-indigo-500' },
    { key: 'qualified', label: 'Qualified', count: dealsData?.funnelData?.qualified || 0, color: 'bg-purple-500' },
    { key: 'rfq', label: 'RFQ', count: dealsData?.funnelData?.rfq || 0, color: 'bg-cyan-500' },
    { key: 'offered', label: 'Offered', count: dealsData?.funnelData?.offered || 0, color: 'bg-amber-500' },
    { key: 'won', label: 'Won', count: dealsData?.funnelData?.won || 0, color: 'bg-green-500' },
  ];

  const maxCount = Math.max(...stages.map(s => s.count), 1);

  return (
    <Card className="h-full hover:shadow-lg transition-shadow animate-fade-in overflow-hidden flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between py-2 px-3 flex-shrink-0">
        <CardTitle className="text-sm font-medium truncate">Pipeline Funnel</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 flex-1 min-h-0 flex flex-col justify-center">
        <div className="space-y-1.5">
          {stages.map((stage, index) => {
            const widthPercent = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
            // Create funnel effect by reducing max width as we go down
            const funnelEffect = 100 - (index * 8);
            const finalWidth = Math.max(10, Math.min(widthPercent, funnelEffect));
            
            return (
              <div 
                key={stage.key}
                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => !isResizeMode && navigate(`/deals?stage=${stage.label}`)}
              >
                <span className="text-[10px] text-muted-foreground w-16 truncate">{stage.label}</span>
                <div className="flex-1 h-4 bg-muted/30 rounded-sm overflow-hidden">
                  <div 
                    className={`h-full ${stage.color} rounded-sm transition-all duration-500 flex items-center justify-end pr-1`}
                    style={{ width: `${finalWidth}%` }}
                  >
                    {stage.count > 0 && (
                      <span className="text-[9px] text-white font-medium">{stage.count}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 pt-2 border-t flex justify-between text-[10px] text-muted-foreground">
          <span>Total Active: {dealsData?.active || 0}</span>
          <span className="text-green-600">Won: {dealsData?.won || 0}</span>
        </div>
      </CardContent>
    </Card>
  );
});

PipelineFunnelWidget.displayName = "PipelineFunnelWidget";
