

# Bug Fix Plan: Database Schema Mismatches

## Problem Summary
The code was written for a different database schema than what exists. The regenerated Supabase types now expose the real schema, causing 50+ build errors across multiple files.

## Root Causes

### Bug 1: `accounts` table uses `account_name`, not `company_name`
The DB column is `account_name`. Code everywhere references `company_name`. Also missing columns: `email`, `notes`, `updated_at`, `created_at` (DB uses `modified_time`, `created_time`).

### Bug 2: `contacts` table has no `account_id` or `tags` columns
The `contacts` table does NOT have `account_id` or `tags`. Code references both. Account linking for contacts doesn't exist at the DB level.

### Bug 3: `announcements` and `announcement_dismissals` tables don't exist
`AnnouncementBanner.tsx` queries these non-existent tables.

### Bug 4: `NodeJS.Timeout` type errors
Multiple files use `NodeJS.Timeout` which isn't available in the browser TypeScript config.

---

## Fix Plan

### Phase 1: Database Migrations (add missing columns/tables)
Rather than rewriting all the code, align the database to what the code expects:

1. **Add missing columns to `accounts`**:
   - Add `email` (text, nullable)
   - Add `notes` (text, nullable)
   - The `account_name` vs `company_name` issue: rename column `account_name` to `company_name` OR add a generated/alias column. Renaming is cleanest since the code universally uses `company_name`.

2. **Add missing columns to `contacts`**:
   - Add `account_id` (uuid, nullable, FK to accounts)
   - Add `tags` (text array, nullable)

3. **Create `announcements` table** with columns: id, title, message, type, priority, target_roles, is_active, starts_at, expires_at, created_by, created_at

4. **Create `announcement_dismissals` table** with columns: id, announcement_id (FK), user_id, dismissed_at

### Phase 2: Fix Account type and field mappings
After migration, update `src/types/account.ts` to match the final schema (timestamps use `created_time`/`modified_time` not `created_at`/`updated_at`).

Update files referencing wrong timestamp columns:
- `AccountModal.tsx`: change `updated_at` to `modified_time`, `created_by` insert logic
- `AccountTable.tsx`: change `created_at` ordering to `created_time`
- `AccountDetailModalById.tsx`: align field names
- `UserDashboard.tsx`: change `created_at` to `created_time`

### Phase 3: Fix NodeJS.Timeout references
Replace `NodeJS.Timeout` with `ReturnType<typeof setTimeout>` in ~10 files:
- `AccountModal.tsx`, `ContactModal.tsx`, `LeadModal.tsx`
- `RealtimeSync.tsx`, `BounceCheckWorker.tsx`
- `DisplayPreferencesSection.tsx`, `ProfileSection.tsx`, `NotificationsSection.tsx`
- `UserDashboard.tsx`, `CronJobMonitoring.tsx`

### Phase 4: Regenerate Supabase types
After migrations, regenerate `types.ts` to reflect the new schema so all type errors resolve.

---

## Files to Modify

| File | Changes |
|------|---------|
| New migration SQL | Add columns, rename `account_name` to `company_name`, create announcement tables |
| `src/types/account.ts` | Align timestamps to `created_time`/`modified_time` |
| `src/components/AccountModal.tsx` | Fix `NodeJS.Timeout`, fix timestamp fields |
| `src/components/AccountTable.tsx` | Fix `created_at` to `created_time` ordering |
| `src/components/ContactModal.tsx` | Fix `NodeJS.Timeout` |
| `src/components/AnnouncementBanner.tsx` | No code changes needed (tables will be created) |
| `src/components/accounts/AccountDetailModalById.tsx` | Align field names |
| `src/components/dashboard/UserDashboard.tsx` | Fix `created_at` to `created_time`, fix `NodeJS.Timeout` |
| ~7 more files | Replace `NodeJS.Timeout` with `ReturnType<typeof setTimeout>` |

## Risk Assessment
- Renaming `account_name` to `company_name` will update all existing data seamlessly
- Adding `account_id` to contacts is additive (nullable), no data loss
- Announcement tables are new, no migration risk

