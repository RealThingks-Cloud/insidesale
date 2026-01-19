-- Backfill thread_id for emails that don't have it set
-- For original emails (not replies), thread_id should be their own ID
UPDATE email_history 
SET thread_id = id 
WHERE thread_id IS NULL 
  AND parent_email_id IS NULL
  AND (is_reply IS NULL OR is_reply = false);

-- For reply emails, set thread_id based on parent email's thread_id
UPDATE email_history AS child
SET thread_id = COALESCE(
  (SELECT thread_id FROM email_history WHERE id = child.parent_email_id),
  child.parent_email_id::text
)
WHERE child.is_reply = true 
  AND child.thread_id IS NULL
  AND child.parent_email_id IS NOT NULL;