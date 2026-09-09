import { cn } from "../cn";

/**
 * SerifHeader — the comp's page opening: mono crumb eyebrow, serif display
 * headline with italic `<em>` emphasis, optional right-side actions.
 */
export function SerifHeader({
  crumb,
  title,
  sub,
  actions,
  className,
}: {
  crumb?: string;
  title: React.ReactNode; // wrap emphasis words in <em>
  sub?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-s4", className)}>
      <div className="min-w-0">
        {crumb ? <p className="microlabel">{crumb}</p> : null}
        <h1 className="display mt-s2 text-display text-ink-950">{title}</h1>
        {sub ? <p className="mt-2.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">{sub}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-s2.5">{actions}</div> : null}
    </div>
  );
}

/** PageCrumb — standalone mono eyebrow for surfaces without a serif title. */
export function PageCrumb({ children }: { children: React.ReactNode }) {
  return <p className="microlabel">{children}</p>;
}
