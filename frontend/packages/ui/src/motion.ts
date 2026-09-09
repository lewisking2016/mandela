/**
 * Motion presets — one motion vocabulary across surfaces.
 * Web: Framer Motion (motion/react). Mobile: Reanimated 3.
 * These constants are framework-agnostic; each app maps them.
 *
 * high-end-visual-design: motion should feel like weight, not decoration.
 * performance-engineer: animate only transform/opacity; all durations < 400ms.
 */

export const easing = {
  /** the signature ease — fast start, long settle */
  mandela: [0.22, 1, 0.36, 1],
  inOut: [0.65, 0, 0.35, 1],
} as const;

export const duration = {
  micro: 0.12,   // haptic-equivalent, button states
  fast: 0.22,    // cards, list items
  base: 0.3,     // page/panel transitions
  slow: 0.4,     // hero moments only (bursary card, onboarding)
} as const;

export const spring = {
  /** default — confident, never bouncy-cartoonish */
  confident: { type: "spring", stiffness: 420, damping: 34, mass: 0.9 },
  /** for drag/press physics */
  tactile: { type: "spring", stiffness: 700, damping: 40, mass: 0.6 },
} as const;

/** Stagger children by this many seconds in lists/dashboards. */
export const stagger = 0.045;

/** Web (Framer Motion) variants. */
export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1 },
};

/**
 * Skeleton shimmer — skeletons, never spinners.
 * Runs on transform only; GPU-safe.
 */
export const shimmer = {
  animate: { backgroundPositionX: ["-200%", "200%"] },
  transition: { duration: 1.4, repeat: Infinity, ease: "linear" },
};

/** Rules enforced in code review:
 *  - pressable scale: 0.98 max, 120ms
 *  - nothing above 400ms except onboarding/hero
 *  - respects prefers-reduced-motion / useReducedMotion()
 */
