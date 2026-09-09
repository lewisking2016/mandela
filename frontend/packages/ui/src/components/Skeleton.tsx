import { cn } from "../cn";

/**
 * Skeleton — the ONLY loading state in Mandela. No spinners.
 * Web: CSS animation on transform/background only (GPU-safe).
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded bg-paper-200", className)} />;
}

/** Pre-composed skeletons for the most common screens (fast perceived perf). */
export function HomeSkeleton() {
  return (
    <div className="space-y-s4">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-28 w-full" />
      <div className="grid grid-cols-2 gap-s3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
