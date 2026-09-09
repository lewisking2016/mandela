# MANDELA Brand Colors — Ink & Paper, the logo's own system

> The logo (mandela.png) is monochrome ink on white. The design system is
> therefore **ink + paper**, with chroma reserved strictly for meaning.
> Every ramp value below is SAMPLED from the logo's own pixels.

## The palette and why

| Token | Hex | Role | Meaning |
|---|---|---|---|
| **Ink 950** | `#020202` | `--primary`, `--brand-deep`: buttons, sidebar, login | The logo's black. The primary action is the logo's own ink — the most confident thing on screen, 20.3:1 with a white label (AAA). |
| **Ink 900/700** | `#171717` / `#383838` | body text, headings, links on light | 10.3:1+ on white — AAA body text. The logo's mark never shouts; neither does its type. |
| **Ink 600/500** | `#575758` / `#686868` | muted text, labels | 5.7:1+ on white — AA small text. |
| **Ink 400/300** | `#868686` / `#a9a9a9` | icons, placeholders, disabled | 3.5:1 — large UI/icons only, never small text. |
| **Paper 50–400** | `#fbfbfc` → `#c7c7c7` | backgrounds, wells, borders | The logo's white and its anti-alias grays. `--border` = `#d8d8d8` (sampled). |
| **Status ok** | `#198754` | paid / present / confirmed | The only green in the system, and only where money or presence is real. Paired with icon + text (colorblind-safe). |
| **Status warn** | `#a16207` | due soon / needs attention | Amber says "look", never "fail". |
| **Status danger** | `#c92a2a` | overdue / failed / act now | Guardian mornings are stressful: red means "act now", never "you failed". Always paired with icon + text. |

## Usage rules (enforced by the design system)

1. **One primary action per screen** — `Button variant="primary"` is ink-950,
   the logo's black. Everything else is quiet secondary/ghost.
2. **Chroma is a status, not a decoration.** Green/amber/red appear ONLY in
   `StatusPill`, money states and attendance marks. No colored buttons,
   banners, or accents — the brand is monochrome, so those colors always
   mean something.
3. **NO GRADIENTS — anywhere.** Depth comes from shadow and space alone.
   No gradient banners, buttons, borders, text or glows. This is a hard rule.
4. **White text sits on ink-950/900 (AAA) and on ok/danger 600-level (AA+).**
   Never on ink-400 or paper ramps.
5. **Dark mode inverts the same ink/paper axis** (primary becomes white ink,
   `on-primary` becomes near-black) — both themes stay AA/AAA; the tokens
   encode this, don't override.
6. Per-school theming may override tokens in `school_settings` (DB-driven),
   but the ink/paper harmony is the product's voice.

## Where the tokens live

- `frontend/packages/ui/tokens.css` — CSS variables, light + dark (source of truth)
- `frontend/packages/ui/src/theme.ts` — TS mirror for NativeWind/Expo
- `frontend/packages/ui/tailwind.preset.ts` — Tailwind v4 utilities (`bg-primary`, `text-on-primary`, `bg-brand-deep`…)

## Type + motion (the rest of the feel)

- **Type (v4, from the design comps in `scripts/design/`):** Instrument Serif
  for display moments (greetings, page statements, the quote band — italic
  `em` is the signature emphasis), Inter for UI, Geist Mono for micro-labels
  (`.microlabel`) and all big numerals (`.numeral`, always tabular).
- **Shape:** cards 18px radius, inputs 12px, buttons/chips/pills 999px.
- **Motion:** one vocabulary in `src/motion.ts`; the signature ease is
  `cubic-bezier(.22,1,.36,1)`; nothing over 400ms except hero moments; the
  landing/dashboard use the `.rise` stagger (reduced-motion aware).
