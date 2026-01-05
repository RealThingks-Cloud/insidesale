-- Phase 2: Database Improvements

-- 1. Add contact_id to deals table for better interlinking
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id);

-- 2. Create deal_stage_history table for stage change tracking
CREATE TABLE IF NOT EXISTS public.deal_stage_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  from_stage text,
  to_stage text NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  changed_by uuid,
  notes text
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_deal_stage_history_deal_id ON public.deal_stage_history(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_stage_history_changed_at ON public.deal_stage_history(changed_at DESC);

-- Enable RLS on the new table
ALTER TABLE public.deal_stage_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for deal_stage_history
CREATE POLICY "Authenticated users can view all stage history" 
ON public.deal_stage_history 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert stage history" 
ON public.deal_stage_history 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Create trigger function to auto-log stage changes
CREATE OR REPLACE FUNCTION public.log_deal_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if stage actually changed
  IF (TG_OP = 'UPDATE' AND OLD.stage IS DISTINCT FROM NEW.stage) THEN
    INSERT INTO public.deal_stage_history (deal_id, from_stage, to_stage, changed_by)
    VALUES (NEW.id, OLD.stage, NEW.stage, auth.uid());
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO public.deal_stage_history (deal_id, from_stage, to_stage, changed_by)
    VALUES (NEW.id, NULL, NEW.stage, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on deals table
DROP TRIGGER IF EXISTS trigger_log_deal_stage_change ON public.deals;
CREATE TRIGGER trigger_log_deal_stage_change
AFTER INSERT OR UPDATE ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.log_deal_stage_change();