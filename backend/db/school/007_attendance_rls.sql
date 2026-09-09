-- ============================================================================
-- MANDELA — SCHOOL DB MIGRATION 007: ATTENDANCE UPSERT + FULL RLS CLOSURE
-- Found by the module debug harness (scripts/debug-modules.mjs):
--
--   1. The API connected as the cluster OWNER, so RLS never applied to the
--      live product (test:rls passed only because it did SET ROLE manually).
--      The API now does `SET LOCAL ROLE mandela_app` per transaction — which
--      makes every table below LIVE. Migrations 002's policies covered most
--      tables; this file closes the tables/paths 002 missed.
--
--   2. Attendance PK (learner_id, day, id) allowed duplicate marks per
--      learner/day, so re-marking double-counted every attendance stat.
--
--   3. Pre-session reads (login, landing pulse, branding) have no session
--      GUCs — as mandela_app they would see zero rows. Narrow SECURITY
--      DEFINER functions give exactly those paths a controlled window.
-- ============================================================================

-- 1) purge duplicate marks (keep latest synced_at, then highest id)
DELETE FROM attendance a
USING attendance b
WHERE a.learner_id = b.learner_id
  AND a.day = b.day
  AND (a.synced_at, a.id) < (b.synced_at, b.id);

-- 2) one mark per learner per day, enforced by the database (upsert arbiter)
CREATE UNIQUE INDEX IF NOT EXISTS uq_att_learner_day
  ON attendance (learner_id, day);

-- 3) attendance visibility: staff read (bursar/counter dashboards too),
--    teachers write their own classes, guardians only read their children
--    (002's att_guardian was an ALL policy — guardians could write marks).
DROP POLICY IF EXISTS att_teacher ON attendance;
CREATE POLICY att_staff ON attendance USING (
  current_setting('app.role', true) IN ('admin','principal','bursar','counter')
  OR (current_setting('app.role', true) = 'teacher'
      AND learner_id IN (SELECT id FROM learner WHERE class_id IN (SELECT app_teacher_class_ids()))));

DROP POLICY IF EXISTS att_guardian ON attendance;
CREATE POLICY att_guardian_read ON attendance FOR SELECT
  USING (learner_id IN (SELECT app_guardian_learner_ids()));

-- 4) audit_log is append-only: any session may insert, nobody updates or
--    deletes; only admin/principal read (audit_read from 002).
CREATE POLICY audit_insert ON audit_log FOR INSERT
  WITH CHECK (true);

-- 5) homework had no RLS: staff see/manage all, guardians read their
--    children's classwork only.
ALTER TABLE homework ENABLE ROW LEVEL SECURITY;
CREATE POLICY hw_staff ON homework USING (
  current_setting('app.role', true) IN ('admin','principal','teacher','bursar','counter'));
CREATE POLICY hw_guardian ON homework FOR SELECT USING (
  class_id IN (
    SELECT l.class_id FROM learner l
    WHERE l.id IN (SELECT app_guardian_learner_ids())
  ));

-- 6) consent was missed by 002 — guardians must see their own consent rows
--    or granted-optional fees vanish from their balance.
ALTER TABLE consent ENABLE ROW LEVEL SECURITY;
CREATE POLICY consent_staff ON consent USING (
  current_setting('app.role', true) IN ('admin','principal','teacher','bursar','counter'));
CREATE POLICY consent_guardian ON consent USING (
  learner_id IN (SELECT app_guardian_learner_ids()));

-- 7) reference + branding tables: readable to any session (they carry no
--    personal rows), writes stay privileged via API role checks.
ALTER TABLE class ENABLE ROW LEVEL SECURITY;
CREATE POLICY class_read ON class FOR SELECT USING (true);

ALTER TABLE term ENABLE ROW LEVEL SECURITY;
CREATE POLICY term_read ON term FOR SELECT USING (true);

ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY settings_read ON school_settings FOR SELECT USING (true);
CREATE POLICY settings_admin ON school_settings FOR UPDATE
  USING (current_setting('app.role', true) IN ('admin','principal'))
  WITH CHECK (current_setting('app.role', true) IN ('admin','principal'));

-- 8) Pre-session reads get a controlled SECURITY DEFINER window (runs as the
--    function owner, bypassing RLS by design, returning at most one row /
--    one aggregate — nothing personal).
CREATE OR REPLACE FUNCTION app_login_staff(p_email text)
RETURNS TABLE (id uuid, full_name text, role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.full_name, s.role::text
  FROM staff s WHERE s.email = p_email AND s.active = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION app_login_guardian(p_phone text)
RETURNS TABLE (id uuid, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.id, g.full_name
  FROM guardian g WHERE g.phone = p_phone AND g.active = true
  LIMIT 1
$$;

-- One aggregate powering both the landing's live pulse card and the
-- change-detection hash. Public data only: counts + today's collected total.
CREATE OR REPLACE FUNCTION public_pulse()
RETURNS TABLE (present bigint, expected bigint, paid_today numeric,
               paid_count bigint, ann_epoch bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT COUNT(*) FROM attendance WHERE day = CURRENT_DATE AND mark = 'present'),
    (SELECT COUNT(*) FROM learner WHERE status = 'active'),
    (SELECT COALESCE(SUM(amount),0) FROM payments
      WHERE state = 'confirmed' AND paid_at::date = CURRENT_DATE),
    (SELECT COUNT(*) FROM payments
      WHERE state = 'confirmed' AND paid_at::date = CURRENT_DATE),
    (SELECT COALESCE(MAX(extract(epoch FROM created_at)),0) FROM announcement)
$$;

GRANT EXECUTE ON FUNCTION app_login_staff(text), app_login_guardian(text),
  public_pulse() TO mandela_app;
