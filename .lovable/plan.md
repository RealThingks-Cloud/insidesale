

# Fix: Keep-Alive Cron Job Returning 500 Error

## Root Cause

The **deployed** version of the `keep-alive` edge function is outdated. It references a column called `last_ping` which does not exist in the `keep_alive` table. The table has these columns:
- `id` (bigint)
- `created_at` (timestamptz)
- `Able to read DB` (text)

The code in the repository is correct (uses `"Able to read DB"`), but the **deployed** function on Supabase is running an older version that uses `last_ping`.

## Evidence
- Edge function logs: `Could not find the 'last_ping' column of 'keep_alive' in the schema cache`
- cron-job.org: 500 Internal Server Error on every execution
- Supabase dashboard: All services healthy (Database, PostgREST, Auth, Storage, Realtime, Edge Functions)

## Fix

### Step 1: Redeploy the keep-alive edge function
The current code in `supabase/functions/keep-alive/index.ts` is already correct. It just needs to be redeployed so the live version matches the repository code.

### Step 2: Verify the fix
After deployment, manually test the endpoint to confirm it returns `{"status": "alive", ...}` instead of a 500 error.

### Step 3: Monitor next cron-job.org execution
The next scheduled execution (tomorrow at 6:43 AM based on the schedule) should succeed.

---

## Technical Details

No code changes are needed. The repository code is already correct:
```typescript
// Current correct code in repo
await supabase.from('keep_alive').upsert({ 
  id: 1,
  "Able to read DB": new Date().toISOString()
})
```

The deployed version incorrectly has something like:
```typescript
// Old deployed version (causing the error)
await supabase.from('keep_alive').upsert({ 
  id: 1,
  last_ping: new Date().toISOString()  // Column doesn't exist!
})
```

Only action required: **redeploy** the edge function.

