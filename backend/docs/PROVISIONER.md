# MANDELA — Provisioner Service Specification v1.0

**Purpose:** turn "one school onboarding" into a single, idempotent, resumable
pipeline that creates a school database, TLS subdomain, credential vault,
PowerSync config, and admin seed — then keeps the fleet healthy.
**Runs on:** the VPS (Docker, beside Postgres/Caddy). **Control DB:** `mandela_control`.

---

## 1. Inputs & outputs

```
POST /v1/schools
{
  "name": "St Mary's Junior School",
  "slug": "stmarys",                    // ^[a-z][a-z0-9-]{2,30}$
  "county": "Nairobi",
  "tier": "standard" | "dedicated",
  "plan": "ubuntu" | "sizwe" | "longwalk",
  "admin": { "name": "...", "email": "...", "phone": "2547XXXXXXXX" },
  "credentials": {                      // optional at creation; vaulted when given
    "mpesa_shortcode": "...", "mpesa_consumer_key": "...",
    "mpesa_consumer_secret": "...", "mpesa_passkey": "...",
    "whatsapp_phone_id": "...", "whatsapp_token": "..."
  }
}
→ 202 Accepted { "school_id": "...", "job_id": "..." , "status_url": "/v1/jobs/{id}" }
```

Output when the pipeline finishes: a working school at
`https://<slug>.mandela.school` with its own database, integrations, and admin
login (phone-OTP seed, forced rename on first login).

---

## 2. The pipeline (9 steps, strict order, each idempotent)

| # | Step (`provision_job.kind`) | What it does | Idempotency key |
|---|---|---|---|
| 1 | `create_db` | `CREATE DATABASE mandela_<slug>` on the selected `db_node`; `CREATE ROLE` per-service grants | `<school_id>:create_db` |
| 2 | `run_migrations` | Apply `backend/db/school/001_schema.sql` + `002_rls.sql` + versioned upgrades (Flyway-style, tracked in `_mandela_migrations`) | `<school_id>:migrate:<checksum>` |
| 3 | `vault_credentials` | AES-256-GCM envelope-encrypt each credential into `school_credential` (master key from `/etc/mandela/keys/master.key`, mode 0600, never in DB/env) | `<school_id>:vault:<sha256(cred)>` |
| 4 | `register_caddy` | Append `stmarys.mandela.school → api-pool` block to the Caddy config dir; Caddy auto-provisions Let's Encrypt | `<school_id>:caddy` |
| 5 | `register_powersync` | Deploy `sync-rules.json` instance; wire token claims (role/user_id/guardian_id/staff_id) minted by better-auth JWTs | `<school_id>:powersync` |
| 6 | `seed_admin` | Create principal `staff` row + better-auth user in school DB; generate one-time invite (WhatsApp deep link with OTP) | `<school_id>:seed` |
| 7 | `register_paybill` *(optional)* | If mpesa creds present: sandbox ping + 1 KES live test; record result | `<school_id>:paybill` |
| 8 | `register_wa_templates` *(optional)* | Submit utility template set (absence alert, receipt, balance, consent request) for approval | `<school_id>:wa` |
| 9 | `verify` | Synthetic checks: TLS 200, login OTP works, sync handshake, health endpoints → flips `school.state` to `active` | `<school_id>:verify` |

**Rules**
- A job re-run never duplicates work: every step checks its idempotency key first.
- Any step fails → job marked `failed` with `last_error`; re-POST resumes from
  the first non-succeeded step. Steps 1–2 are transactional (rollback drops the
  partial DB on first-run failure).
- Onboarding SLA: standard < 15 min, dedicated < 40 min (needs a pinned node).

---

## 3. Tier placement

```
tier=standard  → pick db_node with fewest standard schools (register in
                 control DB); API lands in the shared pool.
tier=dedicated → operator picks/pins a node with dedicated capacity; the
                 provisioner creates: dedicated API container, dedicated
                 BullMQ workers (report-card pool sized to learners/50k),
                 dedicated PowerSync instance, dedicated backup schedule.
```

Plan enforcement lives here too: `learner_cap` from the plan (150/350/700/1500)
is compared nightly against `usage_daily.active_learners`; overages create a
`plan_review` alert to ops — the product never hard-blocks a school mid-term.

---

## 4. Degradation & lifecycle ops

| Operation | Behavior |
|---|---|
| **Suspend** (non-payment) | `school.state='suspended'` → Caddy serves a branded "contact office" page; DB stays intact; WhatsApp/M-Pesa credentials stay vaulted |
| **Export** (portability promise) | Per-school `pg_dump` + MinIO `mc mirror` → signed download link, 48h window |
| **Decommission** | Export → 30-day grace → `DROP DATABASE` + Caddy removal + vault shred (crypto-shredding: master-key child key deleted) |
| **Rotate credentials** | `PATCH /v1/schools/{id}/credentials` → new ciphertext + `rotated_at`; API workers hot-reload |
| **Resize** | standard→dedicated = move `db_name` to a dedicated node + spawn dedicated API; Caddy re-pointed atomically |

---

## 5. Security invariants (checked by `verify` and CI)

1. Vault ciphertext only — plaintext credentials never touch the control DB,
   logs, or web-app env.
2. `mandela_app` DB role has no superuser/BYPASSRLS in school databases.
3. Every school DB grants connect **only** to `mandela_app`, `mandela_powersync`,
   `mandela_jobs` (no `PUBLIC`).
4. Caddy TLS is auto + HSTS; school hosts are on an allowlist pattern.
5. Provisioner API auth: mTLS from ops CLI + short-lived JWT; audit rows in
   `audit_log` for every mutation.

---

## 6. Observability & runbook

- **Metrics:** provision duration per step, failure rate by step, fleet
  counts per node, per-school sync lag, message queue depth.
- **Alerts:** any `failed` job > 5 min; disk > 75% on a db_node; sync lag >
  60s for a dedicated school.
- **Runbook (crash recovery):**
  1. `GET /v1/jobs/{id}` → step + error.
  2. Fix external cause (e.g., DNS, node disk).
  3. `POST /v1/jobs/{id}/retry` — resumes idempotently.
  4. If `create_db` half-applied: the job's transactional guard drops the
     partial DB and recreates from scratch.

---

## 7. What the provisioner deliberately does NOT do

- No school-data migrations from competitor systems (separate Import Center
  service with CSV validation — plansmith's "migration is a project phase").
- No billing/charging (control DB records plan + loyalty; invoicing is ops).
- No multi-school data roll-ups inside school DBs (Insights aggregates live
  per-school; group dashboards read exports).
