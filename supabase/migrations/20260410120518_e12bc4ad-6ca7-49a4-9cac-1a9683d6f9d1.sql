
-- Add widget_layouts to dashboard_preferences
ALTER TABLE public.dashboard_preferences ADD COLUMN IF NOT EXISTS widget_layouts JSONB;

-- Add segment to contacts
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS segment TEXT;

-- Add parent_email_id to email_history
ALTER TABLE public.email_history ADD COLUMN IF NOT EXISTS parent_email_id UUID;

-- Add missing columns to notification_preferences
ALTER TABLE public.notification_preferences 
ADD COLUMN IF NOT EXISTS notification_frequency TEXT DEFAULT 'realtime',
ADD COLUMN IF NOT EXISTS leads_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS contacts_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS accounts_notifications BOOLEAN DEFAULT true;
