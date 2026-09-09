import { cn } from "../cn";

/**
 * Card — the comp's surface: 18px radius, hairline border, ambient shadow.
 * Flat color only — depth is shadow + space, never gradients.
 */
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded border border-border bg-surface p-s5 shadow-1", className)}>
      {children}
    </section>
  );
}

/**
 * CardHead — comp header: bold 15.5px title + quiet sub, optional right link.
 * Replaces the old uppercase CardTitle (kept below for existing callers).
 */
export function CardHead({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <header className="mb-s4 flex items-start justify-between gap-s3">
      <div className="min-w-0">
        <h2 className="text-[15.5px] font-semibold leading-snug tracking-[-0.01em]">{title}</h2>
        {sub ? <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{sub}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

/** CardTitle — legacy API (uppercase micro title). Kept for older screens. */
export function CardTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <header className="mb-s4 flex items-center justify-between">
      <h2 className="microlabel">{title}</h2>
      {action}
    </header>
  );
}

/**
 * Money — ALWAYS integer cents in, formatted once. Never floats in UI.
 * Mirrors backend schema: money is bigint cents serialized as string.
 */
export function Money({ cents, className }: { cents: number | bigint | string; className?: string }) {
  const raw = typeof cents === "string" ? Number(cents) : Number(cents);
  if (!Number.isFinite(raw) || !Number.isInteger(raw)) {
    throw new Error(`Money: expected integer cents, got ${String(cents)}`);
  }
  const value = raw / 100;
  const formatted = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
  return <span className={cn("tabular-nums", className)}>{formatted}</span>;
}

export type StatusTone = "ok" | "warn" | "danger" | "neutral";

const tones: Record<StatusTone, string> = {
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
  neutral: "bg-paper-100 text-muted",
};

/** StatusPill — paid / partial / due / overdue states, colorblind-safe (icon + text). */
export function StatusPill({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  const icon = tone === "ok" ? "✓" : tone === "warn" ? "!" : tone === "danger" ? "✕" : "•";
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-semibold", tones[tone])}
      aria-label={String(children)}
    >
      <span aria-hidden>{icon}</span>
      {children}
    </span>
  );
}

/** Microlabel — mono uppercase tracked label, the comp's signature micro-typography. */
export function Microlabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("microlabel", className)}>{children}</p>;
}
