import { ImageResponse } from "next/og";

/**
 * Favicon as data — renders the school's own mark (school_settings) into a
 * 32px tile. Falls back to the ink square with an "M" when the DB is down.
 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  const API_URL = process.env.MANDELA_API_URL ?? "http://localhost:4000";
  let path: string | null = null;
  try {
    const r = await fetch(`${API_URL}/web/bootstrap`, { cache: "no-store" });
    if (r.ok) {
      const boot = (await r.json()) as { school?: { logo_svg_path?: string | null } };
      path = boot.school?.logo_svg_path ?? null;
    }
  } catch {
    /* fallback below */
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#020202",
          color: "#ffffff",
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        {path ? (
          // The traced mark inherits currentColor via fill — render inline.
          <svg width="24" height="24" viewBox="0 0 100 100">
            <path d={path} fill="#ffffff" />
          </svg>
        ) : (
          <span>M</span>
        )}
      </div>
    ),
    size,
  );
}
