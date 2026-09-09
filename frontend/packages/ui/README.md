# @mandela/ui — Design System v1.0

Premium, calm, zero-training UI for all three surfaces (Next.js web, Expo via
NativeWind, Tauri desktop). Built on **shadcn/ui patterns + Radix primitives +
Tailwind v4 tokens**. The 3-tap rule is enforced structurally by `RoleShell`.

This package lives at `frontend/packages/ui` and is consumed by the web app,
the Expo mobile app (via NativeWind), and the Tauri desktop shell.

## Files
```
frontend/packages/ui/
├─ tokens.css           # single source of visual truth (light + dark)
├─ tailwind.preset.ts   # Tailwind v4 preset: tokens -> utilities (web + NativeWind)
└─ src/
   ├─ theme.ts          # typed token constants for TS/mobile
   ├─ motion.ts         # Framer Motion / Reanimated presets
   ├─ RoleShell.tsx     # the 3-tap navigation shell per role
   └─ components/       # shadcn-style primitives (Button, Card, Money, StatusPill...)
```

## Principles enforced here
1. One ink primary action per screen (everything else is quiet).
2. 48px minimum touch targets; fluid type; AA contrast in both themes.
3. Skeletons, never spinners; optimistic updates on every money/attendance write.
4. Every screen states its answer in plain words ("Term 3 balance: KES 29,500 — Pay").
5. Dark mode from the same tokens — no per-screen theming.
6. Zero gradients — flat color only; depth from shadow and space.

## v4 — comp-derived surfaces (scripts/design/*.html)
- `Card` uses 18px radius + ambient shadow. `CardHead` = title + sub + action (the comp header); `CardTitle` remains for uppercase micro-titles.
- `KpiCard` / `Meter` / `Delta` — the stat unit from the comps (microlabel → fluid numeral → note → meter/delta). One `ink` card per screen is the visual anchor.
- `SerifHeader` — mono crumb + serif display headline (emphasis via `<em>`).
- Type: Instrument Serif (display) / Inter (UI) / Geist Mono (micro-labels, numerals). Always `.numeral` for big money so digits align.
- Buttons are pills (`rounded-pill`); inputs stay 12px radius.

## Consuming apps MUST register the package as a Tailwind source

Tailwind v4's automatic content detection only scans the app's own tree.
Utilities used only inside `@mandela/ui` (e.g. `h-14`, `px-s6`, `inline-flex`)
are NOT generated unless the app declares:

```css
@source "../../packages/ui";   /* path relative to the app's globals.css */
```

Symptom if missing: buttons and chips collapse below their labels (no height,
no padding, no flex centering) while everything else looks fine.
