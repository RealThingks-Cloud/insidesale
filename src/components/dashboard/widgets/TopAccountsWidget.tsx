import React, { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAccountsData } from "@/hooks/useDashboardData";
import { WidgetLoadingSkeleton } from "./WidgetLoadingSkeleton";
import { Building2, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/shared/EmptyState";

interface TopAccountsWidgetProps {
  isResizeMode?: boolean;
}

export const TopAccountsWidget = memo(({ isResizeMode }: TopAccountsWidgetProps) => {
  const { data: accountsData, isLoading } = useAccountsData();
  const navigate = useNavigate();

  if (isLoading) return <WidgetLoadingSkeleton showHeader rows={3} />;

  const topAccounts = accountsData?.topAccounts || [];

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'hot': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      case 'working': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'nurture': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    }
  };

  return (
    <Card className="h-full hover:shadow-lg transition-shadow animate-fade-in overflow-hidden flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between py-2 px-3 flex-shrink-0">
        <CardTitle className="text-sm font-medium truncate flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-amber-500" />
          Top Accounts
        </CardTitle>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 text-xs"
          onClick={() => !isResizeMode && navigate('/accounts')}
        >
          View All
        </Button>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 flex-1 min-h-0 flex flex-col">
        {topAccounts && topAccounts.length > 0 ? (
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-1.5 pr-2">
              {topAccounts.map((account: any, index: number) => (
                <div 
                  key={account.id}
                  className="p-2 rounded bg-muted/50 hover:bg-muted text-xs flex items-center gap-2 cursor-pointer transition-colors"
                  onClick={() => !isResizeMode && navigate(`/accounts?search=${encodeURIComponent(account.company_name)}`)}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    index === 0 ? 'bg-amber-100 text-amber-700' :
                    index === 1 ? 'bg-gray-200 text-gray-700' :
                    index === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {index + 1}
                  </span>
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{account.company_name}</p>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${getStatusColor(account.status)}`}>
                    {account.status || 'New'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {account.deal_count || 0} deals
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 min-h-0 flex items-center justify-center">
          <EmptyState
              title="No accounts yet"
              description="Create accounts to see your top performers"
              illustration="empty-box"
              variant="compact"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
});

TopAccountsWidget.displayName = "TopAccountsWidget";
