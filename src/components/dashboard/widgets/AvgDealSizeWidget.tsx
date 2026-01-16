import React, { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDealsData, useUserCurrency } from "@/hooks/useDashboardData";
import { WidgetLoadingSkeleton } from "./WidgetLoadingSkeleton";
import { DollarSign, Coins } from "lucide-react";

interface AvgDealSizeWidgetProps {
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

export const AvgDealSizeWidget = memo(({ isResizeMode }: AvgDealSizeWidgetProps) => {
  const { data: dealsData, isLoading } = useDealsData();
  const { data: currencyData } = useUserCurrency();

  if (isLoading) return <WidgetLoadingSkeleton showHeader rows={2} />;

  const currency = currencyData?.currency || 'USD';
  const avgDealSize = dealsData?.avgDealSize || 0;
  const wonValue = dealsData?.wonValue || 0;
  const wonCount = dealsData?.won || 0;
  const totalPipeline = dealsData?.totalPipeline || 0;

  return (
    <Card className="h-full hover:shadow-lg transition-shadow animate-fade-in overflow-hidden flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between py-2 px-3 flex-shrink-0">
        <CardTitle className="text-sm font-medium truncate">Deal Size</CardTitle>
        <Coins className="w-4 h-4 text-primary" />
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 flex-1 min-h-0 flex flex-col justify-center">
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center p-2 bg-green-50 dark:bg-green-950/20 rounded">
            <p className="text-lg font-bold text-green-600">
              {formatCurrency(avgDealSize, currency)}
            </p>
            <p className="text-[9px] text-muted-foreground">Avg Won Deal</p>
          </div>
          <div className="text-center p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
            <p className="text-lg font-bold text-blue-600">
              {formatCurrency(totalPipeline, currency)}
            </p>
            <p className="text-[9px] text-muted-foreground">Pipeline Value</p>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t flex justify-between text-[10px] text-muted-foreground">
          <span>Won Deals: {wonCount}</span>
          <span className="text-green-600 font-medium">{formatCurrency(wonValue, currency)} Total</span>
        </div>
      </CardContent>
    </Card>
  );
});

AvgDealSizeWidget.displayName = "AvgDealSizeWidget";
