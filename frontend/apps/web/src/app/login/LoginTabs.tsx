"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@mandela/ui";

export function LoginTabs() {
  const router = useRouter();
  const [tab, setTab] = useState<"staff" | "guardian">("staff");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          tab === "staff"
            ? { kind: "staff", email: String(fd.get("email") ?? "") }
            : { kind: "guardian", phone: String(fd.get("phone") ?? "") },
        ),
      });
      if (res.ok) {
        router.push("/app");
        router.refresh();
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Sign-in failed");
      }
    } catch {
      setError("Could not reach the school system");
    } finally {
      setPending(false);
    }
  }

  const inputCls =
    "h-12 w-full rounded-sm border border-border bg-surface px-3.5 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="mt-s6">
      {/* segmented pill tabs — comp 04 */}
      <div className="flex gap-1 rounded-pill bg-paper-100 p-1" role="tablist" aria-label="Sign in as">
        {(["staff", "guardian"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`h-11 flex-1 rounded-pill text-sm transition-colors ${
              tab === t
                ? "bg-surface font-semibold text-primary shadow-1"
                : "font-medium text-muted hover:text-text"
            }`}
          >
            {t === "staff" ? "I'm staff" : "I'm a guardian"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-s5 space-y-s4">
        {tab === "staff" ? (
          <label className="block text-[13px] font-semibold" htmlFor="email">
            School email
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@mandela.school"
              className={`mt-1.5 ${inputCls}`}
            />
          </label>
        ) : (
          <label className="block text-[13px] font-semibold" htmlFor="phone">
            Phone number
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              inputMode="tel"
              autoComplete="tel"
              placeholder="0733 000 001"
              className={`mt-1.5 ${inputCls}`}
            />
          </label>
        )}

        <Button variant="primary" size="lg" type="submit" className="w-full" loading={pending}>
          {pending ? "Signing in…" : "Continue"}
        </Button>

        {error ? (
          <p className="text-sm font-semibold text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
