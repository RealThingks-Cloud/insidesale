import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  Database, 
  HardDrive, 
  Users, 
  Activity, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Server,
  Table2,
  FileText,
  Calendar,
  MessageSquare,
  Building2,
  UserCheck,
  Bell,
  Mail
} from 'lucide-react';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TableStats {
  table_name: string;
  row_count: number;
  icon: React.ReactNode;
}

interface SystemStats {
  tables: TableStats[];
  totalRecords: number;
  activeSessions: number;
  lastBackup: string | null;
  storageUsed: number;
}

const TABLE_CONFIG: { name: string; icon: React.ReactNode; label: string }[] = [
  { name: 'leads', icon: <FileText className="h-4 w-4" />, label: 'Leads' },
  { name: 'contacts', icon: <Users className="h-4 w-4" />, label: 'Contacts' },
  { name: 'accounts', icon: <Building2 className="h-4 w-4" />, label: 'Accounts' },
  { name: 'deals', icon: <Table2 className="h-4 w-4" />, label: 'Deals' },
  { name: 'meetings', icon: <Calendar className="h-4 w-4" />, label: 'Meetings' },
  { name: 'tasks', icon: <CheckCircle className="h-4 w-4" />, label: 'Tasks' },
  { name: 'email_history', icon: <Mail className="h-4 w-4" />, label: 'Email History' },
  { name: 'profiles', icon: <UserCheck className="h-4 w-4" />, label: 'Profiles' },
  { name: 'notifications', icon: <Bell className="h-4 w-4" />, label: 'Notifications' },
];

const SystemStatusSettings = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchSystemStats = async () => {
    setLoading(true);
    try {
      const tableStats: TableStats[] = [];
      let totalRecords = 0;

      // Fetch counts for all tables in parallel
      const countPromises = TABLE_CONFIG.map(async (config) => {
        const { count } = await supabase
          .from(config.name as any)
          .select('*', { count: 'exact', head: true });
        
        const rowCount = count || 0;
        return { 
          table_name: config.name, 
          row_count: rowCount,
          icon: config.icon 
        };
      });

      const results = await Promise.all(countPromises);
      results.forEach(result => {
        tableStats.push(result);
        totalRecords += result.row_count;
      });

      // Sort by record count descending
      tableStats.sort((a, b) => b.row_count - a.row_count);

      // Fetch last backup
      const { data: lastBackupData } = await supabase
        .from('backups')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Estimate storage (rough calculation based on records)
      const estimatedStorageMB = totalRecords * 0.001;

      // Get unique user count from profiles
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      setStats({
        tables: tableStats,
        totalRecords,
        activeSessions: userCount || 0,
        lastBackup: lastBackupData?.created_at || null,
        storageUsed: estimatedStorageMB,
      });

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching system stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemStats();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchSystemStats, 30000); // 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getHealthStatus = () => {
    if (!stats) return { status: 'unknown', color: 'text-muted-foreground' };
    
    if (stats.totalRecords > 0) {
      return { status: 'Healthy', color: 'text-green-500' };
    }
    return { status: 'No Data', color: 'text-yellow-500' };
  };

  const healthStatus = getHealthStatus();

  const getRecordBadgeVariant = (count: number): "default" | "secondary" | "outline" => {
    if (count > 100) return "default";
    if (count > 0) return "secondary";
    return "outline";
  };

  const formatTableName = (name: string): string => {
    return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">System Status</h3>
          <p className="text-sm text-muted-foreground">
            Monitor system health and resource usage
          </p>
        </div>
        <div className="flex items-center gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={autoRefresh ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                >
                  <Activity className={`h-4 w-4 ${autoRefresh ? 'animate-pulse' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{autoRefresh ? 'Auto-refresh ON (30s)' : 'Enable auto-refresh'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="outline" onClick={fetchSystemStats} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Health Overview - Improved Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Server className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">System Health</p>
                <div className="flex items-center gap-2">
                  {healthStatus.status === 'Healthy' ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  )}
                  <span className={`text-sm font-semibold ${healthStatus.color}`}>
                    {loading ? '...' : healthStatus.status}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Database className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Records</p>
                <p className="text-xl font-bold">
                  {loading ? '...' : stats?.totalRecords.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Users className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Users</p>
                <p className="text-xl font-bold">
                  {loading ? '...' : stats?.activeSessions}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <HardDrive className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Est. Storage</p>
                <p className="text-xl font-bold">
                  {loading ? '...' : `${stats?.storageUsed.toFixed(2)} MB`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Database Tables - Improved Grid Layout */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-5 w-5" />
            Database Tables
          </CardTitle>
          <CardDescription>Record counts for all CRM tables</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {stats?.tables.map((table) => (
                <div 
                  key={table.table_name} 
                  className="flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 rounded-lg transition-colors border"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-background rounded-md border">
                      {table.icon}
                    </div>
                    <span className="font-medium text-sm">
                      {formatTableName(table.table_name)}
                    </span>
                  </div>
                  <Badge 
                    variant={getRecordBadgeVariant(table.row_count)}
                    className="min-w-[60px] justify-center"
                  >
                    {table.row_count.toLocaleString()}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Info - Improved */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-5 w-5" />
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Last Backup</span>
              </div>
              <span className="text-sm font-medium">
                {stats?.lastBackup 
                  ? format(new Date(stats.lastBackup), 'MMM d, yyyy HH:mm')
                  : 'Never'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Last Refreshed</span>
              </div>
              <span className="text-sm font-medium">
                {format(lastRefresh, 'HH:mm:ss')}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Tables Monitored</span>
              </div>
              <span className="text-sm font-medium">
                {TABLE_CONFIG.length}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemStatusSettings;