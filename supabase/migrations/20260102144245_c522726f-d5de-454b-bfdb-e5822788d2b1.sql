-- Phase 1: Add account_id foreign key to deals table
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_deals_account_id ON public.deals(account_id);

-- Populate account_id from existing customer_name matches
UPDATE public.deals d
SET account_id = a.id
FROM public.accounts a
WHERE d.customer_name = a.company_name
AND d.account_id IS NULL;

-- Create trigger function to auto-update contact_count on accounts
CREATE OR REPLACE FUNCTION public.update_account_contact_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update count for the new account if set
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.account_id IS DISTINCT FROM OLD.account_id) THEN
    IF NEW.account_id IS NOT NULL THEN
      UPDATE public.accounts SET contact_count = (
        SELECT COUNT(*) FROM public.contacts WHERE account_id = NEW.account_id
      ) WHERE id = NEW.account_id;
    END IF;
  END IF;
  
  -- Update count for the old account if it was changed or deleted
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.account_id IS DISTINCT FROM OLD.account_id) THEN
    IF OLD.account_id IS NOT NULL THEN
      UPDATE public.accounts SET contact_count = (
        SELECT COUNT(*) FROM public.contacts WHERE account_id = OLD.account_id
      ) WHERE id = OLD.account_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on contacts table
DROP TRIGGER IF EXISTS trigger_update_account_contact_count ON public.contacts;
CREATE TRIGGER trigger_update_account_contact_count
AFTER INSERT OR UPDATE OF account_id OR DELETE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.update_account_contact_count();

-- Create trigger function to auto-update deal_count on accounts
CREATE OR REPLACE FUNCTION public.update_account_deal_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update count for the new account if set
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.account_id IS DISTINCT FROM OLD.account_id) THEN
    IF NEW.account_id IS NOT NULL THEN
      UPDATE public.accounts SET deal_count = (
        SELECT COUNT(*) FROM public.deals WHERE account_id = NEW.account_id
      ) WHERE id = NEW.account_id;
    END IF;
  END IF;
  
  -- Update count for the old account if it was changed or deleted
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.account_id IS DISTINCT FROM OLD.account_id) THEN
    IF OLD.account_id IS NOT NULL THEN
      UPDATE public.accounts SET deal_count = (
        SELECT COUNT(*) FROM public.deals WHERE account_id = OLD.account_id
      ) WHERE id = OLD.account_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on deals table
DROP TRIGGER IF EXISTS trigger_update_account_deal_count ON public.deals;
CREATE TRIGGER trigger_update_account_deal_count
AFTER INSERT OR UPDATE OF account_id OR DELETE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.update_account_deal_count();

-- Run initial count sync for all accounts
UPDATE public.accounts a
SET 
  contact_count = (SELECT COUNT(*) FROM public.contacts c WHERE c.account_id = a.id),
  deal_count = (SELECT COUNT(*) FROM public.deals d WHERE d.account_id = a.id);