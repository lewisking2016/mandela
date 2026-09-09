-- ============================================================================
-- MANDELA — SCHOOL DB MIGRATION 006: QUOTE BAND FIELDS
-- The landing's ink motto band (serif quote + attribution) is content the
-- school owns, so it lives in school_settings like every other word.
-- ============================================================================

ALTER TABLE school_settings
  ADD COLUMN IF NOT EXISTS quote_text  text,
  ADD COLUMN IF NOT EXISTS quote_author text;

UPDATE school_settings
SET quote_text = 'Education is the most powerful weapon which you can use to change the world.',
    quote_author = 'Nelson Rolihlahla Mandela'
WHERE id = 'default' AND quote_text IS NULL;
