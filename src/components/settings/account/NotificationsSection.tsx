import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Clock, Building2, Users, UserCheck } from 'lucide-react';

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

interface NotificationsSectionProps {
  notificationPrefs: NotificationPrefs;
  setNotificationPrefs: React.Dispatch<React.SetStateAction<NotificationPrefs>>;
}

const NotificationsSection = ({ notificationPrefs, setNotificationPrefs }: NotificationsSectionProps) => {
  const deliveryMethods = [
    { key: 'email_notifications' as const, label: 'Email', description: 'Receive notifications via email' },
    { key: 'in_app_notifications' as const, label: 'In-App', description: 'Show notifications in the app' },
    { key: 'push_notifications' as const, label: 'Push', description: 'Browser push notifications' },
  ];

  const eventTriggers = [
    { key: 'lead_assigned' as const, label: 'Lead Assigned' },
    { key: 'deal_updates' as const, label: 'Deal Updates' },
    { key: 'task_reminders' as const, label: 'Task Reminders' },
    { key: 'meeting_reminders' as const, label: 'Meeting Reminders' },
    { key: 'weekly_digest' as const, label: 'Weekly Digest' },
  ];

  const moduleNotifications = [
    { key: 'leads_notifications' as const, label: 'Leads', icon: UserCheck, description: 'All lead-related notifications' },
    { key: 'contacts_notifications' as const, label: 'Contacts', icon: Users, description: 'All contact-related notifications' },
    { key: 'accounts_notifications' as const, label: 'Accounts', icon: Building2, description: 'All account-related notifications' },
  ];

  const togglePref = (key: keyof NotificationPrefs) => {
    setNotificationPrefs(p => ({ ...p, [key]: !p[key] }));
  };

  const handleFrequencyChange = (value: 'instant' | 'daily' | 'weekly') => {
    setNotificationPrefs(p => ({ ...p, notification_frequency: value }));
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Notification Frequency */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Delivery Frequency</p>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <Label htmlFor="notification-frequency" className="text-sm font-medium">How often to receive notifications</Label>
              <p className="text-xs text-muted-foreground">Choose between instant, daily digest, or weekly summary</p>
            </div>
            <Select 
              value={notificationPrefs.notification_frequency || 'instant'} 
              onValueChange={handleFrequencyChange}
            >
              <SelectTrigger className="w-[140px]" id="notification-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instant">Instant</SelectItem>
                <SelectItem value="daily">Daily Digest</SelectItem>
                <SelectItem value="weekly">Weekly Summary</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Delivery Methods */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Delivery Methods</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {deliveryMethods.map(({ key, label, description }) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="space-y-0.5">
                  <Label htmlFor={key} className="text-sm font-medium cursor-pointer">{label}</Label>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <Switch
                  id={key}
                  checked={notificationPrefs[key]}
                  onCheckedChange={() => togglePref(key)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Per-Module Notifications */}
        <div className="space-y-3 pt-3 border-t">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Module Notifications</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {moduleNotifications.map(({ key, label, icon: Icon, description }) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div className="space-y-0.5">
                    <Label htmlFor={key} className="text-sm font-medium cursor-pointer">{label}</Label>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </div>
                <Switch
                  id={key}
                  checked={notificationPrefs[key]}
                  onCheckedChange={() => togglePref(key)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Event Triggers */}
        <div className="space-y-3 pt-3 border-t">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Event Triggers</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {eventTriggers.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors">
                <Label htmlFor={key} className="text-sm cursor-pointer">{label}</Label>
                <Switch
                  id={key}
                  checked={notificationPrefs[key]}
                  onCheckedChange={() => togglePref(key)}
                />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationsSection;
