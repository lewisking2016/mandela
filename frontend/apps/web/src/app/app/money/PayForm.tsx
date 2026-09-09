"use client";

import { useState, useTransition } from "react";
import { Button } from "@mandela/ui";
import type { LearnerRow } from "@/lib/api";

const METHODS = ["mpesa", "cash", "bank", "cheque"] as const;

export function PayForm({
  learners,
  action,
}: {
  learners: LearnerRow[];
  action: (input: { learnerId: string; amountCents: number; method: string; reference?: string }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [learnerId, setLearnerId] = useState(learners[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("mpesa");
  const [reference, setReference] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const shillings = Number(amount);
    if (!learnerId || !Number.isFinite(shillings) || shillings <= 0) {
      setMsg("Choose a learner and enter a valid amount.");
      return;
    }
    start(async () => {
      const res = await action({ learnerId, amountCents: Math.round(shillings * 100), method, reference: reference || undefined });
      setMsg(res.ok ? "Payment recorded ✓" : (res.error ?? "Failed"));
      if (res.ok) setAmount("");
    });
  }

  const inputCls =
    "mt-1.5 h-12 w-full rounded-sm border border-border bg-surface px-3.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <form onSubmit={submit} className="grid gap-s3h">
      <label className="block text-[13px] font-semibold">
        Learner
        <select value={learnerId} onChange={(e) => setLearnerId(e.target.value)} className={inputCls}>
          {learners.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} · {l.class ?? l.admission_no}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-[13px] font-semibold">
        Amount (Ksh)
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="8,500"
          className={`${inputCls} tabular-nums`}
        />
      </label>

      <div>
        <span className="block text-[13px] font-semibold">Method</span>
        <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="Payment method">
          {METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              aria-pressed={method === m}
              className={`h-10 rounded-pill px-4 text-[13px] font-semibold capitalize ${
                method === m ? "bg-primary text-on-primary" : "border border-border bg-surface text-text hover:bg-paper-100"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <label className="block text-[13px] font-semibold">
        Reference <span className="font-normal text-muted">(optional)</span>
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="bank slip / cheque no"
          className={inputCls}
        />
      </label>

      <p className="rounded-sm border border-dashed border-border bg-paper-100 px-3.5 py-3 font-mono text-[11.5px] leading-relaxed text-muted">
        Receipt issues instantly · write is audit-logged
      </p>

      <div className="flex items-center gap-s3">
        <Button variant="primary" size="lg" type="submit" disabled={pending || learners.length === 0}>
          {pending ? "Recording…" : "Record payment"}
        </Button>
        {msg ? (
          <span className={`text-sm font-semibold ${msg.endsWith("✓") ? "text-ok" : "text-danger"}`} role="status">
            {msg}
          </span>
        ) : null}
      </div>
    </form>
  );
}
