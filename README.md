# MANDELA — School Management, Rebuilt Simple

*"Education is the most powerful weapon which you can use to change the world."*
**Built for liberation. Designed for simplicity.**

Minimal modules, everything included, zero training required.
Five modules: **People · Money · Classroom · Talk · Insights** — plus optional
**Library Desk** and **Store Desk**, and the Alumni lifecycle.

---

## Repository layout

```
mandela/
├─ frontend/            # the web app (Vercel)
│  └─ packages/
│     └─ ui/            # @mandela/ui — the shared design system
│        ├─ tokens.css          # single source of visual truth (light + dark)
│        ├─ tailwind.preset.ts  # Tailwind v4 preset (web + NativeWind)
│        └─ src/                # RoleShell, Button, Card/Money, Skeleton...
│
├─ backend/             # the API + services (VPS, Docker)
│  ├─ db/
│  │  ├─ school/        # per-school schema (001_schema.sql, 002_rls.sql)
│  │  ├─ control/       # provisioner control-plane schema
│  │  └─ powersync/     # offline sync rules (per-role scopes)
│  └─ docs/
│     └─ PROVISIONER.md # school provisioning pipeline spec
│
├─ mobile/              # Expo (React Native) app — parents + teachers (offline)
│  └─ README.md         # scope, stack, contracts with the design system
│
├─ desktop/             # Tauri 2 app — admin office, bursar, printing
│  └─ README.md         # scope, stack, packaging
│
└─ .agents/             # workspace skills (design, security, DB, Next.js...)
```

## Surfaces → hosting

| Surface | App | Hosted on |
|---|---|---|
| Web | Next.js 15 (App Router) | **Vercel** |
| API / backend | NestJS + Postgres 16 + Redis + MinIO + PowerSync | **Your VPS** (Docker) |
| Mobile | Expo (React Native), offline-first | EAS Build / stores |
| Desktop | Tauri 2 (wraps the web UI) | MSI/DMG/AppImage |

## Non-negotiables (enforced in code, not vibes)

1. **3-tap rule** — `RoleShell` limits every role to ≤5 tabs; adding a 4th
   level of nav is a product decision, not a dev shortcut.
2. **Money is integer cents** (`bigint`) everywhere — DB, API, UI (`Money`
   component). Never floats.
3. **One gold primary action per screen** — `Button variant="primary"`.
4. **Skeletons, never spinners** — optimistic updates on money/attendance.
5. **Permissions in the database** — per-school DB + RLS (layer 1–2), API
   guards (layer 3). The UI never *grants* rights, only reflects them.
6. **Consent is a ledger** — every parent consent is append-only and auditable
   (Kenya DPA).

## Shared-token contract

All three surfaces import the same design tokens:

- Web: `frontend/packages/ui/tokens.css` + `tailwind.preset.ts`
- Mobile (NativeWind): `@mandela/ui/theme` (TS mirror) + same preset
- Desktop: renders the web UI — inherits everything

## Status

- [x] Market & competitor research (dossier in thread history)
- [x] Architecture decision (monorepo, VPS backend, Vercel frontend)
- [x] Database schemas (school + control-plane + sync rules)
- [x] Provisioner spec (`backend/docs/PROVISIONER.md`)
- [x] Design system v1 (`frontend/packages/ui`)
- [x] Monorepo tooling (pnpm workspaces + Turbo)
- [x] NestJS API skeleton + provisioner implemented (`backend/apps/api`)
- [x] End-to-end verified: bootstrap → provision school → RLS isolation test → live REST API
- [x] Next.js web app (`frontend/apps/web`) — landing, login, role shells, dashboards,
      attendance marking, money (collections + record payment), homework, broadcast,
      insights. Branding, nav labels, modules and the logo mark all come from the DB.
- [x] Design system v2: monochrome ink-and-paper palette sampled from `mandela.png`;
      chroma reserved for status; zero gradients (hard rule in `tokens.css`)
- [ ] better-auth integration (login, phone-OTP for parents)
- [ ] WhatsApp bot v1 · Expo app (`mobile/`) · Tauri shell (`desktop/`)

## Quick start (dev — no Docker needed)

```bash
pnpm install
pnpm bootstrap:db        # starts embedded Postgres, sets up control plane
pnpm provision:school    # creates + migrates + seeds the demo school
pnpm --filter @mandela/api test:rls   # proves data isolation between roles
pnpm dev                 # runs the API (PORT=4000)
pnpm seed:demo           # staff, learners, fees, payments, attendance, homework
pnpm trace:logo          # mandela.png -> scripts/logo-traced.json (SVG path)
pnpm seed:branding       # loads the traced logo + role nav into school_settings

# Then the web app (second terminal):
pnpm --filter @mandela/web dev   # http://localhost:3000

# Demo logins (dev — email match only, better-auth arrives in v2):
#   principal@demo.mandela.school · teacher@demo.mandela.school · bursar@demo.mandela.school
#   guardians: phone 254733000001..5 (login with 0733000001 form)

# Provision a real school:
pnpm provision:school '{"name":"St Mary''s","slug":"stmarys","admin":{"name":"J. Doe","email":"jd@stmarys.ac.ke","phone":"254712345678"}}'
```

The dev database is a user-space Postgres 17 (no admin rights, no service).
On the VPS, `docker compose -f backend/docker-compose.yml up -d` replaces it.
If port 54329 is taken, set `DEV_PG_PORT` (see `backend/.env.example`).
