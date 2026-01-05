import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useThemePreferences } from '@/hooks/useThemePreferences';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, User, Shield, Bell, Settings2 } from 'lucide-react';
import ProfileSection from './account/ProfileSection';
import SecuritySection from './account/SecuritySection';
import NotificationsSection from './account/NotificationsSection';
import DisplayPreferencesSection from './account/DisplayPreferencesSection';
import PasswordChangeModal from './PasswordChangeModal';
import { TerminateSessionDialog, TerminateAllSessionsDialog } from './SessionDialogs';

interface ProfileData {
  full_name: string;
  email: string;
  phone: string;
  timezone: string;
  avatar_url: string;
}

interface NotificationPrefs {
  email_notifications: boolean;
  in_app_notifications: boolean;
  push_notifications: boolean;
  lead_assigned: boolean;
  deal_updates: boolean;
  task_reminders: boolean;
  meeting_reminders: boolean;
  weekly_digest: boolean;
  notification_frequency: 'instant' | 'daily' | 'weekly';
  leads_notifications: boolean;
  contacts_notifications: boolean;
  accounts_notifications: boolean;
}

interface DisplayPrefs {
  date_format: string;
  time_format: string;
  currency: string;
  default_module: string;
}

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

const AccountSettingsPage = () => {
  const { user } = useAuth();
  const { theme, setTheme } = useThemePreferences();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionToken, setCurrentSessionToken] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [terminatingSession, setTerminatingSession] = useState<string | null>(null);
  const [showTerminateAllDialog, setShowTerminateAllDialog] = useState(false);

  const initialDataRef = useRef<{
    profile: ProfileData;
    notificationPrefs: NotificationPrefs;
    displayPrefs: DisplayPrefs;
  } | null>(null);

  const [profile, setProfile] = useState<ProfileData>({
    full_name: '',
    email: '',
    phone: '',
    timezone: 'Asia/Kolkata',
    avatar_url: ''
  });

  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({
    email_notifications: true,
    in_app_notifications: true,
    push_notifications: false,
    lead_assigned: true,
    deal_updates: true,
    task_reminders: true,
    meeting_reminders: true,
    weekly_digest: false,
    notification_frequency: 'instant',
    leads_notifications: true,
    contacts_notifications: true,
    accounts_notifications: true
  });

  const [displayPrefs, setDisplayPrefs] = useState<DisplayPrefs>({
    date_format: 'DD/MM/YYYY',
    time_format: '12h',
    currency: 'INR',
    default_module: 'dashboard'
  });

  const hasUnsavedChanges = useCallback(() => {
    if (!initialDataRef.current) return false;
    const { profile: initProfile, notificationPrefs: initNotif, displayPrefs: initDisplay } = initialDataRef.current;
    return (
      JSON.stringify(profile) !== JSON.stringify(initProfile) ||
      JSON.stringify(notificationPrefs) !== JSON.stringify(initNotif) ||
      JSON.stringify(displayPrefs) !== JSON.stringify(initDisplay)
    );
  }, [profile, notificationPrefs, displayPrefs]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (user) {
      fetchAllData();
      fetchCurrentSessionToken();
    }
  }, [user]);

  const fetchCurrentSessionToken = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      setCurrentSessionToken(data.session.access_token.substring(0, 20));
    }
  };

  const fetchAllData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const loadedProfile: ProfileData = {
        full_name: profileData?.full_name || user.user_metadata?.full_name || '',
        email: profileData?.['Email ID'] || user.email || '',
        phone: profileData?.phone || '',
        timezone: profileData?.timezone || 'Asia/Kolkata',
        avatar_url: profileData?.avatar_url || ''
      };
      setProfile(loadedProfile);

      const { data: notifData } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const loadedNotifPrefs: NotificationPrefs = {
        email_notifications: notifData?.email_notifications ?? true,
        in_app_notifications: notifData?.in_app_notifications ?? true,
        push_notifications: notifData?.push_notifications ?? false,
        lead_assigned: notifData?.lead_assigned ?? true,
        deal_updates: notifData?.deal_updates ?? true,
        task_reminders: notifData?.task_reminders ?? true,
        meeting_reminders: notifData?.meeting_reminders ?? true,
        weekly_digest: notifData?.weekly_digest ?? false,
        notification_frequency: (notifData?.notification_frequency as 'instant' | 'daily' | 'weekly') ?? 'instant',
        leads_notifications: notifData?.leads_notifications ?? true,
        contacts_notifications: notifData?.contacts_notifications ?? true,
        accounts_notifications: notifData?.accounts_notifications ?? true
      };
      setNotificationPrefs(loadedNotifPrefs);

      const { data: displayData } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const loadedDisplayPrefs: DisplayPrefs = {
        date_format: displayData?.date_format || 'DD/MM/YYYY',
        time_format: displayData?.time_format || '12h',
        currency: displayData?.currency || 'INR',
        default_module: displayData?.default_module || 'dashboard'
      };
      setDisplayPrefs(loadedDisplayPrefs);

      initialDataRef.current = {
        profile: loadedProfile,
        notificationPrefs: loadedNotifPrefs,
        displayPrefs: loadedDisplayPrefs
      };

      await fetchSessions();
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    if (!user) return;
    setLoadingSessions(true);
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('last_active_at', { ascending: false });

      if (error) throw error;
      setSessions((data || []).map(s => ({
        ...s,
        ip_address: s.ip_address as string | null,
        device_info: s.device_info as Session['device_info']
      })));
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleSaveAll = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await supabase.from('profiles').upsert({
        id: user.id,
        full_name: profile.full_name,
        'Email ID': profile.email,
        phone: profile.phone,
        timezone: profile.timezone,
        avatar_url: profile.avatar_url,
        updated_at: new Date().toISOString()
      });

      await supabase.from('notification_preferences').upsert({
        user_id: user.id,
        ...notificationPrefs,
        updated_at: new Date().toISOString()
      });

      await supabase.from('user_preferences').upsert({
        user_id: user.id,
        theme,
        ...displayPrefs,
        updated_at: new Date().toISOString()
      });

      initialDataRef.current = { profile, notificationPrefs, displayPrefs };
      toast.success('All settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const terminateSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('id', sessionId);

      if (error) throw error;
      toast.success('Session terminated');
      fetchSessions();
    } catch (error) {
      toast.error('Failed to terminate session');
    } finally {
      setTerminatingSession(null);
    }
  };

  const terminateAllOtherSessions = async () => {
    if (!user) return;
    try {
      const currentSession = sessions.find(s => s.session_token?.substring(0, 20) === currentSessionToken);
      const { error } = await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .neq('id', currentSession?.id || '');

      if (error) throw error;
      toast.success('All other sessions terminated');
      fetchSessions();
    } catch (error) {
      toast.error('Failed to terminate sessions');
    } finally {
      setShowTerminateAllDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl pb-6">
      {/* Unsaved Changes Indicator */}
      {hasUnsavedChanges() && (
        <div className="sticky top-0 z-10 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-center justify-between shadow-sm">
          <p className="text-sm text-amber-800 dark:text-amber-200">You have unsaved changes</p>
          <Button size="sm" onClick={handleSaveAll} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Now'}
          </Button>
        </div>
      )}

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">Security</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="display" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">Display</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileSection profile={profile} setProfile={setProfile} userId={user?.id} />
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <SecuritySection
            sessions={sessions}
            loadingSessions={loadingSessions}
            currentSessionToken={currentSessionToken}
            onShowPasswordModal={() => setShowPasswordModal(true)}
            onRefreshSessions={fetchSessions}
            onTerminateSession={id => setTerminatingSession(id)}
            onTerminateAllOthers={() => setShowTerminateAllDialog(true)}
          />
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <NotificationsSection
            notificationPrefs={notificationPrefs}
            setNotificationPrefs={setNotificationPrefs}
          />
        </TabsContent>

        <TabsContent value="display" className="mt-6">
          <DisplayPreferencesSection
            displayPrefs={displayPrefs}
            setDisplayPrefs={setDisplayPrefs}
            theme={theme}
            setTheme={setTheme}
          />
        </TabsContent>
      </Tabs>

      {/* Save All Button */}
      <div className="flex justify-end pt-4 border-t">
        <Button onClick={handleSaveAll} disabled={saving} size="lg">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save All Changes
        </Button>
      </div>

      {/* Modals */}
      <PasswordChangeModal
        open={showPasswordModal}
        onOpenChange={setShowPasswordModal}
        userId={user?.id}
      />

      <TerminateSessionDialog
        open={!!terminatingSession}
        onOpenChange={() => setTerminatingSession(null)}
        onConfirm={() => terminatingSession && terminateSession(terminatingSession)}
      />

      <TerminateAllSessionsDialog
        open={showTerminateAllDialog}
        onOpenChange={setShowTerminateAllDialog}
        onConfirm={terminateAllOtherSessions}
      />
    </div>
  );
};

export default AccountSettingsPage;
