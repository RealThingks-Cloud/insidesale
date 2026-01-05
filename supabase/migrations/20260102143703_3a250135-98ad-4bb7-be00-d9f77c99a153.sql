-- Remove unused columns from accounts table
ALTER TABLE public.accounts 
DROP COLUMN IF EXISTS score,
DROP COLUMN IF EXISTS segment,
DROP COLUMN IF EXISTS total_revenue;