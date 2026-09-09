/**
 * Typed token constants — the TS mirror of tokens.css (v4, comp-derived).
 * NativeWind / Expo reads these directly (no CSS cascade there).
 * Import from `@mandela/ui/theme` in mobile code; web should prefer
 * Tailwind classes so CSS variables can theme per-school.
 *
 * Brand story (see tokens.css for the full note):
 * The logo is monochrome ink on paper, so the system is ink + paper.
 * Chroma is reserved for MEANING: green = money received / present,
 * amber = attention, red = act now. No gradients — flat color only.
 * Type: Instrument Serif display / Inter UI / Geist Mono micro-labels.
 */
export const colors = {
  ink: {
    950: "#020202",
    900: "#171717",
    800: "#272727",
    700: "#383838",
    600: "#575758",
    500: "#686868",
    400: "#868686",
    300: "#a9a9a9",
    200: "#bababa",
  },
  paper: {
    50: "#fbfbfc",
    100: "#f1f1f2",
    200: "#e8e8e8",
    300: "#d8d8d8",
    400: "#c7c7c7",
  },
  ok: "#198754",
  danger: "#c92a2a",
  warn: "#a16207",
} as const;

/** Light/dark semantic pairs — pick by useColorScheme() at runtime. */
export const semantic = {
  light: {
    bg: colors.paper[50],
    surface: "#ffffff",
    border: colors.paper[300],
    text: colors.ink[900],
    textMuted: colors.ink[600],
    primary: colors.ink[950],
    primaryHover: colors.ink[800],
    onPrimary: "#ffffff",
    ring: colors.ink[900],
    brandDeep: colors.ink[950],
    brandDeepContrast: "#f4f4f5",
    ok: colors.ok,
    okBg: "#e6f4ed",
    danger: colors.danger,
    dangerBg: "#fdecec",
    warn: colors.warn,
    warnBg: "#fefce8",
  },
  dark: {
    bg: "#0c0c0d",
    surface: "#131315",
    border: "#262628",
    text: "#f2f2f2",
    textMuted: "#a9a9a9",
    primary: "#ffffff",
    primaryHover: "#d8d8d8",
    onPrimary: "#0c0c0d",   /* 19.3:1 on white — AAA */
    ring: "#d8d8d8",
    brandDeep: "#000000",
    brandDeepContrast: "#e8e8e8",
    ok: "#4ad295",
    okBg: "#0e2b1f",
    danger: "#f28b82",
    dangerBg: "#2e1414",
    warn: "#f4b860",
    warnBg: "#2b2210",
  },
} as const;

export type MandelaTheme = (typeof semantic)["light"];

export const spacing = {
  s1: 4, s2: 8, s3: 12, s3h: 14, s4: 16,
  s5: 24, s6: 32, s7: 48, s8: 72, s9: 96,
  /** minimum touch target (mobile-design skill: 44px+, we ship 48px) */
  tap: 48,
} as const;

export const radius = { sm: 12, DEFAULT: 18, lg: 24, pill: 999 } as const;

/** fluid type — clamp() works on web; mobile uses the computed sizes */
export const type = {
  xs: 13, sm: 15, md: 17, lg: 22, xl: 34,
  num: 40,        // KPI numerals (max of --text-num clamp)
  display: 46,    // serif page titles (max of --text-display clamp)
  hero: 76,       // landing hero (max of --text-hero clamp)
} as const;

/** the three families, mirrored for NativeWind */
export const fontFamily = {
  sans: "Inter",
  serif: "Instrument Serif",
  mono: "Geist Mono",
} as const;
