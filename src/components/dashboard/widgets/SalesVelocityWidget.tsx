import React, { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDealsData, useUserCurrency } from "@/hooks/useDashboardData";
import { WidgetLoadingSkeleton } from "./WidgetLoadingSkeleton";
import { Gauge, TrendingUp, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SalesVelocityWidgetProps {
  isResizeMode?: boolean;
}

const formatCurrency = (value: number, currency: string = 'USD') => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return Math.round(value).toString();
};

export const SalesVelocityWidget = memo(({ isResizeMode }: SalesVelocityWidgetProps) => {
  const { data: dealsData, isLoading } = useDealsData();
  const { data: currencyData } = useUserCurrency();

  if (isLoading) return <WidgetLoadingSkeleton showHeader rows={3} />;

  const currency = currencyData?.currency || 'USD';
  
  // Sales Velocity = (Number of Opportunities × Win Rate × Average Deal Size) / Sales Cycle Length
  // Using simplified formula with assumed 30-day cycle
  const activeDeals = dealsData?.active || 0;
  const winRate = (dealsData?.winRate || 0) / 100;
  const avgDealSize = dealsData?.avgDealSize || 0;
  const salesCycle = 30; // Assumed average sales cycle in days
  
  const velocity = salesCycle > 0 ? (activeDeals * winRate * avgDealSize) / salesCycle : 0;
  const monthlyVelocity = velocity * 30; // Monthly projected revenue

  // Determine velocity level
  const getVelocityLevel = (vel: number) => {
    if (vel === 0) return { label: 'No data', color: 'text-muted-foreground', bg: 'bg-muted/30' };
    if (vel >= 100) return { label: 'High', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/20' };
    if (vel >= 50) return { label: 'Medium', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20' };
    return { label: 'Low', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20' };
  };

  const level = getVelocityLevel(velocity);

  return (
    <Card className="h-full hover:shadow-lg transition-shadow animate-fade-in overflow-hidden flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between py-2 px-3 flex-shrink-0">
        <CardTitle className="text-sm font-medium truncate flex items-center gap-1.5">
          <Gauge className="w-4 h-4 text-primary" />
          Sales Velocity
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-3 h-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  Sales Velocity measures how quickly you're generating revenue.
                  Formula: (Active Deals × Win Rate × Avg Deal Size) / Sales Cycle
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <TrendingUp className={`w-4 h-4 ${level.color}`} />
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 flex-1 min-h-0 flex flex-col justify-center">
        <div className={`text-center p-3 rounded-lg ${level.bg} mb-2`}>
          <p className={`text-xl font-bold ${level.color}`}>
            {currency} {formatCurrency(velocity, currency)}/day
          </p>
          <p className="text-[10px] text-muted-foreground">Revenue Velocity</p>
          <span className={`text-[9px] font-medium ${level.color}`}>
            {level.label} Performance
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-1.5 bg-muted/30 rounded">
            <p className="text-sm font-bold text-primary">
              {currency} {formatCurrency(monthlyVelocity, currency)}
            </p>
            <p className="text-[9px] text-muted-foreground">Monthly Projection</p>
          </div>
          <div className="p-1.5 bg-muted/30 rounded">
            <p className="text-sm font-bold">{activeDeals}</p>
            <p className="text-[9px] text-muted-foreground">Active Deals</p>
          </div>
        </div>
        
        <div className="mt-2 pt-2 border-t grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
          <span>Win Rate: {dealsData?.winRate || 0}%</span>
          <span>Avg Size: {currency} {formatCurrency(avgDealSize, currency)}</span>
        </div>
      </CardContent>
    </Card>
  );
});

SalesVelocityWidget.displayName = "SalesVelocityWidget";
