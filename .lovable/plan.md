

## Plan: Fix Account Column Still Showing "—" in Reminder Email

### Root Cause

The data confirms all 3 existing deals have `customer_name` populated (Scania Group, Stellantis, Hanon). Hanon resolves correctly but the other two show "—". Since the logic is identical for all three, this strongly suggests the **deployed edge function is running stale code** — likely the version before the `customer_name` fix, where it relied on `account_id` (which is null).

The fact that "Hanon" works might be a coincidence if Hanon's deal has `account_id` populated or if the account name matches via a different path.

### Fix

1. **Add debug logging** to the account resolution block so we can verify what's happening at runtime
2. **Redeploy** the edge function to ensure the latest code with `customer_name` resolution is active
3. **Send a test email** to verify

### Changes in `supabase/functions/daily-action-reminders/index.ts`

Add console.log statements after the deals fetch and account map build:

```typescript
// After line 411 (after deals fetch loop)
console.log(`[DEBUG] dealModuleIds: ${JSON.stringify(dealModuleIds)}`);
console.log(`[DEBUG] dealAccountMap: ${JSON.stringify([...dealAccountMap.entries()])}`);

// After line 441 (after final accountMap build)
console.log(`[DEBUG] accountMap: ${JSON.stringify([...accountMap.entries()])}`);
```

Then redeploy and send test email. If the account names still show "—", the logs will tell us exactly where the resolution fails.

### Files
| File | Change |
|------|--------|
| `supabase/functions/daily-action-reminders/index.ts` | Add debug logging to account resolution, then redeploy |

