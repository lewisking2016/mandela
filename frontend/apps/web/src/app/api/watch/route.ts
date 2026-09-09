import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

const API_URL = process.env.MANDELA_API_URL ?? "http://localhost:4000";
const COOKIE = "mandela_session";

/**
 * Watcher proxy — LiveRefresh polls this for the tenant's change hash.
 * The session cookie is forwarded; the API decides staff vs guardian scope.
 */
export async function GET() {
  const jar = await cookies();
  const h = await headers();
  const host = h.get("host") ?? "";
  try {
    const r = await fetch(`${API_URL}/web/watch/staff`, {
      headers: {
        cookie: `mandela_session=${jar.get(COOKIE)?.value ?? ""}`,
        "x-mandela-host": host,
      },
      cache: "no-store",
    });
    if (r.ok) {
      const body = (await r.json()) as { hash?: string };
      if (body.hash) return NextResponse.json({ hash: body.hash });
    }
    // not staff (or watcher failed) — try the guardian watcher
    const g = await fetch(`${API_URL}/web/watch/guardian`, {
      headers: {
        cookie: `mandela_session=${jar.get(COOKIE)?.value ?? ""}`,
        "x-mandela-host": host,
      },
      cache: "no-store",
    });
    if (!g.ok) return NextResponse.json({ error: "unavailable" }, { status: 503 });
    const body = (await g.json()) as { hash?: string };
    return NextResponse.json({ hash: body.hash ?? "0" });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
