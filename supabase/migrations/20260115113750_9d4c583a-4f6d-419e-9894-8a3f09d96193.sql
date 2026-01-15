-- Function to update last_contacted_at on entities when email_history is inserted
CREATE OR REPLACE FUNCTION public.update_entity_last_contacted()
RETURNS TRIGGER AS $$
BEGIN
  -- Update contact if linked
  IF NEW.contact_id IS NOT NULL THEN
    UPDATE public.contacts 
    SET last_contacted_at = NEW.sent_at
    WHERE id = NEW.contact_id
      AND (last_contacted_at IS NULL OR last_contacted_at < NEW.sent_at);
  END IF;
  
  -- Update lead if linked
  IF NEW.lead_id IS NOT NULL THEN
    UPDATE public.leads 
    SET last_contacted_at = NEW.sent_at
    WHERE id = NEW.lead_id
      AND (last_contacted_at IS NULL OR last_contacted_at < NEW.sent_at);
  END IF;
  
  -- Update account if linked
  IF NEW.account_id IS NOT NULL THEN
    UPDATE public.accounts 
    SET last_contacted_at = NEW.sent_at
    WHERE id = NEW.account_id
      AND (last_contacted_at IS NULL OR last_contacted_at < NEW.sent_at);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on email_history insert
DROP TRIGGER IF EXISTS trigger_update_last_contacted ON public.email_history;
CREATE TRIGGER trigger_update_last_contacted
AFTER INSERT ON public.email_history
FOR EACH ROW
EXECUTE FUNCTION public.update_entity_last_contacted();

-- Fix existing contacts last_contacted_at with actual email dates
UPDATE public.contacts c
SET last_contacted_at = subq.max_sent_at
FROM (
  SELECT contact_id, MAX(sent_at) as max_sent_at
  FROM public.email_history 
  WHERE contact_id IS NOT NULL
  GROUP BY contact_id
) subq
WHERE c.id = subq.contact_id;

-- Fix existing leads last_contacted_at with actual email dates
UPDATE public.leads l
SET last_contacted_at = subq.max_sent_at
FROM (
  SELECT lead_id, MAX(sent_at) as max_sent_at
  FROM public.email_history 
  WHERE lead_id IS NOT NULL
  GROUP BY lead_id
) subq
WHERE l.id = subq.lead_id;

-- Fix existing accounts last_contacted_at with actual email dates
UPDATE public.accounts a
SET last_contacted_at = subq.max_sent_at
FROM (
  SELECT account_id, MAX(sent_at) as max_sent_at
  FROM public.email_history 
  WHERE account_id IS NOT NULL
  GROUP BY account_id
) subq
WHERE a.id = subq.account_id;