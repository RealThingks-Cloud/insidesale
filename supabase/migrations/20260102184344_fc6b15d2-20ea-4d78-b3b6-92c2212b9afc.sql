-- Add account_id and deal_id columns to meetings table for cross-module linking
ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_meetings_account_id ON public.meetings(account_id);
CREATE INDEX IF NOT EXISTS idx_meetings_deal_id ON public.meetings(deal_id);