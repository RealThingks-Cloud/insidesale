import React, { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRevenueTarget, useUserCurrency } from "@/hooks/useDashboardData";
import { WidgetLoadingSkeleton } from "./WidgetLoadingSkeleton";
import { Target, TrendingUp, TrendingDown, Coins } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface RevenueTargetWidgetProps {
  isResizeMode?: boolean;
}

const formatCurrency = (value: number, currency: string = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const RevenueTargetWidget = memo(({ isResizeMode }: RevenueTargetWidgetProps) => {
  const { data: revenueData, isLoading } = useRevenueTarget();
  const { data: currencyData } = useUserCurrency();

  if (isLoading) return <WidgetLoadingSkeleton showHeader rows={3} />;

  const currency = currencyData?.currency || 'USD';
  const progressPercentage = revenueData?.progressPercentage || 0;
  const isOnTrack = revenueData?.isOnTrack || false;

  return (
    <Card className="h-full hover:shadow-lg transition-shadow animate-fade-in overflow-hidden flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between py-2 px-3 flex-shrink-0">
        <CardTitle className="text-sm font-medium truncate flex items-center gap-1.5">
          <Target className="w-4 h-4 text-primary" />
          Revenue Target
        </CardTitle>
        {isOnTrack ? (
          <TrendingUp className="w-4 h-4 text-green-500" />
        ) : (
          <TrendingDown className="w-4 h-4 text-amber-500" />
        )}
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 flex-1 min-h-0 flex flex-col justify-center gap-3">
        <div className="text-center">
          <p className="text-2xl font-bold text-primary">
            {formatCurrency(revenueData?.currentRevenue || 0, currency)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            of {formatCurrency(revenueData?.yearlyTarget || 0, currency)} yearly target
          </p>
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground">Progress</span>
            <span className={isOnTrack ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
              {progressPercentage}%
            </span>
          </div>
          <Progress 
            value={progressPercentage} 
            className="h-2"
          />
        </div>
        
        <div className="flex justify-between text-[10px] pt-1 border-t">
          <span className="text-muted-foreground">Remaining</span>
          <span className="font-medium">{formatCurrency(revenueData?.remaining || 0, currency)}</span>
        </div>
        
        {!isOnTrack && (
          <p className="text-[9px] text-amber-600 text-center bg-amber-50 dark:bg-amber-900/20 py-1 px-2 rounded">
            Behind expected pace for this time of year
          </p>
        )}
      </CardContent>
    </Card>
  );
});

RevenueTargetWidget.displayName = "RevenueTargetWidget";
