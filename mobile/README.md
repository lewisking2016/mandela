# MANDELA Mobile App — Expo (React Native)

**Surfaces:** parents + teachers (offline-first). Later: driver app (v2).

## Stack (locked by architecture research)
- **Expo SDK (React Native)** — TypeScript, same language as web/desktop
- **Expo Router** — file-based routing, mirrors the Next.js mental model
- **NativeWind v4** — Tailwind classes in RN; consumes
  `../frontend/packages/ui/tailwind.preset.ts` + `../frontend/packages/ui/src/theme.ts`
  so mobile shares the exact design tokens of web/desktop
- **FlashList** — virtualized lists for huge class/learner rosters
- **MMKV** — instant local storage
- **PowerSync RN SDK** — offline-first sync against the backend (per-role scopes)

## Contract with the rest of the monorepo
- **Never hardcode colors/spacing** — import tokens from `@mandela/ui/theme`
  (the TS mirror of `frontend/packages/ui/tokens.css`).
- **Navigation = RoleShell tabs** — `useRole()` from `@mandela/ui` defines the
  ≤5 tabs per role; the RN tab bar renders exactly those.
- **Validation** — shared Zod schemas from `packages/schemas` (when created);
  no hand-rolled request/response types.
- **Motion** — map `@mandela/ui/motion` presets to Reanimated 3 (same
  durations/easings; respect reduced motion).

## Screens (MVP)
| Role | Screens |
|---|---|
| Parent | Home (5 jobs), Pay (M-Pesa STK push), Homework, Messages, Profile |
| Teacher | Today (register), Mark, Homework, Messages, Class |

## Build & release
- **EAS Build** for store binaries; **EAS Update** for OTA fixes (parents never
  re-download for a patch).
- App icons/splash generated from the design-system brand tokens.
