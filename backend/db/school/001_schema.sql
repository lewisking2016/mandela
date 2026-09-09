-- ============================================================================
-- MANDELA — PER-SCHOOL DATABASE SCHEMA v1.0
-- One instance of this schema per school database (mandela_<schoolslug>).
-- Postgres 16+. Applied by the Provisioner at school creation and on upgrade.
--
-- Conventions
--   * Money is ALWAYS integer cents (KES cents) — never floats.
--   * Timestamps are timestamptz (UTC). Calendar days are DATE.
--   * Phones normalized to 2547XXXXXXXX at every write path.
--   * Every table that the offline client touches has updated_at for sync.
--   * Partitioned tables: attendance, payments, messages, audit_log (monthly).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;        -- case-insensitive emails
CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- fuzzy learner name search

-- ---------------------------------------------------------------------------
-- ENUMS (stable values; new values via migration only)
-- ---------------------------------------------------------------------------
CREATE TYPE user_role       AS ENUM ('admin','principal','teacher','bursar','counter','driver');
CREATE TYPE learner_status  AS ENUM ('active','transferred','graduated','alumni','inactive');
CREATE TYPE attendance_mark AS ENUM ('present','absent','late','excused');
CREATE TYPE payment_method  AS ENUM ('mpesa','bank','cash','cheque');
CREATE TYPE payment_state   AS ENUM ('pending','confirmed','failed','reversed');
CREATE TYPE consent_choice  AS ENUM ('granted','declined','revoked');
CREATE TYPE message_channel AS ENUM ('whatsapp','sms','both');
CREATE TYPE message_state   AS ENUM ('queued','sent','delivered','read','failed');
CREATE TYPE exam_type       AS ENUM ('cat','midterm','endterm');
CREATE TYPE grade_level     AS ENUM ('AL1','AL2','AL3','AL4','AL5','AL6','AL7','AL8'); -- CBC AL 1-8

