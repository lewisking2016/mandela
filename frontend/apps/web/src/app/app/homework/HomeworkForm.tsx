"use client";

import { useState, useTransition } from "react";
import { Button } from "@mandela/ui";
import type { ClassRow } from "@/lib/api";

export function HomeworkForm({
  classes,
  action,
}: {
  classes: ClassRow[];
  action: (input: { classId: number; subject: string; title: string; body: string; dueOn?: string }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? 0);
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await action({
        classId,
        subject,
        title,
        body,
        dueOn: dueOn || undefined,
      });
      setMsg(res.ok ? "Set ✓" : (res.error ?? "Failed"));
      if (res.ok) {
        setTitle("");
        setBody("");
      }
    });
  }

  const inputCls =
    "mt-1.5 h-12 w-full rounded-sm border border-border bg-surface px-3.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <form onSubmit={submit} className="grid gap-s3h md:grid-cols-2">
      <label className="block text-[13px] font-semibold">
        Class
        <select value={classId} onChange={(e) => setClassId(Number(e.target.value))} className={inputCls}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[13px] font-semibold">
        Subject
        <input value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder="Mathematics" className={inputCls} />
      </label>
      <label className="block text-[13px] font-semibold md:col-span-2">
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Fractions worksheet 3" className={inputCls} />
      </label>
      <label className="block text-[13px] font-semibold md:col-span-2">
        Instructions
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={3}
          className="mt-1.5 w-full rounded-sm border border-border bg-surface px-3.5 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      <label className="block text-[13px] font-semibold">
        Due date <span className="font-normal text-muted">(optional)</span>
        <input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} className={inputCls} />
      </label>
      <div className="flex items-center gap-s3 md:col-span-2">
        <Button variant="primary" size="md" type="submit" disabled={pending || classes.length === 0}>
          {pending ? "Setting…" : "Set homework"}
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
