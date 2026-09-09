import { cn } from "../cn";

/**
 * EmptyState — illustrated, teaching, never a dead end.
 * Every empty screen answers: what is this, what will appear, what can I do now.
 */
export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-dashed border-border bg-surface p-s6 text-center", className)}>
      <h3 className="text-md font-semibold text-text">{title}</h3>
      <p className="mx-auto mt-s2 max-w-sm text-sm text-muted">{body}</p>
      {action ? <div className="mt-s4 flex justify-center">{action}</div> : null}
    </div>
  );
}
