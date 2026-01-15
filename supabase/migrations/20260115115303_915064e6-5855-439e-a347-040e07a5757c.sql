-- Add email_invalid flag to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email_invalid boolean DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email_invalid_reason text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email_invalid_at timestamp with time zone;

-- Add email_invalid flag to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_invalid boolean DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_invalid_reason text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_invalid_at timestamp with time zone;

-- Create index for quick filtering of invalid emails
CREATE INDEX IF NOT EXISTS idx_contacts_email_invalid ON contacts(email_invalid) WHERE email_invalid = true;
CREATE INDEX IF NOT EXISTS idx_leads_email_invalid ON leads(email_invalid) WHERE email_invalid = true;

-- Backfill existing bounced emails: Mark contacts with bounced emails as invalid
UPDATE contacts c
SET 
  email_invalid = true,
  email_invalid_reason = eh.bounce_reason,
  email_invalid_at = eh.bounced_at
FROM email_history eh
WHERE eh.contact_id = c.id
  AND eh.status = 'bounced'
  AND eh.bounced_at IS NOT NULL
  AND (c.email_invalid IS NULL OR c.email_invalid = false)
  AND eh.bounced_at = (
    SELECT MAX(eh2.bounced_at) FROM email_history eh2 
    WHERE eh2.contact_id = c.id AND eh2.status = 'bounced'
  );

-- Backfill existing bounced emails: Mark leads with bounced emails as invalid
UPDATE leads l
SET 
  email_invalid = true,
  email_invalid_reason = eh.bounce_reason,
  email_invalid_at = eh.bounced_at
FROM email_history eh
WHERE eh.lead_id = l.id
  AND eh.status = 'bounced'
  AND eh.bounced_at IS NOT NULL
  AND (l.email_invalid IS NULL OR l.email_invalid = false)
  AND eh.bounced_at = (
    SELECT MAX(eh2.bounced_at) FROM email_history eh2 
    WHERE eh2.lead_id = l.id AND eh2.status = 'bounced'
  );