-- ============================================================================
-- MANDELA — SCHOOL DB: ROW-LEVEL SECURITY (defense-in-depth layer 2)
-- Layer 1 = per-school database (hard isolation).
-- Layer 2 = RLS inside each school DB, keyed on the API's session GUCs.
-- Layer 3 = API role checks (better-auth session + NestJS guards).
--
-- The API connects as mandela_app; every request sets:
--   SET LOCAL app.user_id = '<staff-or-guardian uuid>';
--   SET LOCAL app.role    = 'teacher' | 'bursar' | 'counter' | 'principal' | 'guardian';
--   SET LOCAL app.guardian_id = '<uuid>';  -- when role = guardian
-- RLS reads these GUCs and scopes every row. The offline sync user
-- (mandela_powersync) gets the same GUCs via PowerSync token claims.
-- ============================================================================

-- Helper: current staff id (NULL unless a staff request)
CREATE OR REPLACE FUNCTION app_staff_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN current_setting('app.role', true)
               IN ('admin','principal','teacher','bursar','counter','driver')
         THEN current_setting('app.user_id', true)::uuid END;
$$;

-- Helper: guardian id (NULL unless a guardian request)
CREATE OR REPLACE FUNCTION app_guardian_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN current_setting('app.role', true) = 'guardian'
         THEN current_setting('app.guardian_id', true)::uuid END;
$$;

-- Helper: learner ids the requesting guardian may see (their children only)
CREATE OR REPLACE FUNCTION app_guardian_learner_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE AS $$
  SELECT lg.learner_id FROM learner_guardian lg
  WHERE lg.guardian_id = app_guardian_id();
$$;

-- Helper: class ids a teacher may touch (own classes; staff.classes array)
CREATE OR REPLACE FUNCTION app_teacher_class_ids() RETURNS SETOF int
LANGUAGE sql STABLE AS $$
  SELECT DISTINCT c.id FROM class c
  JOIN staff s ON s.id = app_staff_id()
  WHERE c.code = ANY (s.classes);
$$;

-- ------------------------------- STAFF -------------------------------------
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_self ON staff USING (id = app_staff_id());
CREATE POLICY staff_admin ON staff USING (
  current_setting('app.role', true) IN ('admin','principal'));

-- ------------------------------ LEARNER ------------------------------------
ALTER TABLE learner ENABLE ROW LEVEL SECURITY;
-- staff see everyone; guardians see ONLY their children (hard data-layer rule)
CREATE POLICY learner_staff ON learner USING (
  current_setting('app.role', true) IN ('admin','principal','teacher','bursar','counter'));
CREATE POLICY learner_guardian ON learner USING (id IN (SELECT app_guardian_learner_ids()));

-- ----------------------------- GUARDIAN ------------------------------------
ALTER TABLE guardian ENABLE ROW LEVEL SECURITY;
CREATE POLICY guardian_staff ON guardian USING (
  current_setting('app.role', true) IN ('admin','principal','teacher','bursar'));
CREATE POLICY guardian_self ON guardian USING (id = app_guardian_id());

-- --------------------------- LEARNER_GUARDIAN ------------------------------
ALTER TABLE learner_guardian ENABLE ROW LEVEL SECURITY;
CREATE POLICY lg_staff ON learner_guardian USING (
  current_setting('app.role', true) IN ('admin','principal','teacher','bursar'));
CREATE POLICY lg_guardian ON learner_guardian USING (guardian_id = app_guardian_id());

-- ------------------------------ MONEY --------------------------------------
-- Teachers never see money rows; bursar/principal see all; guardians see
-- their children's fees only.
ALTER TABLE fee_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY fee_bursar ON fee_item USING (
  current_setting('app.role', true) IN ('admin','principal','bursar'));
CREATE POLICY fee_guardian ON fee_item USING (
  learner_id IN (SELECT app_guardian_learner_ids()));

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY pay_bursar ON payments USING (
  current_setting('app.role', true) IN ('admin','principal','bursar'));
CREATE POLICY pay_guardian ON payments USING (
  learner_id IN (SELECT app_guardian_learner_ids()));

