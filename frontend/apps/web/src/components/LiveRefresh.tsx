"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Live } from "@mandela/ui";

/**
 * LiveRefresh — makes RSC pages feel live without killing the server:
 * polls a cheap server action (the watcher) every N seconds; when the
 * payload hash changes it calls router.refresh() so the Server Components
 * re-render with fresh data. Pauses when the tab is hidden. The indicator
 * announces updates politely for screen readers.
 */
export function LiveRefresh({
  watch,
  intervalMs = 15000,
  label = "LIVE",
}: {
  watch: () => Promise<string>;
  intervalMs?: number;
  label?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const hashRef = useRef<string | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function tick() {
      if (!alive || document.hidden || pendingRef.current) return;
      pendingRef.current = true;
      try {
        const next = await watch();
        if (hashRef.current !== null && hashRef.current !== next) {
          startTransition(() => router.refresh());
        }
        hashRef.current = next;
        setUpdatedAt(new Date());
      } catch {
        /* offline: keep polling quietly */
      } finally {
        pendingRef.current = false;
      }
    }

    void tick();
    timer = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [watch, intervalMs, router, startTransition]);

  return (
    <span
      className="inline-flex items-center gap-2"
      title={updatedAt ? `Updated ${updatedAt.toLocaleTimeString("en-KE")}` : undefined}
    >
      <Live label={label} />
      {updatedAt ? (
        <span className="font-mono text-[10.5px] text-ink-400 tabular-nums">
          {updatedAt.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
        </span>
      ) : null}
    </span>
  );
}

/**
 * LiveClock — a small ticking clock for headers (reduced-motion aware:
 * updates once a minute instead of every second).
 */
export function LiveClock({ className }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), reduced ? 60000 : 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return <span className={className}>&nbsp;</span>; // hydration-safe
  return (
    <time dateTime={now.toISOString()} className={className}>
      {now.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </time>
  );
}
