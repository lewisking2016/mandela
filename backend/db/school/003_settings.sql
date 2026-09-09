-- ============================================================================
-- MANDELA — SCHOOL DB MIGRATION 003: SCHOOL SETTINGS (branding as data)
-- Everything the web app renders about the school's identity comes from
-- here — never hardcoded. One row (id = 'default') per school database.
-- Applied by the provisioner's checksummed migration runner.
-- ============================================================================

CREATE TABLE school_settings (
  id              text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  name            text NOT NULL,
  tagline         text,
  logo_svg_path   text,          -- traced mark rendered by <MandelaMark>
  logo_aspect     numeric(6,4) NOT NULL DEFAULT 1.0,
  motto           text,
  contact_phone   text,
  contact_email   text,
  contact_address text,
  -- per-school theme overrides (NULL = product default ink/paper tokens)
  theme_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  nav_json        jsonb NOT NULL DEFAULT '{}'::jsonb,  -- role -> tab labels override
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- One row, seeded by the provisioner with the school's real name/tagline.
INSERT INTO school_settings (id, name) VALUES ('default', 'School')
ON CONFLICT (id) DO NOTHING;
