-- ============================================================================
-- MANDELA — SCHOOL DB MIGRATION 005: LANDING MODULES AS DATA
-- The landing page's module cards come from the database, like everything
-- else the school presents about itself. Seeded with the five product
-- modules; editable per school in Settings.
-- ============================================================================

ALTER TABLE school_settings
  ADD COLUMN IF NOT EXISTS modules_json jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE school_settings
SET modules_json = '[
  {"title": "People", "body": "Learners, guardians, staff — one directory."},
  {"title": "Money", "body": "Fees, M-Pesa, receipts. Integer cents, always."},
  {"title": "Classroom", "body": "Attendance in two taps. CBC records as data."},
  {"title": "Talk", "body": "WhatsApp-first announcements and homework."},
  {"title": "Insights", "body": "The school''s health on one screen."}
]'::jsonb
WHERE id = 'default' AND modules_json = '[]'::jsonb;
