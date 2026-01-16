import React, { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDealsData } from "@/hooks/useDashboardData";
import { WidgetLoadingSkeleton } from "./WidgetLoadingSkeleton";
import { TrendingUp, TrendingDown, Target } from "lucide-react";

interface WinRateWidgetProps {
  isResizeMode?: boolean;
}

export const WinRateWidget = memo(({ isResizeMode }: WinRateWidgetProps) => {
  const { data: dealsData, isLoading } = useDealsData();

  if (isLoading) return <WidgetLoadingSkeleton showHeader rows={2} />;

  const winRate = dealsData?.winRate || 0;
  const won = dealsData?.won || 0;
  const lost = dealsData?.lost || 0;
  const total = won + lost;

  // Determine performance level
  const getPerformanceColor = (rate: number) => {
    if (rate >= 50) return 'text-green-600';
    if (rate >= 30) return 'text-amber-600';
    return 'text-red-600';
  };

  const getPerformanceIcon = (rate: number) => {
    if (rate >= 50) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (rate >= 30) return <Target className="w-4 h-4 text-amber-500" />;
    return <TrendingDown className="w-4 h-4 text-red-500" />;
  };

  return (
    <Card className="h-full hover:shadow-lg transition-shadow animate-fade-in overflow-hidden flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between py-2 px-3 flex-shrink-0">
        <CardTitle className="text-sm font-medium truncate">Win Rate</CardTitle>
        {getPerformanceIcon(winRate)}
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 flex-1 min-h-0 flex flex-col justify-center">
        <div className="flex items-center justify-center gap-4">
          <div className="relative w-20 h-20">
            {/* Circular progress */}
            <svg className="w-20 h-20 transform -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="35"
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                className="text-muted/30"
              />
              <circle
                cx="40"
                cy="40"
                r="35"
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 35}`}
                strokeDashoffset={`${2 * Math.PI * 35 * (1 - winRate / 100)}`}
                className={getPerformanceColor(winRate)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-xl font-bold ${getPerformanceColor(winRate)}`}>
                {winRate}%
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-xs text-muted-foreground">Won: {won}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-xs text-muted-foreground">Lost: {lost}</span>
            </div>
            <div className="text-[10px] text-muted-foreground pt-1 border-t">
              Total Closed: {total}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

WinRateWidget.displayName = "WinRateWidget";
