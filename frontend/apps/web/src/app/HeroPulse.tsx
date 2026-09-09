"use client";

import { useEffect, useState } from "react";
import { CountUp, CountUpMoney, Live, Meter } from "@mandela/ui";
import type { PublicPulse } from "@/lib/api";

/**
 * HeroPulse — the landing's live card. Numbers count up on arrival and
 * re-animate whenever the school's data changes (polls the public pulse
 * endpoint directly every 12s, pauses when the tab is hidden).
 */
export function HeroPulse({
  rate,
  present,
  expected,
  collectedTodayCents,
  activeLearners,
}: {
  rate: number | null;
  present: number;
  expected: number;
  collectedTodayCents: string;
  activeLearners: number;
}) {
  const [p, setP] = useState({ rate, present, expected, collectedTodayCents, activeLearners });

  useEffect(() => {
    let alive = true;
    async function tick() {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/pulse", { cache: "no-store" });
        if (!r.ok) return;
        const next = (await r.json()) as PublicPulse;
        if (alive) setP({ rate: next.rate, present: next.present, expected: next.expected, collectedTodayCents: next.collected_today_cents, activeLearners: next.active_learners });
      } catch {
        /* offline: keep last values */
      }
    }
    const t = setInterval(tick, 12000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <aside className="rounded-lg border border-border bg-surface p-s5 shadow-2 md:p-s6" aria-live="polite">
      <div className="flex items-center justify-between">
        <p className="microlabel">Today at school</p>
        <Live />
      </div>
      <p className="numeral mt-s3 text-[52px] font-semibold leading-none">
        {p.rate != null ? (
          <CountUp value={p.rate} format={(n) => (Math.round(n * 10) / 10).toFixed(1)} />
        ) : (
          "—"
        )}
        <span className="text-xl font-medium text-ink-500">%</span>
      </p>
      <div className="mt-2 flex items-baseline justify-between text-[13px] text-muted">
        <span>learners present</span>
        <span className="font-semibold tabular-nums text-text">
          <CountUp value={p.present} /> of <CountUp value={p.expected} />
        </span>
      </div>
      <div className="mt-s3">
        <Meter value={p.rate ?? 0} />
      </div>
      <div className="mt-s5 grid grid-cols-2 gap-s4 border-t border-paper-200 pt-s4">
        <div>
          <p className="microlabel">Collected today</p>
          <p className="numeral mt-1.5 text-[22px] font-semibold text-ok">
            <CountUpMoney cents={p.collectedTodayCents} />
          </p>
        </div>
        <div>
          <p className="microlabel">Active learners</p>
          <p className="numeral mt-1.5 text-[22px] font-semibold">
            <CountUp value={p.activeLearners} />
          </p>
        </div>
      </div>
    </aside>
  );
}
