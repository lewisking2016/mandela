-- ============================================================================
-- MANDELA — SCHOOL DB MIGRATION 004: AUDIT LOG PARTITIONS
-- audit_log is PARTITION BY RANGE (at). Partitions must exist before any
-- audit write (payment.record, grade.change, ...). This migration creates
-- the current and next month, and adds a DEFAULT partition as a safety net
-- so an audit write can never fail a business transaction.
-- A worker rolls partitions monthly and prunes the DEFAULT in production.
-- ============================================================================

DO $$
DECLARE
  cur_start date := date_trunc('month', now())::date;
  nxt_start date := (date_trunc('month', now()) + INTERVAL '1 month')::date;
  cur_name  text := 'audit_log_' || to_char(now(), 'YYYY_MM');
  nxt_name  text := 'audit_log_' || to_char(now() + INTERVAL '1 month', 'YYYY_MM');
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_log FOR VALUES FROM (%L) TO (%L)',
    cur_name, cur_start, nxt_start
  );
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_log FOR VALUES FROM (%L) TO (%L)',
    nxt_name, nxt_start, (nxt_start + INTERVAL '1 month')::date
  );
END $$;

-- Safety net: never lose an audit row because a month rolled unattended.
CREATE TABLE IF NOT EXISTS audit_log_default PARTITION OF audit_log DEFAULT;
