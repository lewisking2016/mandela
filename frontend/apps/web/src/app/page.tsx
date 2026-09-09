import { requireBootstrap, whoami, getPulse } from "@/lib/api";
import { Button, MandelaMark, Microlabel, Meter } from "@mandela/ui";
import Link from "next/link";

/**
 * Landing — comp 01 (scripts/design/01-landing.html): editorial ink-on-paper
 * hero with serif display + live pulse card, bento module grid (one ink
 * anchor), ink quote band. Every word, the mark, the modules, the quote and
 * the live numbers come from school_settings / the school database.
 */
export default async function Landing() {
  const [boot, me, pulse] = await Promise.all([requireBootstrap(), whoami(), getPulse()]);
  const s = boot.school;
  const ctaHref = me.authenticated ? "/app" : "/login";
  const ctaLabel = me.authenticated ? "Open dashboard" : "Sign in to continue";

  const mods = boot.modules.slice(0, 5);
  const widths = ["md:col-span-3", "md:col-span-3", "md:col-span-2", "md:col-span-2", "md:col-span-2"];
  // Hero headline is the school's tagline; a newline splits normal vs italic lines.
  const [heroA, heroB] = (s.tagline ?? "Run the school.\nSee everything.").split("\n");

  return (
    <div className="min-h-dvh">
      {/* NAV */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-s5 py-s5">
        <Link href="/" className="flex items-center gap-s3">
          {s.logo_svg_path ? (
            <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-primary text-on-primary">
              <MandelaMark path={s.logo_svg_path} className="h-5 w-5" title={s.name} />
            </span>
          ) : null}
          <span>
            <span className="block text-[15px] font-semibold leading-tight tracking-[-0.01em]">{s.name}</span>
            {s.motto ? <span className="block text-xs text-muted">{s.motto}</span> : null}
          </span>
        </Link>
        <nav className="hidden items-center gap-s6 text-sm font-medium text-muted md:flex">
          {mods.slice(0, 3).map((m) => (
            <span key={m.title}>{m.title}</span>
          ))}
        </nav>
        <Link href={ctaHref}>
          <Button variant="primary" size="md">
            {me.authenticated ? "Open dashboard" : "Sign in"}
          </Button>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl px-s5">
        {/* HERO — serif display left, live pulse card right */}
        <section className="grid items-center gap-s8 py-s8 md:grid-cols-[1.35fr_1fr] md:py-s9">
          <div className="rise">
            <p className="microlabel flex items-center gap-2.5">
              <span aria-hidden className="inline-block h-[1.5px] w-[22px] bg-primary" />
              {s.name} · Admissions open
            </p>
            <h1 className="display mt-s5 text-hero text-ink-950">
              {heroA}
              {heroB ? (
                <>
                  <br />
                  <em>{heroB}</em>
                </>
              ) : null}
            </h1>
            <p className="mt-s5 max-w-[52ch] text-md font-normal leading-relaxed text-muted">
              One place for people, money, the classroom, and every message home — built so a
              parent, a teacher, or a bursar never has to ask twice.
            </p>
            <div className="mt-s6 flex flex-wrap items-center gap-s4">
              <Link href={ctaHref}>
                <Button variant="primary" size="lg">
                  {ctaLabel}
                </Button>
              </Link>
              <Link
                href="#modules"
                className="inline-flex h-14 items-center text-sm font-semibold text-text underline decoration-paper-300 underline-offset-[5px] hover:decoration-primary"
              >
                See the five modules ↓
              </Link>
            </div>
            <p className="mt-s7 flex flex-wrap gap-s6 font-mono text-xs text-ink-500">
              <span>No training needed</span>
              <span>Works offline-first</span>
              <span>Per-school database</span>
            </p>
          </div>

          {/* PULSE CARD — live aggregates from the school database */}
          <aside className="rise rise-2 rounded-lg border border-border bg-surface p-s5 shadow-2 md:p-s6">
            <div className="flex items-center justify-between">
              <Microlabel>Today at school</Microlabel>
              <span className="flex items-center gap-1.5 font-mono text-[11px] font-medium text-ok">
                <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-ok" />
                LIVE
              </span>
            </div>
            <p className="numeral mt-s3 text-[52px] font-semibold leading-none">
              {pulse?.rate != null ? `${pulse.rate}` : "—"}
              <span className="text-xl font-medium text-ink-500">%</span>
            </p>
            <div className="mt-2 flex items-baseline justify-between text-[13px] text-muted">
              <span>learners present</span>
              <span className="font-semibold tabular-nums text-text">
                {pulse ? `${pulse.present} of ${pulse.expected}` : ""}
              </span>
            </div>
            <div className="mt-s3">
              <Meter value={pulse?.rate ?? 0} />
            </div>
            <div className="mt-s5 grid grid-cols-2 gap-s4 border-t border-paper-200 pt-s4">
              <div>
                <Microlabel>Collected today</Microlabel>
                <p className="numeral mt-1.5 text-[22px] font-semibold text-ok">
                  {pulse ? `Ksh ${Math.round(Number(pulse.collected_today_cents) / 100).toLocaleString("en-KE")}` : "—"}
                </p>
              </div>
              <div>
                <Microlabel>Active learners</Microlabel>
                <p className="numeral mt-1.5 text-[22px] font-semibold">
                  {pulse ? pulse.active_learners : "—"}
                </p>
              </div>
            </div>
          </aside>
        </section>

        {/* MODULES — bento with one ink anchor */}
        <section id="modules" className="scroll-mt-8 pb-s8">
          <div className="flex flex-wrap items-end justify-between gap-s3">
            <h2 className="display text-lg text-ink-950 md:text-[38px] md:leading-tight">
              Five modules. Nothing else.
            </h2>
            <p className="text-sm text-muted">Everything a school runs on, in one flat system.</p>
          </div>
          <div className="mt-s6 grid gap-s3h md:grid-cols-6">
            {mods.map((m, i) => {
              const ink = i === 1; // the anchor card
              return (
                <article
                  key={m.title}
                  className={`flex min-h-44 flex-col gap-3 rounded border p-s5 shadow-1 ${widths[i] ?? "md:col-span-2"} ${
                    ink ? "border-brand-deep bg-brand-deep text-brand-deep-contrast" : "border-border bg-surface"
                  }`}
                >
                  <span className={`font-mono text-[11px] tracking-[0.1em] ${ink ? "text-ink-400" : "text-ink-400"}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-[19px] font-semibold tracking-[-0.015em]">{m.title}</h3>
                  <p className={`text-sm leading-relaxed ${ink ? "text-ink-300" : "text-muted"}`}>{m.body}</p>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      {/* QUOTE BAND — ink, serif italic; text from the DB */}
      <section className="bg-brand-deep py-s9 text-brand-deep-contrast">
        <div className="mx-auto max-w-4xl px-s5 text-center">
          {s.quote_text ? (
            <blockquote className="display mx-auto max-w-[21ch] text-lg italic leading-[1.2] text-brand-deep-contrast md:text-[44px]">
              “{s.quote_text}”
            </blockquote>
          ) : s.motto ? (
            <blockquote className="display mx-auto max-w-[24ch] text-lg italic leading-[1.2] text-brand-deep-contrast md:text-[38px]">
              {s.motto}
            </blockquote>
          ) : null}
          {s.quote_author ? (
            <cite className="mt-s5 block font-mono text-[11px] not-italic tracking-[0.14em] text-ink-400 uppercase">
              — {s.quote_author}
            </cite>
          ) : null}
        </div>
      </section>

      <footer className="border-t border-paper-200">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-s3 px-s5 py-s5 text-[13px] text-muted">
          <span>
            {s.name}
            {s.contact_address ? ` · ${s.contact_address}` : ""}
            {s.contact_phone ? ` · ${s.contact_phone}` : ""}
          </span>
          <span>Powered by Mandela</span>
        </div>
      </footer>
    </div>
  );
}
