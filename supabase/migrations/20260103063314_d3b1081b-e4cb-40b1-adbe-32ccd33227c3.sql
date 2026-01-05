-- Add notification_frequency column to notification_preferences table
ALTER TABLE public.notification_preferences 
ADD COLUMN IF NOT EXISTS notification_frequency TEXT DEFAULT 'instant' 
CHECK (notification_frequency IN ('instant', 'daily', 'weekly'));

-- Add comment for clarity
COMMENT ON COLUMN public.notification_preferences.notification_frequency IS 'Controls how often notifications are batched: instant, daily, or weekly';

-- Add per-module notification columns for granular control
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS leads_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS contacts_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS accounts_notifications BOOLEAN DEFAULT true;

-- Add language preference to user_preferences
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en-US';

-- Add email signature to user_preferences
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS email_signature TEXT;