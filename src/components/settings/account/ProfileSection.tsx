import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Mail, Phone, Globe, Loader2, Trash2, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const timezones = [
  { value: 'Asia/Kolkata', label: 'IST (India)' },
  { value: 'America/New_York', label: 'EST (US East)' },
  { value: 'America/Los_Angeles', label: 'PST (US West)' },
  { value: 'Europe/London', label: 'GMT (London)' },
  { value: 'Europe/Paris', label: 'CET (Paris)' },
  { value: 'Asia/Tokyo', label: 'JST (Tokyo)' },
  { value: 'Asia/Singapore', label: 'SGT (Singapore)' },
  { value: 'Australia/Sydney', label: 'AEST (Sydney)' },
  { value: 'Asia/Dubai', label: 'GST (Dubai)' }
];

interface ProfileData {
  full_name: string;
  email: string;
  phone: string;
  timezone: string;
  avatar_url: string;
}

interface ProfileSectionProps {
  profile: ProfileData;
  setProfile: React.Dispatch<React.SetStateAction<ProfileData>>;
  userId: string | undefined;
}

const ProfileSection = ({ profile, setProfile, userId }: ProfileSectionProps) => {
  const [removingAvatar, setRemovingAvatar] = useState(false);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  const handleAvatarUpload = async (file: File) => {
    if (!userId) return;
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}/avatar.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      setProfile(p => ({ ...p, avatar_url: urlData.publicUrl + '?t=' + Date.now() }));
      toast.success('Profile picture updated');
    } catch (error: any) {
      if (error.message?.includes('bucket')) {
        toast.error('Avatar storage is not configured');
      } else {
        toast.error('Failed to upload profile picture');
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!userId || !profile.avatar_url) return;
    setRemovingAvatar(true);
    
    try {
      await supabase.storage
        .from('avatars')
        .remove([`${userId}/avatar.png`, `${userId}/avatar.jpg`, `${userId}/avatar.jpeg`, `${userId}/avatar.webp`]);
      
      setProfile(p => ({ ...p, avatar_url: '' }));
      toast.success('Profile picture removed');
    } catch (error) {
      toast.error('Failed to remove profile picture');
    } finally {
      setRemovingAvatar(false);
    }
  };

  const triggerFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleAvatarUpload(file);
    };
    input.click();
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4" />
          Profile Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar Section */}
        <div className="flex items-center gap-5 p-4 bg-muted/30 rounded-lg">
          <div className="relative group">
            <Avatar className="h-20 w-20 cursor-pointer border-2 border-background shadow-sm" onClick={triggerFileUpload}>
              <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
              <AvatarFallback className="text-lg bg-primary/10">{getInitials(profile.full_name)}</AvatarFallback>
            </Avatar>
            <div 
              className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              onClick={triggerFileUpload}
            >
              <Camera className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="font-medium">{profile.full_name || 'Your Name'}</p>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={triggerFileUpload} className="h-7 text-xs">
                Change Photo
              </Button>
              {profile.avatar_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={handleRemoveAvatar}
                  disabled={removingAvatar}
                >
                  {removingAvatar ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1" />}
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="full_name" className="text-xs font-medium text-muted-foreground">Full Name</Label>
              <Input
                id="full_name"
                value={profile.full_name}
                onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                placeholder="Enter your full name"
                className="h-9 max-w-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">Email</Label>
              <div className="relative max-w-sm">
                <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  readOnly
                  disabled
                  className="pl-8 h-9 bg-muted/50 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-medium text-muted-foreground">Phone</Label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={profile.phone}
                  onChange={e => {
                    let value = e.target.value.replace(/[^\d+\s()-]/g, '');
                    setProfile(p => ({ ...p, phone: value }));
                  }}
                  placeholder="+1 234 567 8900"
                  className="pl-8 h-9 max-w-[200px]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="timezone" className="text-xs font-medium text-muted-foreground">Timezone</Label>
              <div className="relative max-w-xs">
                <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground z-10" />
                <Select
                  value={profile.timezone}
                  onValueChange={value => setProfile(p => ({ ...p, timezone: value }))}
                >
                  <SelectTrigger className="pl-8 h-9">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map(tz => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileSection;