-- ---------------------------------------------------------------------------
-- STAFF (maps 1:1 to better-auth user rows in this school DB)
-- ---------------------------------------------------------------------------
CREATE TABLE staff (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  text UNIQUE NOT NULL,          -- better-auth user id
  full_name     text NOT NULL,
  email         citext UNIQUE,
  phone         text,
  role          user_role NOT NULL DEFAULT 'teacher',
  classes       text[],                        -- class codes they teach (fast path)
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- ACADEMIC STRUCTURE
-- ---------------------------------------------------------------------------
CREATE TABLE academic_year (
  id         serial PRIMARY KEY,
  year       int NOT NULL UNIQUE CHECK (year BETWEEN 2000 AND 2100),
  starts_on  date NOT NULL,
  ends_on    date NOT NULL,
  is_current boolean NOT NULL DEFAULT false
);

CREATE TABLE term (
  id        serial PRIMARY KEY,
  year_id   int NOT NULL REFERENCES academic_year(id) ON DELETE CASCADE,
  label     text NOT NULL,                     -- 'Term 1'
  starts_on date NOT NULL,
  ends_on   date NOT NULL,
  UNIQUE (year_id, label)
);

CREATE TABLE class (
  id         serial PRIMARY KEY,
  code       text NOT NULL UNIQUE,             -- 'G7B'
  name       text NOT NULL,                    -- 'Grade 7 Blue'
  level      text NOT NULL,                    -- 'Grade 7'
  stream     text,                             -- 'Blue'
  teacher_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- PEOPLE: learners + guardians (guardian is an ENTITY, never a text field)
-- ---------------------------------------------------------------------------
CREATE TABLE learner (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_no  text NOT NULL UNIQUE,
  upi           text UNIQUE,                   -- KEMIS Unique Personal Identifier
  first_name    text NOT NULL,
  middle_name   text,
  last_name     text NOT NULL,
  gender        char(1) CHECK (gender IN ('M','F')),
  date_of_birth date,
  birth_cert_no text,                          -- entry number, not serial (KEMIS rule)
  class_id      int REFERENCES class(id) ON DELETE SET NULL,
  status        learner_status NOT NULL DEFAULT 'active',
  boarding      boolean NOT NULL DEFAULT false,
  photo_key     text,                          -- MinIO object key
  search_name   text GENERATED ALWAYS AS (lower(first_name || ' ' || coalesce(middle_name,'') || ' ' || last_name)) STORED,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_learner_class   ON learner(class_id) WHERE status = 'active';
CREATE INDEX idx_learner_trgm    ON learner USING gin (search_name gin_trgm_ops);
CREATE INDEX idx_learner_upi     ON learner(upi) WHERE upi IS NOT NULL;

CREATE TABLE guardian (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id   text UNIQUE,                  -- set when parent activates login
  full_name      text NOT NULL,
  phone          text UNIQUE NOT NULL,         -- 2547XXXXXXXX; WhatsApp identity
  email          citext,
  relationship   text NOT NULL,                -- 'mother','father','guardian'
  is_primary     boolean NOT NULL DEFAULT false,
  wa_opt_in      boolean NOT NULL DEFAULT false, -- documented WhatsApp consent
  wa_opt_in_at   timestamptz,
  sms_fallback   boolean NOT NULL DEFAULT true,
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- many-to-many: siblings share guardians; a child has multiple guardians
CREATE TABLE learner_guardian (
  learner_id  uuid NOT NULL REFERENCES learner(id) ON DELETE CASCADE,
  guardian_id uuid NOT NULL REFERENCES guardian(id) ON DELETE CASCADE,
  PRIMARY KEY (learner_id, guardian_id)
);
CREATE INDEX idx_lg_guardian ON learner_guardian(guardian_id);

-- ---------------------------------------------------------------------------
-- MONEY: fees, consent-gated levies, payments (partitioned)
-- ---------------------------------------------------------------------------
CREATE TABLE fee_structure (
  id        serial PRIMARY KEY,
  term_id   int NOT NULL REFERENCES term(id) ON DELETE CASCADE,
  class_id  int REFERENCES class(id) ON DELETE CASCADE,  -- NULL = all classes
  name      text NOT NULL,                               -- 'Tuition'
  amount    bigint NOT NULL CHECK (amount >= 0),         -- cents
  is_optional boolean NOT NULL DEFAULT false,            -- levy requires consent
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (term_id, class_id, name)
);

CREATE TABLE fee_item (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id    uuid NOT NULL REFERENCES learner(id) ON DELETE CASCADE,
  structure_id  int REFERENCES fee_structure(id) ON DELETE SET NULL,
  term_id       int NOT NULL REFERENCES term(id) ON DELETE RESTRICT,
  name          text NOT NULL,
  amount        bigint NOT NULL CHECK (amount >= 0),
  is_optional   boolean NOT NULL DEFAULT false,
  consent_id    uuid,                        -- FK added below (circular)
  source        text NOT NULL DEFAULT 'structure',  -- 'structure'|'store'|'library'|'manual'
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fee_item_learner ON fee_item(learner_id, term_id);

-- THE CONSENT LEDGER — ODPC-grade: every optional levy, every photo, every
-- opt-in records who decided, when, on what channel, with what evidence.
CREATE TABLE consent (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type  text NOT NULL CHECK (subject_type IN ('fee_levy','photo_publish','wa_opt_in','data_processing','trip')),
  subject_ref   text,                        -- fee_item.id / learner photo / etc
  guardian_id   uuid NOT NULL REFERENCES guardian(id) ON DELETE RESTRICT,
  learner_id    uuid REFERENCES learner(id) ON DELETE SET NULL,
  choice        consent_choice NOT NULL,
  channel       text NOT NULL,               -- 'whatsapp_button','web','paper_signed'
  evidence_key  text,                        -- MinIO key: signed form scan, WA msg id
  decided_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_consent_subject ON consent(subject_type, subject_ref);
ALTER TABLE fee_item
  ADD CONSTRAINT fk_fee_item_consent FOREIGN KEY (consent_id) REFERENCES consent(id);

-- Balance view: optional items count ONLY when consented (granted, not revoked)
CREATE VIEW v_fee_balance AS
SELECT l.id AS learner_id,
       COALESCE(SUM(CASE WHEN fi.is_optional = false OR c.choice = 'granted'
                         THEN fi.amount ELSE 0 END), 0) AS due_cents
FROM learner l
LEFT JOIN fee_item fi ON fi.learner_id = l.id
LEFT JOIN consent   c  ON c.id = fi.consent_id AND c.choice IN ('granted','revoked')
GROUP BY l.id;

-- M-PESA: idempotency is the #1 production rule (unique receipt numbers)
CREATE TABLE mpesa_txn (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_request_id text UNIQUE NOT NULL,
  mpesa_receipt_no    text UNIQUE,           -- NULL until success; unique => idempotent
  learner_id          uuid REFERENCES learner(id) ON DELETE SET NULL,
  guardian_phone      text NOT NULL,
  amount              bigint NOT NULL CHECK (amount > 0),
  state               payment_state NOT NULL DEFAULT 'pending',
  result_code         int,
  result_desc         text,
  raw_callback        jsonb,
  initiated_at        timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz
);
CREATE INDEX idx_mpesa_pending ON mpesa_txn(initiated_at) WHERE state = 'pending';

CREATE TABLE payments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id   uuid NOT NULL REFERENCES learner(id) ON DELETE CASCADE,
  amount       bigint NOT NULL CHECK (amount > 0),
  method       payment_method NOT NULL,
  state        payment_state NOT NULL DEFAULT 'confirmed',
  reference    text,                          -- bank slip / cheque no
  receipt_no   text UNIQUE NOT NULL,
  mpesa_txn_id uuid UNIQUE REFERENCES mpesa_txn(id),  -- 1:1, dedupes callbacks
  recorded_by  uuid REFERENCES staff(id) ON DELETE SET NULL,
  paid_at      timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_learner ON payments(learner_id, paid_at DESC);
CREATE INDEX idx_payments_state ON payments(paid_at) WHERE state = 'confirmed';
-- NOTE: deliberately NOT partitioned. receipt_no/mpesa_txn_id uniqueness must
-- hold ACROSS partitions (M-Pesa idempotency), and Postgres requires unique
-- constraints on partitioned tables to include the partition key. Revisit
-- monthly partitioning only if a future unique-free design emerges.

CREATE TABLE receipts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id  uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  paid_at     timestamptz NOT NULL,
  pdf_key     text NOT NULL                  -- MinIO object
);

-- ---------------------------------------------------------------------------
-- CLASSROOM: attendance (partitioned), assessment, report cards
-- ---------------------------------------------------------------------------
CREATE TABLE attendance (
  id         bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
  learner_id uuid NOT NULL REFERENCES learner(id) ON DELETE CASCADE,
  day        date NOT NULL,
  mark       attendance_mark NOT NULL,
  marked_by  uuid REFERENCES staff(id) ON DELETE SET NULL,
  client_id  uuid,                            -- offline device id (conflict trace)
  synced_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (learner_id, day, id)
) PARTITION BY RANGE (day);
CREATE INDEX idx_att_day    ON attendance USING brin (day);
CREATE INDEX idx_att_marked ON attendance(day, mark);

-- CBC assessment: scheme is DATA, not code (plansmith rule)
CREATE TABLE assessment (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id  uuid NOT NULL REFERENCES learner(id) ON DELETE CASCADE,
  term_id     int NOT NULL REFERENCES term(id) ON DELETE RESTRICT,
  subject     text NOT NULL,
  strand      text,                            -- CBC strand
  sub_strand  text,
  exam_type   exam_type NOT NULL,
  score       numeric(5,2) CHECK (score >= 0),
  grade       grade_level,                     -- computed, stored for reports
  published   boolean NOT NULL DEFAULT false,
  recorded_by uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_id, term_id, subject, strand, exam_type)
);
CREATE INDEX idx_assessment_pub ON assessment(term_id, subject) WHERE published;

-- ---------------------------------------------------------------------------
-- TALK: messages + announcements (partitioned sends)
-- ---------------------------------------------------------------------------
CREATE TABLE announcement (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  body       text NOT NULL,
  audience   jsonb NOT NULL,                  -- {class:'G7B'} | {all:true} | {learners:[ids]}
  urgency    text NOT NULL DEFAULT 'update' CHECK (urgency IN ('alert','update')),  -- alert=push+SMS, update=digest
  channel    message_channel NOT NULL DEFAULT 'whatsapp',
  created_by uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE message (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  announcement_id uuid REFERENCES announcement(id) ON DELETE SET NULL,
  guardian_id     uuid NOT NULL REFERENCES guardian(id) ON DELETE CASCADE,
  learner_id      uuid REFERENCES learner(id) ON DELETE SET NULL,
  channel         message_channel NOT NULL,
  state           message_state NOT NULL DEFAULT 'queued',
  wa_message_id   text UNIQUE,                -- provider id => dedupe
  body_hash       text,                       -- cross-channel dedupe key
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz
);
CREATE INDEX idx_msg_queue ON message(created_at) WHERE state = 'queued';
CREATE INDEX idx_msg_guardian ON message(guardian_id, created_at DESC);
-- NOTE: NOT partitioned — wa_message_id uniqueness must hold globally for
-- provider-callback dedupe (same Postgres rule as payments above).

-- ---------------------------------------------------------------------------
-- HOMEWORK & STUDY (the anti-LMS: light, offline-first)
-- ---------------------------------------------------------------------------
CREATE TABLE homework (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id   int NOT NULL REFERENCES class(id) ON DELETE CASCADE,
  subject    text NOT NULL,
  title      text NOT NULL,
  body       text NOT NULL,
  due_on     date,
  pdf_key    text,                            -- low-data attachment in MinIO
  created_by uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE homework_submission (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id uuid NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  learner_id  uuid NOT NULL REFERENCES learner(id) ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  score       numeric(5,2),
  UNIQUE (homework_id, learner_id)
);

-- ---------------------------------------------------------------------------
-- LIBRARY DESK + STORE DESK (thin layers over Money)
-- ---------------------------------------------------------------------------
CREATE TABLE library_item (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  isbn        text,
  title       text NOT NULL,
  author      text,
  category    text,
  copies_total int NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE library_copy (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id   uuid NOT NULL REFERENCES library_item(id) ON DELETE CASCADE,
  barcode   text UNIQUE NOT NULL,
  condition text NOT NULL DEFAULT 'good',
  with_learner uuid REFERENCES learner(id) ON DELETE SET NULL,  -- NULL = on shelf
  due_on    date
);
CREATE TABLE library_loan (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  copy_id   uuid NOT NULL REFERENCES library_copy(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL REFERENCES learner(id) ON DELETE CASCADE,
  issued_by uuid REFERENCES staff(id) ON DELETE SET NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  returned_at timestamptz
);
CREATE INDEX idx_loan_open ON library_loan(learner_id) WHERE returned_at IS NULL;

CREATE TABLE stock_item (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,                   -- 'School Uniform Blazer'
  category   text NOT NULL DEFAULT 'store',   -- 'store'|'asset'
  unit_price bigint NOT NULL CHECK (unit_price >= 0),   -- auto-bills to fee_item
  qty_on_hand int NOT NULL DEFAULT 0 CHECK (qty_on_hand >= 0),
  low_stock_threshold int NOT NULL DEFAULT 5,
  asset_tag  text UNIQUE,                     -- for assets: laptops, lab kit
  custodian  uuid REFERENCES staff(id) ON DELETE SET NULL,
  location   text
);
CREATE TABLE stock_movement (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id    uuid NOT NULL REFERENCES stock_item(id) ON DELETE CASCADE,
  delta      int NOT NULL,                    -- +in / -out
  learner_id uuid REFERENCES learner(id) ON DELETE SET NULL,  -- issue-to-student
  fee_item_id uuid REFERENCES fee_item(id) ON DELETE SET NULL, -- billed?
  by_staff   uuid REFERENCES staff(id) ON DELETE SET NULL,
  note       text,
  moved_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_item ON stock_movement(item_id, moved_at DESC);

-- ---------------------------------------------------------------------------
-- ALUMNI LIFECYCLE (graduation = state change, not a new database)
-- ---------------------------------------------------------------------------
CREATE TABLE alumni_profile (
  learner_id    uuid PRIMARY KEY REFERENCES learner(id) ON DELETE CASCADE,
  graduated_on  date NOT NULL,
  final_class   text,
  mentor_available boolean NOT NULL DEFAULT false,
  directory_visible boolean NOT NULL DEFAULT false,  -- consent-gated listing
  notes         text
);

-- ---------------------------------------------------------------------------
-- AUDIT LOG (who changed money and grades — partitioned, append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
  id         bigint GENERATED ALWAYS AS IDENTITY,
  actor_id   uuid,                            -- staff or guardian
  actor_kind text NOT NULL CHECK (actor_kind IN ('staff','guardian','system')),
  action     text NOT NULL,                   -- 'fee.concession','payment.record','grade.change'
  entity     text NOT NULL,
  entity_id  text NOT NULL,
  before     jsonb,
  after      jsonb,
  at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, at)
) PARTITION BY RANGE (at);
CREATE INDEX idx_audit_entity ON audit_log(entity, entity_id, at DESC);

-- ---------------------------------------------------------------------------
-- updated_at trigger (sync clients rely on it)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_learner_touch  BEFORE UPDATE ON learner  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_guardian_touch BEFORE UPDATE ON guardian FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------------------------------------------------------------------------
-- DASHBOARD MATERIALIZED VIEWS (large schools: never scan 90M rows live)
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW mv_collection_by_class AS
SELECT c.id AS class_id, c.name,
       SUM(fi.amount) FILTER (WHERE fi.is_optional = false) AS billed_cents,
       COALESCE(SUM(p.amount),0) AS paid_cents
FROM class c
JOIN learner l  ON l.class_id = c.id
LEFT JOIN fee_item fi ON fi.learner_id = l.id
LEFT JOIN payments p  ON p.learner_id = l.id AND p.state = 'confirmed'
GROUP BY c.id, c.name;
CREATE UNIQUE INDEX idx_mv_collection ON mv_collection_by_class(class_id);
-- refreshed by worker nightly + after reconciliation runs
