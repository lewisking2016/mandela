import { NextRequest, NextResponse } from "next/server";

/**
 * Auth route handler — sets/clears the session cookie directly (server
 * actions + cookie + redirect proved flaky; a route handler is exact).
 */
const API_URL = process.env.MANDELA_API_URL ?? "http://localhost:4000";
const COOKIE = "mandela_session";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    kind?: "staff" | "guardian";
    email?: string;
    phone?: string;
  };

  const path = body.kind === "guardian" ? "/web/login/guardian" : "/web/login/staff";
  const payload =
    body.kind === "guardian"
      ? { phone: (body.phone ?? "").replace(/\s/g, "") }
      : { email: body.email ?? "" };

  const r = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const data = (await r.json()) as { ok: boolean; error?: string; token?: string };

  if (!data.ok || !data.token) {
    return NextResponse.json({ ok: false, error: data.error ?? "Sign-in failed" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, data.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 3600,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
