import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Mail, Eye, MousePointer, TrendingUp, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DailyStats {
  date: string;
  sent: number;
  opened: number;
  clicked: number;
}

interface StatusDistribution {
  name: string;
  value: number;
}

export const EmailAnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<StatusDistribution[]>([]);
  const [totals, setTotals] = useState({
    totalSent: 0,
    totalOpened: 0,
    totalClicked: 0,
    openRate: 0,
    clickRate: 0,
  });

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return;

        const days = parseInt(dateRange);
        const startDate = startOfDay(subDays(new Date(), days));
        const endDate = endOfDay(new Date());

        // Fetch all emails for the user within date range
        const { data: emails, error } = await supabase
          .from('email_history')
          .select('*')
          .eq('sent_by', user.data.user.id)
          .gte('sent_at', startDate.toISOString())
          .lte('sent_at', endDate.toISOString())
          .order('sent_at', { ascending: true });

        if (error) throw error;

        // Calculate totals
        const totalSent = emails?.length || 0;
        const totalOpened = emails?.filter(e => e.open_count && e.open_count > 0).length || 0;
        const totalClicked = emails?.filter(e => e.click_count && e.click_count > 0).length || 0;

        setTotals({
          totalSent,
          totalOpened,
          totalClicked,
          openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
          clickRate: totalOpened > 0 ? Math.round((totalClicked / totalOpened) * 100) : 0,
        });

        // Calculate daily stats
        const dateInterval = eachDayOfInterval({ start: startDate, end: endDate });
        const dailyData: DailyStats[] = dateInterval.map(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const dayEmails = emails?.filter(e => 
            format(new Date(e.sent_at), 'yyyy-MM-dd') === dateStr
          ) || [];

          return {
            date: format(date, 'dd MMM'),
            sent: dayEmails.length,
            opened: dayEmails.filter(e => e.open_count && e.open_count > 0).length,
            clicked: dayEmails.filter(e => e.click_count && e.click_count > 0).length,
          };
        });

        setDailyStats(dailyData);

        // Calculate status distribution
        const statusCounts: Record<string, number> = {};
        emails?.forEach(email => {
          const status = email.status || 'sent';
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        setStatusDistribution(
          Object.entries(statusCounts).map(([name, value]) => ({ name, value }))
        );

      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [dateRange]);

  const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];

  // Generate accessible summary text for charts
  const getChartSummary = () => {
    const recentStats = dailyStats.slice(-7);
    const avgSent = recentStats.reduce((a, b) => a + b.sent, 0) / Math.max(recentStats.length, 1);
    return `Email activity chart showing ${totals.totalSent} emails sent, ${totals.openRate}% open rate, ${totals.clickRate}% click rate over ${dateRange} days. Average ${avgSent.toFixed(1)} emails sent per day in the last week.`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with date range selector and export */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold">Email Analytics</h2>
          <p className="text-sm text-muted-foreground">Track your email performance and engagement</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px]" aria-label="Select date range">
              <SelectValue placeholder="Select date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            onClick={() => {
              const headers = ["Date", "Sent", "Opened", "Clicked"];
              const rows = dailyStats.map(stat => [stat.date, stat.sent, stat.opened, stat.clicked]);
              const csvContent = [
                headers.join(","),
                ...rows.map(row => row.join(","))
              ].join("\n");
              const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
              const link = document.createElement("a");
              link.href = URL.createObjectURL(blob);
              link.download = `email_analytics_${dateRange}_days.csv`;
              link.click();
            }}
            disabled={dailyStats.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totals.totalSent}</p>
                <p className="text-xs text-muted-foreground">Emails Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <Eye className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totals.openRate}%</p>
                <p className="text-xs text-muted-foreground">Open Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <MousePointer className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totals.clickRate}%</p>
                <p className="text-xs text-muted-foreground">Click Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <TrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totals.totalOpened}</p>
                <p className="text-xs text-muted-foreground">Total Opens</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart - Send Volume Over Time */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Email Activity Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="h-[300px]" 
              role="img" 
              aria-label={getChartSummary()}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="sent" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={false}
                    name="Sent"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="opened" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={false}
                    name="Opened"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="clicked" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    dot={false}
                    name="Clicked"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Hidden accessible table for screen readers */}
            <table className="sr-only">
              <caption>Email activity data over time</caption>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Sent</th>
                  <th>Opened</th>
                  <th>Clicked</th>
                </tr>
              </thead>
              <tbody>
                {dailyStats.slice(-7).map((stat) => (
                  <tr key={stat.date}>
                    <td>{stat.date}</td>
                    <td>{stat.sent}</td>
                    <td>{stat.opened}</td>
                    <td>{stat.clicked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Pie Chart - Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="h-[250px]"
              role="img"
              aria-label={`Status distribution: ${statusDistribution.map(s => `${s.name}: ${s.value}`).join(', ')}`}
            >
              {statusDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No data available
                </div>
              )}
            </div>
            {statusDistribution.length > 0 && (
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 justify-center mt-2">
                {statusDistribution.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1 text-xs">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      aria-hidden="true"
                    />
                    <span className="capitalize">{entry.name}: {entry.value}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bar Chart - Engagement Comparison */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Daily Engagement</CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="h-[250px]"
              role="img"
              aria-label="Daily engagement bar chart showing sent, opened, and clicked emails for the last 14 days"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyStats.slice(-14)}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="sent" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Sent" />
                  <Bar dataKey="opened" fill="#10b981" radius={[4, 4, 0, 0]} name="Opened" />
                  <Bar dataKey="clicked" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Clicked" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
