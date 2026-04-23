-- Migration 014: Drop the legacy `sends` table (FEAT-2 final cutover)
--
-- Preconditions (verify BEFORE running):
--   1. All clients on version >= 1.1.0 (min_version enforced in app_config).
--      Confirm via: SELECT min_version FROM app_config;
--   2. No recent writes to `sends` (grace window elapsed).
--      Confirm via:
--        SELECT COUNT(*) FROM sends
--        WHERE created_at > now() - INTERVAL '7 days';
--   3. New-app code shipped (removes all reads/writes of `sends`).
--
-- What this does:
--   - Drops the sends_to_logs_sync trigger on `sends`.
--   - Drops the sync_send_to_log() function.
--   - Drops the `sends` table (CASCADE removes dependent FKs, RLS policies, indexes).
--
-- Rollback: restore from backup. There is no forward rollback script — once
-- `sends` is gone, the new schema is authoritative.

BEGIN;

-- 1. Drop the bridge trigger + function
DROP TRIGGER IF EXISTS sends_to_logs_sync ON sends;
DROP FUNCTION IF EXISTS sync_send_to_log();

-- 2. Drop the table (CASCADE clears RLS policies, indexes, dependent constraints)
DROP TABLE IF EXISTS sends CASCADE;

COMMIT;
