"use client";

import { useState, useTransition } from "react";
import { Button } from "@mandela/ui";

export function BroadcastForm({
  action,
}: {
  action: (input: { title: string; body: string; urgency: string }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [urgency, setUrgency] = useState("update");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await action({ title, body, urgency });
      setMsg(res.ok ? "Sent ✓" : (res.error ?? "Failed"));
      if (res.ok) {
        setTitle("");
        setBody("");
      }
    });
  }

  const inputCls =
    "mt-1.5 h-12 w-full rounded-sm border border-border bg-surface px-3.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <form onSubmit={submit} className="grid gap-s3h">
      <label className="block text-[13px] font-semibold">
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} className={inputCls} />
      </label>
      <label className="block text-[13px] font-semibold">
        Message
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={4}
          className="mt-1.5 w-full rounded-sm border border-border bg-surface px-3.5 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      <fieldset>
        <legend className="text-[13px] font-semibold">Urgency</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {([
            ["update", "Update (digest)"],
            ["alert", "Alert (push + SMS)"],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setUrgency(v)}
              aria-pressed={urgency === v}
              className={`h-10 rounded-pill px-4 text-xs font-semibold ${
                urgency === v ? "bg-primary text-on-primary" : "border border-border bg-surface text-muted hover:text-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-s3">
        <Button variant="primary" size="md" type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send to all parents"}
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
