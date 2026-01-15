-- Step 1: Remove duplicate email_replies, keeping only the first entry (earliest id)
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY email_history_id, graph_message_id 
    ORDER BY created_at ASC, id ASC
  ) as rn
  FROM email_replies
  WHERE graph_message_id IS NOT NULL
)
DELETE FROM email_replies
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Step 2: Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_replies_unique_message 
ON email_replies(email_history_id, graph_message_id);

-- Step 3: Recalculate reply_count on email_history based on actual unique replies
UPDATE email_history eh
SET reply_count = sub.actual_count
FROM (
  SELECT email_history_id, COUNT(*) as actual_count
  FROM email_replies
  GROUP BY email_history_id
) sub
WHERE eh.id = sub.email_history_id
  AND (eh.reply_count IS NULL OR eh.reply_count != sub.actual_count);