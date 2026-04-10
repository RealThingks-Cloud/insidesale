
ALTER TABLE public.email_history ADD COLUMN IF NOT EXISTS is_reply BOOLEAN DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE public.dashboard_preferences ADD COLUMN IF NOT EXISTS dashboard_view TEXT DEFAULT 'grid';
