import { NextResponse } from "next/server";
import { headers } from "next/headers";

const API_URL = process.env.MANDELA_API_URL ?? "http://localhost:4000";

/** Public pulse proxy — the landing's live card polls this. */
export async function GET() {
  const h = await headers();
  const host = h.get("host") ?? "";
  try {
    const r = await fetch(`${API_URL}/web/pulse`, {
      headers: { "x-mandela-host": host },
      cache: "no-store",
    });
    if (!r.ok) return NextResponse.json({ error: "unavailable" }, { status: 503 });
    return NextResponse.json(await r.json());
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
