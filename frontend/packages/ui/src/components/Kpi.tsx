import { cn } from "../cn";

/**
 * KpiCard — the comp's stat unit: mono microlabel → huge fluid numeral →
 * note → optional delta pill or meter. `ink` renders the inverted anchor
 * card (one per screen). Numbers shrink fluidly (text-num) so "Ksh
 * 1,000,000" never spills its card.
 */
export function KpiCard({
  label,
  value,
  note,
  tone,
  ink,
  meter,
  delta,
  className,
  children,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  tone?: "ok" | "danger" | "warn" | "neutral";
  ink?: boolean;
  meter?: { value: number; ok?: boolean }; // 0..100
  delta?: { text: string; tone: "ok" | "warn" | "danger" | "neutral" };
  className?: string;
  children?: React.ReactNode;
}) {
  const toneText =
    tone === "ok" ? "text-ok" : tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : undefined;
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded border p-s5 shadow-1",
        ink ? "border-brand-deep bg-brand-deep text-brand-deep-contrast" : "border-border bg-surface",
        className,
      )}
    >
      <p className={cn("microlabel", ink && "text-ink-400")}>{label}</p>
      <p className={cn("numeral mt-s3 text-num font-semibold", toneText, ink && "text-brand-deep-contrast")}>
        {value}
      </p>
      {note ? <p className={cn("mt-2.5 text-[12.5px] leading-snug text-muted", ink && "text-ink-300")}>{note}</p> : null}
      {meter ? (
        <div className={cn("mt-auto pt-s4", meter.value >= 0 && "w-full")}>
          <Meter value={meter.value} ok={meter.ok} onInk={ink} />
        </div>
      ) : null}
      {delta ? (
        <div className="mt-s4">
          <Delta tone={delta.tone}>{delta.text}</Delta>
        </div>
      ) : null}
      {children ? <div className="mt-s4">{children}</div> : null}
    </section>
  );
}

/** Meter — the comp's progress bar. Ink fill on paper-100; green only when it means good. */
export function Meter({ value, ok, onInk, className }: { value: number; ok?: boolean; onInk?: boolean; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.75 w-full overflow-hidden rounded-pill", onInk ? "bg-deep-line" : "bg-paper-100", className)}
    >
      <div
        className={cn("h-full rounded-pill", ok ? "bg-ok" : onInk ? "bg-white" : "bg-primary")}
        style={{ width: `${pct}%` }}
      />
      {pct === 0 ? null : null}
    </div>
  );
}

const deltaTones: Record<"ok" | "warn" | "danger" | "neutral", string> = {
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
  neutral: "bg-paper-100 text-muted",
};

/** Delta — the comp's small change-pill under a KPI. */
export function Delta({ tone = "neutral", children }: { tone?: "ok" | "warn" | "danger" | "neutral"; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold", deltaTones[tone])}>{children}</span>;
}
