
-- Add missing columns to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS created_time TIMESTAMPTZ DEFAULT now();

-- Add converted_from_contact_id to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS converted_from_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Add account_id to meetings
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_account_id ON public.meetings(account_id);

-- Create dashboard_preferences table
CREATE TABLE public.dashboard_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  visible_widgets TEXT[] DEFAULT ARRAY['stats', 'pipeline', 'tasks', 'calendar'],
  card_order TEXT[] DEFAULT ARRAY['stats', 'pipeline', 'tasks', 'calendar'],
  layout_view TEXT DEFAULT 'grid',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.dashboard_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own dashboard prefs" ON public.dashboard_preferences FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own dashboard prefs" ON public.dashboard_preferences FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own dashboard prefs" ON public.dashboard_preferences FOR UPDATE USING (user_id = auth.uid());

CREATE TRIGGER update_dashboard_preferences_updated_at BEFORE UPDATE ON public.dashboard_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
