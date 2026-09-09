/**
 * The Mandela wordmark — rendered from the DB-provided SVG path.
 * app.bootstrap returns { logo_svg_path, logo_aspect } from school_settings;
 * the mark is data, never a bundled asset. The traced path is monochrome
 * ink on paper — it inherits currentColor, so it is in harmony with the
 * logo everywhere it appears (sidebar, login, print).
 */
export function MandelaMark({
  path,
  className = "h-8 w-8",
  title,
}: {
  path: string;
  className?: string;
  title?: string;
}) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={title ?? "Mandela"}>
      {title ? <title>{title}</title> : null}
      <path d={path} fill="currentColor" />
    </svg>
  );
}
