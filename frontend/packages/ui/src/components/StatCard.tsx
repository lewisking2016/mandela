import { cn } from "../cn";
import { Money } from "./Card";
import { KpiCard } from "./Kpi";

/**
 * StatCard — legacy API, now rendered with the comp KpiCard.
 * Labels/subtext come from the API payload; money is integer cents; status
 * uses the same StatusTone vocabulary (ok/warn/danger/neutral).
 */
export function StatCard({
  label,
  cents,
  sub,
  tone,
  className,
  action,
}: {
  label: string;
  cents: number | bigint;
  sub?: string;
  tone?: "ok" | "warn" | "danger" | "neutral";
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <KpiCard
      label={label}
      value={<Money cents={cents} />}
      note={sub}
      tone={tone}
      className={className}
    >
      {action ? null : undefined}
    </KpiCard>
  );
}
