import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  Activity, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Clock,
  Mail,
  Bell,
  Database,
  Shield,
  Calendar,
  Users,
  Play,
  ExternalLink,
  Zap,
  AlertTriangle
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface EdgeFunctionStatus {
  name: string;
  displayName: string;
  category: 'email' | 'task' | 'meeting' | 'system' | 'utility';
  status: 'active' | 'error' | 'unknown' | 'deprecated';
  lastActivity?: string;
  activityCount?: number;
  description: string;
  icon: React.ReactNode;
  isRequired: boolean;
}

const EdgeFunctionMonitor = () => {
  const [functions, setFunctions] = useState<EdgeFunctionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchFunctionStatuses = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch various activity indicators in parallel
      const [
        keepAliveResult,
        emailHistoryResult,
        bouncesResult,
        repliesResult,
        backupsResult,
        securityLogsResult,
        tasksResult,
        meetingsResult,
        profilesResult,
      ] = await Promise.all([
        supabase.from('keep_alive').select('*').order('created_at', { ascending: false }).limit(1),
        supabase.from('email_history').select('id, sent_at', { count: 'exact', head: false }).order('sent_at', { ascending: false }).limit(1),
        supabase.from('email_history').select('id, bounced_at').not('bounced_at', 'is', null).order('bounced_at', { ascending: false }).limit(1),
        supabase.from('email_replies').select('id, received_at', { count: 'exact', head: false }).order('received_at', { ascending: false }).limit(1),
        supabase.from('backups').select('id, created_at').order('created_at', { ascending: false }).limit(1),
        supabase.from('security_audit_log').select('id, created_at', { count: 'exact', head: false }).order('created_at', { ascending: false }).limit(1),
        supabase.from('tasks').select('id, created_at').order('created_at', { ascending: false }).limit(1),
        supabase.from('meetings').select('id, created_at').order('created_at', { ascending: false }).limit(1),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ]);

      const getStatus = (data: any, field: string = 'created_at'): { status: 'active' | 'unknown', lastActivity?: string } => {
        if (data?.data?.[0]) {
          const activityDate = data.data[0][field];
          if (activityDate) {
            const date = new Date(activityDate);
            const hoursAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60);
            return {
              status: hoursAgo < 168 ? 'active' : 'unknown', // Active if used in last 7 days
              lastActivity: activityDate
            };
          }
        }
        return { status: 'unknown' };
      };

      const keepAliveStatus = getStatus(keepAliveResult, 'Able to read DB');
      const emailStatus = getStatus(emailHistoryResult, 'sent_at');
      const bounceStatus = getStatus(bouncesResult, 'bounced_at');
      const replyStatus = getStatus(repliesResult, 'received_at');
      const backupStatus = getStatus(backupsResult);
      const securityStatus = getStatus(securityLogsResult);

      const functionsList: EdgeFunctionStatus[] = [
        // System Functions
        {
          name: 'keep-alive',
          displayName: 'Keep Alive',
          category: 'system',
          status: keepAliveStatus.status,
          lastActivity: keepAliveStatus.lastActivity,
          description: 'Keeps database active with periodic pings',
          icon: <Activity className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'create-backup',
          displayName: 'Create Backup',
          category: 'system',
          status: backupStatus.status,
          lastActivity: backupStatus.lastActivity,
          description: 'Creates database backups with auto-cleanup',
          icon: <Database className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'restore-backup',
          displayName: 'Restore Backup',
          category: 'system',
          status: 'unknown',
          description: 'Restores database from backup file',
          icon: <Database className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'security-monitor',
          displayName: 'Security Monitor',
          category: 'system',
          status: securityStatus.status,
          lastActivity: securityStatus.lastActivity,
          description: 'Logs security events and anomalies',
          icon: <Shield className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'user-admin',
          displayName: 'User Admin',
          category: 'system',
          status: profilesResult?.count ? 'active' : 'unknown',
          activityCount: profilesResult?.count || 0,
          description: 'User CRUD operations with retry logic',
          icon: <Users className="h-4 w-4" />,
          isRequired: true
        },

        // Email Functions
        {
          name: 'send-email',
          displayName: 'Send Email',
          category: 'email',
          status: emailStatus.status,
          lastActivity: emailStatus.lastActivity,
          description: 'Sends emails via Outlook with tracking',
          icon: <Mail className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'process-bounce-checks',
          displayName: 'Bounce Checker',
          category: 'email',
          status: bounceStatus.status,
          lastActivity: bounceStatus.lastActivity,
          description: 'Detects bounced emails from NDR',
          icon: <AlertTriangle className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'process-email-replies',
          displayName: 'Reply Detector',
          category: 'email',
          status: replyStatus.status,
          lastActivity: replyStatus.lastActivity,
          description: 'Detects and logs email replies',
          icon: <Mail className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'track-email-open',
          displayName: 'Open Tracker',
          category: 'email',
          status: emailStatus.status,
          description: 'Tracks email open events',
          icon: <Mail className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'track-email-click',
          displayName: 'Click Tracker',
          category: 'email',
          status: emailStatus.status,
          description: 'Tracks email link clicks',
          icon: <Mail className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'mark-email-bounced',
          displayName: 'Mark Bounced',
          category: 'email',
          status: bounceStatus.status,
          description: 'Marks emails as bounced',
          icon: <XCircle className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'sync-email-bounces',
          displayName: 'Sync Bounces',
          category: 'email',
          status: 'deprecated',
          description: 'Legacy bounce sync (may be unnecessary)',
          icon: <RefreshCw className="h-4 w-4" />,
          isRequired: false
        },
        {
          name: 'backfill-message-ids',
          displayName: 'Backfill IDs',
          category: 'email',
          status: 'deprecated',
          description: 'One-time migration for message IDs',
          icon: <Database className="h-4 w-4" />,
          isRequired: false
        },

        // Task Functions
        {
          name: 'send-task-reminders',
          displayName: 'Task Reminders',
          category: 'task',
          status: tasksResult?.data?.length ? 'active' : 'unknown',
          lastActivity: tasksResult?.data?.[0]?.created_at,
          description: 'Sends daily task reminder emails',
          icon: <Bell className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'send-task-notification',
          displayName: 'Task Notifications',
          category: 'task',
          status: tasksResult?.data?.length ? 'active' : 'unknown',
          description: 'Sends task assignment notifications',
          icon: <Bell className="h-4 w-4" />,
          isRequired: true
        },

        // Meeting Functions
        {
          name: 'create-teams-meeting',
          displayName: 'Create Meeting',
          category: 'meeting',
          status: meetingsResult?.data?.length ? 'active' : 'unknown',
          lastActivity: meetingsResult?.data?.[0]?.created_at,
          description: 'Creates MS Teams meetings',
          icon: <Calendar className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'update-teams-meeting',
          displayName: 'Update Meeting',
          category: 'meeting',
          status: 'unknown',
          description: 'Updates MS Teams meetings',
          icon: <Calendar className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'cancel-teams-meeting',
          displayName: 'Cancel Meeting',
          category: 'meeting',
          status: 'unknown',
          description: 'Cancels MS Teams meetings',
          icon: <Calendar className="h-4 w-4" />,
          isRequired: true
        },

        // Utility Functions
        {
          name: 'fetch-user-display-names',
          displayName: 'Fetch Names',
          category: 'utility',
          status: 'active',
          description: 'Gets user display names',
          icon: <Users className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'get-user-names',
          displayName: 'Get Names',
          category: 'utility',
          status: 'active',
          description: 'Utility for user names',
          icon: <Users className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'sync-profile-names',
          displayName: 'Sync Profiles',
          category: 'utility',
          status: profilesResult?.count ? 'active' : 'unknown',
          activityCount: profilesResult?.count || 0,
          description: 'Syncs profile display names',
          icon: <RefreshCw className="h-4 w-4" />,
          isRequired: true
        },
      ];

      setFunctions(functionsList);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching function statuses:', error);
      toast.error('Failed to fetch edge function statuses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFunctionStatuses();
  }, [fetchFunctionStatuses]);

  const handleTestFunction = async (functionName: string) => {
    setTesting(functionName);
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        method: 'POST',
        body: { test: true }
      });

      if (error) {
        toast.error(`${functionName} test failed: ${error.message}`);
      } else {
        toast.success(`${functionName} is responding correctly`);
      }
    } catch (err: any) {
      toast.error(`${functionName} test failed: ${err.message}`);
    } finally {
      setTesting(null);
      // Refresh statuses after test
      setTimeout(fetchFunctionStatuses, 1000);
    }
  };

  const getStatusBadge = (status: EdgeFunctionStatus['status']) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'deprecated':
        return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Deprecated</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getStatusIcon = (status: EdgeFunctionStatus['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'deprecated':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const categories = [
    { id: 'all', label: 'All', icon: Zap },
    { id: 'system', label: 'System', icon: Database },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'task', label: 'Tasks', icon: Bell },
    { id: 'meeting', label: 'Meetings', icon: Calendar },
    { id: 'utility', label: 'Utility', icon: Users },
  ];

  const getFunctionsByCategory = (category: string) => {
    if (category === 'all') return functions;
    return functions.filter(f => f.category === category);
  };

  const stats = {
    total: functions.length,
    active: functions.filter(f => f.status === 'active').length,
    deprecated: functions.filter(f => f.status === 'deprecated').length,
    unknown: functions.filter(f => f.status === 'unknown').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Edge Functions</h3>
          <p className="text-sm text-muted-foreground">
            Monitor and test all {functions.length} edge functions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Last checked: {format(lastRefresh, 'HH:mm:ss')}
          </span>
          <Button variant="outline" size="sm" onClick={fetchFunctionStatuses} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Total Functions</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Deprecated</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.deprecated}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-muted-foreground">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Unknown</p>
            <p className="text-2xl font-bold text-muted-foreground">{stats.unknown}</p>
          </CardContent>
        </Card>
      </div>

      {/* Functions by Category */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          {categories.map(cat => {
            const Icon = cat.icon;
            const count = getFunctionsByCategory(cat.id).length;
            return (
              <TabsTrigger key={cat.id} value={cat.id} className="flex items-center gap-1.5">
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{cat.label}</span>
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{count}</Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {categories.map(cat => (
          <TabsContent key={cat.id} value={cat.id} className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {getFunctionsByCategory(cat.id).map((func) => (
                  <Card key={func.name} className={`transition-colors ${func.status === 'deprecated' ? 'opacity-60' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${
                            func.status === 'active' ? 'bg-green-500/10' : 
                            func.status === 'deprecated' ? 'bg-yellow-500/10' : 
                            'bg-muted'
                          }`}>
                            {func.icon}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{func.displayName}</span>
                              {getStatusBadge(func.status)}
                            </div>
                            <p className="text-xs text-muted-foreground">{func.description}</p>
                            {func.lastActivity && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Last: {formatDistanceToNow(new Date(func.lastActivity), { addSuffix: true })}
                              </p>
                            )}
                            {func.activityCount !== undefined && func.activityCount > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {func.activityCount.toLocaleString()} records
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleTestFunction(func.name)}
                                  disabled={testing === func.name || func.status === 'deprecated'}
                                >
                                  {testing === func.name ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Play className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Test function</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Deprecated Functions Warning */}
      {stats.deprecated > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Deprecated Functions Detected</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.deprecated} function(s) are marked as deprecated and may be removed in future updates.
                  Consider reviewing if they're still needed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EdgeFunctionMonitor;
