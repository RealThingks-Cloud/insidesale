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
  ExternalLink,
  Play,
  Calendar,
  Zap,
  Timer
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInHours } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface KeepAliveStatus {
  lastPing: string | null;
  status: 'active' | 'warning' | 'error' | 'unknown';
  hoursAgo: number | null;
}

const CronJobMonitoring = () => {
  const [keepAlive, setKeepAlive] = useState<KeepAliveStatus>({
    lastPing: null,
    status: 'unknown',
    hoursAgo: null
  });
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchKeepAliveStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('keep_alive')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching keep-alive status:', error);
        setKeepAlive({ lastPing: null, status: 'error', hoursAgo: null });
        return;
      }

      if (data && data['Able to read DB']) {
        const lastPing = data['Able to read DB'];
        const hoursAgo = differenceInHours(new Date(), new Date(lastPing));
        
        let status: KeepAliveStatus['status'] = 'active';
        if (hoursAgo > 48) {
          status = 'error';
        } else if (hoursAgo > 25) {
          status = 'warning';
        }

        setKeepAlive({ lastPing, status, hoursAgo });
      } else {
        setKeepAlive({ lastPing: null, status: 'unknown', hoursAgo: null });
      }
    } catch (error) {
      console.error('Error fetching keep-alive:', error);
      setKeepAlive({ lastPing: null, status: 'error', hoursAgo: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeepAliveStatus();
  }, [fetchKeepAliveStatus]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchKeepAliveStatus, 60000); // 60 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, fetchKeepAliveStatus]);

  const handleTestKeepAlive = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('keep-alive', {
        method: 'POST'
      });

      if (error) {
        toast.error(`Keep-alive test failed: ${error.message}`);
      } else {
        toast.success('Keep-alive ping successful!');
        // Refresh status after successful test
        setTimeout(fetchKeepAliveStatus, 1000);
      }
    } catch (err: any) {
      toast.error(`Keep-alive test failed: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const getStatusColor = (status: KeepAliveStatus['status']) => {
    switch (status) {
      case 'active': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'error': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: KeepAliveStatus['status']) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'error': return <XCircle className="h-5 w-5 text-destructive" />;
      default: return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: KeepAliveStatus['status']) => {
    switch (status) {
      case 'active': return 'Active';
      case 'warning': return 'Warning';
      case 'error': return 'Inactive';
      default: return 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Cron Jobs & Keep-Alive</h3>
          <p className="text-sm text-muted-foreground">
            Monitor scheduled jobs and database connectivity
          </p>
        </div>
        <div className="flex items-center gap-2">
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
                <p>{autoRefresh ? 'Auto-refresh ON (60s)' : 'Enable auto-refresh'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="outline" size="sm" onClick={fetchKeepAliveStatus} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Keep-Alive Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className={`border-l-4 ${
          keepAlive.status === 'active' ? 'border-l-green-500' :
          keepAlive.status === 'warning' ? 'border-l-yellow-500' :
          keepAlive.status === 'error' ? 'border-l-destructive' :
          'border-l-muted-foreground'
        }`}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5" />
              Database Keep-Alive
            </CardTitle>
            <CardDescription>Periodic pings to keep database active</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {loading ? (
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  getStatusIcon(keepAlive.status)
                )}
                <span className={`font-medium ${getStatusColor(keepAlive.status)}`}>
                  {loading ? 'Checking...' : getStatusLabel(keepAlive.status)}
                </span>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleTestKeepAlive}
                disabled={testing}
              >
                {testing ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Test Now
              </Button>
            </div>

            {keepAlive.lastPing && (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Last Ping
                  </span>
                  <span className="font-medium text-foreground">
                    {formatDistanceToNow(new Date(keepAlive.lastPing), { addSuffix: true })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Timestamp
                  </span>
                  <span className="font-medium text-foreground">
                    {format(new Date(keepAlive.lastPing), 'MMM d, yyyy HH:mm')}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* External Scheduler Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Timer className="h-5 w-5" />
              External Scheduler
            </CardTitle>
            <CardDescription>Managed via cron-job.org</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-500" />
                <span className="font-medium">cron-job.org</span>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => window.open('https://console.cron-job.org/', '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Console
              </Button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Schedule</span>
                <Badge variant="secondary">Daily @ 12:30 PM</Badge>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Target</span>
                <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                  keep-alive
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Provider</span>
                <span className="text-foreground">Free Tier</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warning Alert */}
      {keepAlive.status === 'warning' && (
        <Alert className="border-yellow-500/50 bg-yellow-500/5">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="text-yellow-600">Keep-Alive Warning</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            The last successful ping was over 25 hours ago. The database may enter sleep mode soon.
            Click "Test Now" to send an immediate ping or check your cron-job.org configuration.
          </AlertDescription>
        </Alert>
      )}

      {keepAlive.status === 'error' && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Keep-Alive Inactive</AlertTitle>
          <AlertDescription>
            No successful ping detected in the last 48 hours. The database may have entered sleep mode.
            Click "Test Now" to wake the database and verify the cron job is configured correctly.
          </AlertDescription>
        </Alert>
      )}

      {/* How It Works */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong className="text-foreground">1. Cron Job:</strong> An external scheduler (cron-job.org) 
            calls the keep-alive edge function daily at 12:30 PM.
          </p>
          <p>
            <strong className="text-foreground">2. Edge Function:</strong> The keep-alive function 
            updates the `keep_alive` table with the current timestamp.
          </p>
          <p>
            <strong className="text-foreground">3. Database Activity:</strong> This regular activity 
            prevents the free-tier Supabase database from entering sleep mode.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CronJobMonitoring;
