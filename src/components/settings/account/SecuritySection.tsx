import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Key, Loader2, Monitor, Smartphone, Tablet, Clock, MapPin, LogOut, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface Session {
  id: string;
  session_token: string;
  ip_address: string | null;
  user_agent: string | null;
  device_info: {
    browser?: string;
    os?: string;
    device?: string;
  } | null;
  last_active_at: string;
  created_at: string;
  is_active: boolean;
}

interface SecuritySectionProps {
  sessions: Session[];
  loadingSessions: boolean;
  currentSessionToken: string | null;
  onShowPasswordModal: () => void;
  onRefreshSessions: () => void;
  onTerminateSession: (sessionId: string) => void;
  onTerminateAllOthers: () => void;
}

const SecuritySection = ({
  sessions,
  loadingSessions,
  currentSessionToken,
  onShowPasswordModal,
  onRefreshSessions,
  onTerminateSession,
  onTerminateAllOthers,
}: SecuritySectionProps) => {
  const [showAllSessions, setShowAllSessions] = useState(false);
  const MAX_VISIBLE_SESSIONS = 3;

  const isCurrentSession = (session: Session) => {
    return session.session_token?.substring(0, 20) === currentSessionToken;
  };

  const getDeviceIcon = (deviceInfo: Session['device_info']) => {
    const device = deviceInfo?.device?.toLowerCase() || '';
    if (device.includes('mobile') || device.includes('phone')) return <Smartphone className="h-4 w-4" />;
    if (device.includes('tablet') || device.includes('ipad')) return <Tablet className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  const parseUserAgent = (userAgent: string | null): { browser: string; os: string } => {
    if (!userAgent) return { browser: 'Unknown', os: 'Unknown' };
    let browser = 'Unknown';
    let os = 'Unknown';
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
    else if (userAgent.includes('Edg')) browser = 'Edge';
    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
    return { browser, os };
  };

  const visibleSessions = showAllSessions ? sessions : sessions.slice(0, MAX_VISIBLE_SESSIONS);
  const hasMoreSessions = sessions.length > MAX_VISIBLE_SESSIONS;
  const otherSessionsCount = sessions.filter(s => !isCurrentSession(s)).length;

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Key className="h-4 w-4" />
          Security
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Password Section */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
          <div>
            <p className="text-sm font-medium">Password</p>
            <p className="text-xs text-muted-foreground">Keep your account secure with a strong password</p>
          </div>
          <Button variant="outline" size="sm" onClick={onShowPasswordModal}>
            <Key className="h-3.5 w-3.5 mr-1.5" />
            Change
          </Button>
        </div>

        {/* Active Sessions */}
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium">Active Sessions</p>
              <p className="text-xs text-muted-foreground">{sessions.length} device{sessions.length !== 1 ? 's' : ''} logged in</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onRefreshSessions} disabled={loadingSessions} className="h-8">
                <RefreshCw className={`h-3.5 w-3.5 ${loadingSessions ? 'animate-spin' : ''}`} />
              </Button>
              {otherSessionsCount > 0 && (
                <Button variant="outline" size="sm" onClick={onTerminateAllOthers} className="h-8 text-xs">
                  <LogOut className="h-3.5 w-3.5 mr-1" />
                  Sign Out Others
                </Button>
              )}
            </div>
          </div>

          {loadingSessions ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">No active sessions found</p>
          ) : (
            <div className="space-y-2">
              {visibleSessions.map((session) => {
                const { browser, os } = parseUserAgent(session.user_agent);
                const isCurrent = isCurrentSession(session);
                return (
                  <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">{getDeviceIcon(session.device_info)}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{browser} · {os}</span>
                          {isCurrent && <Badge variant="secondary" className="text-xs h-5">Current</Badge>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {session.ip_address && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />{session.ip_address}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(session.last_active_at), 'dd/MM, HH:mm')}
                          </span>
                        </div>
                      </div>
                    </div>
                    {!isCurrent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onTerminateSession(session.id)}
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
              
              {hasMoreSessions && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-xs text-muted-foreground"
                  onClick={() => setShowAllSessions(!showAllSessions)}
                >
                  {showAllSessions ? (
                    <><ChevronUp className="h-3.5 w-3.5 mr-1" />Show Less</>
                  ) : (
                    <><ChevronDown className="h-3.5 w-3.5 mr-1" />Show {sessions.length - MAX_VISIBLE_SESSIONS} More</>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SecuritySection;