ALTER TABLE mpesa_txn ENABLE ROW LEVEL SECURITY;
CREATE POLICY mpesa_bursar ON mpesa_txn USING (
  current_setting('app.role', true) IN ('admin','principal','bursar'));
CREATE POLICY mpesa_guardian ON mpesa_txn USING (
  learner_id IN (SELECT app_guardian_learner_ids()));

-- ---------------------------- ATTENDANCE -----------------------------------
-- Teachers: own classes. Guardians: own children (read).
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY att_teacher ON attendance USING (
  current_setting('app.role', true) IN ('admin','principal')
  OR (current_setting('app.role', true) = 'teacher'
      AND learner_id IN (SELECT id FROM learner WHERE class_id IN (SELECT app_teacher_class_ids()))));
CREATE POLICY att_guardian ON attendance USING (
  learner_id IN (SELECT app_guardian_learner_ids()));

-- ---------------------------- ASSESSMENT -----------------------------------
-- Published results visible to guardians; drafts only to their own teachers.
ALTER TABLE assessment ENABLE ROW LEVEL SECURITY;
CREATE POLICY asmt_staff ON assessment USING (
  current_setting('app.role', true) IN ('admin','principal')
  OR (current_setting('app.role', true) = 'teacher'
      AND learner_id IN (SELECT id FROM learner WHERE class_id IN (SELECT app_teacher_class_ids()))));
CREATE POLICY asmt_guardian ON assessment USING (
  published = true AND learner_id IN (SELECT app_guardian_learner_ids()));

-- ------------------------------- TALK ---------------------------------------
ALTER TABLE announcement ENABLE ROW LEVEL SECURITY;
CREATE POLICY ann_staff ON announcement USING (
  current_setting('app.role', true) IN ('admin','principal','teacher'));
CREATE POLICY ann_guardian_read ON announcement FOR SELECT USING (true);

ALTER TABLE message ENABLE ROW LEVEL SECURITY;
CREATE POLICY msg_guardian ON message USING (
  guardian_id = app_guardian_id());
CREATE POLICY msg_staff ON message USING (
  current_setting('app.role', true) IN ('admin','principal'));

-- ------------------------------ DESKS ---------------------------------------
ALTER TABLE library_loan ENABLE ROW LEVEL SECURITY;
CREATE POLICY loan_counter ON library_loan USING (
  current_setting('app.role', true) IN ('admin','principal','counter','teacher'));
CREATE POLICY loan_guardian ON library_loan USING (
  learner_id IN (SELECT app_guardian_learner_ids()));

ALTER TABLE stock_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY stock_counter ON stock_item USING (
  current_setting('app.role', true) IN ('admin','principal','bursar','counter'));

-- ------------------------------ AUDIT ---------------------------------------
-- Append-only: nobody updates/deletes; only principal+admin read.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_read ON audit_log FOR SELECT USING (
  current_setting('app.role', true) IN ('admin','principal'));

-- ------------------------- SERVICE ROLES ------------------------------------
-- mandela_app:      the API. NO superuser, NO BYPASSRLS. Sets GUCs per request.
-- mandela_powersync: sync service. Same GUC mechanism via token claims.
-- mandela_jobs:     workers (partition rolls, MV refresh, reconciliation).
--                   Uses SECURITY DEFINER functions for elevated writes only.
-- Idempotent (cluster-level roles may already exist from backend/db/cluster/000_roles.sql):
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mandela_app') THEN
    CREATE ROLE mandela_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mandela_powersync') THEN
    CREATE ROLE mandela_powersync NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mandela_jobs') THEN
    CREATE ROLE mandela_jobs NOLOGIN;
  END IF;
END $$;
-- NOTE: provisioner grants per-database:
--   GRANT CONNECT ON DATABASE mandela_<school> TO mandela_app, mandela_powersync, mandela_jobs;
--   GRANT USAGE ON ALL SCHEMAS ...; GRANT SELECT/INSERT/UPDATE/DELETE per table;
--   ALTER DEFAULT PRIVILEGES for future migrations.
