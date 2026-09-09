"use client";

import { LiveRefresh, LiveClock } from "@/components/LiveRefresh";

/**
 * AppLiveBar — the shell's "alive" strip: polls /api/watch every 15s and
 * refreshes the RSC tree when school data changes; shows the ticking clock.
 */
export function AppLiveBar() {
  return (
    <div className="flex items-center gap-3">
      <LiveClock className="hidden font-mono text-[10.5px] text-ink-400 tabular-nums md:inline" />
      <LiveRefresh
        intervalMs={15000}
        label="LIVE"
        watch={async () => {
          const r = await fetch("/api/watch", { cache: "no-store" });
          if (!r.ok) throw new Error("watch");
          const body = (await r.json()) as { hash?: string };
          return body.hash ?? "0";
        }}
      />
    </div>
  );
}
