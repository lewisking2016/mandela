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
    <div>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-4 h-12 w-2/3 rounded-lg" />
      <Skeleton className="mt-2 h-4 w-1/2" />
      <div className="mt-8 grid gap-s3h sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-44 rounded" />
        <Skeleton className="h-44 rounded" />
        <Skeleton className="h-44 rounded" />
      </div>
      <div className="mt-s3h grid gap-s3h lg:grid-cols-3">
        <Skeleton className="h-56 rounded lg:col-span-2" />
        <Skeleton className="h-56 rounded" />
      </div>
    </div>
  );
}
