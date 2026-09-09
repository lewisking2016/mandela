"use client";

import { usePathname, useRouter } from "next/navigation";
import { MandelaMark } from "@mandela/ui";
import { NavPill } from "@/components/NavPill";

/**
 * AppShell — comp 02's frame, now left-anchored at every width: the ink
 * sidebar is ALWAYS on the left (icon-only rail on narrow screens, full
 * labels + user block from md up). Tabs and labels come from
 * school_settings.nav — this component never hardcodes a school's navigation.
 */

const ICONS: Record<string, React.ReactNode> = {
  Today: <path d="M4 5h16v15H4zM4 9h16M8 3v4M16 3v4" />,
  Money: <path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
  Collect: <path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
  Pay: <path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
  Mark: <path d="M22 10v6M2 10l10-5 10 5-10 5zM6 12v5c3 3 9 3 12 0v-5" />,
  People: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  Class: <path d="M22 10v6M2 10l10-5 10 5-10 5zM6 12v5c3 3 9 3 12 0v-5" />,
  Homework: <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />,
  Messages: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  Broadcast: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />,
  Insights: <path d="M3 3v18h18M18 9l-5 5-3-3-4 4" />,
  Approve: <path d="M20 6 9 17l-5-5" />,
  Directory: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" />,
  Reconcile: <path d="M3 3v18h18M18 9l-5 5-3-3-4 4" />,
  Levies: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
  Reports: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" />,
  Settings: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />,
  Profile: <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" />,
  Route: <path d="M3 3v18h18M18 9l-5 5-3-3-4 4" />,
  Manifest: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8" />,
  Done: <path d="M20 6 9 17l-5-5" />,
};

const FALLBACK_ICON = <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />;

function tabToHref(tab: string, first: string): string {
  const map: Record<string, string> = {
    Pay: "/app/pay",
    Homework: "/app/homework",
    Messages: "/app/messages",
    Profile: "/app/profile",
    Today: "/app",
    Mark: "/app/mark",
    Class: "/app/class",
    Collect: "/app/money",
    Reconcile: "/app/reconcile",
    Levies: "/app/levies",
    Reports: "/app/reports",
    Approve: "/app/approve",
    Insights: "/app/insights",
    Broadcast: "/app/broadcast",
    Directory: "/app/directory",
    People: "/app/people",
    Money: "/app/money",
    Settings: "/app/settings",
  };
  if (tab === first) return "/app";
  return map[tab] ?? `/app/${tab.toLowerCase()}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function AppShell({
  schoolName,
  motto,
  logoPath,
  tabs,
  userName,
  userMeta,
  children,
}: {
  schoolName: string;
  motto?: string | null;
  logoPath: string | null;
  tabs: string[];
  userName: string;
  userMeta: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const shown = tabs.slice(0, 6);
  const first = shown[0] ?? "Today";

  async function signOut() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh">
      {/* SIDEBAR — always left. Icon rail on narrow screens, full labels from md up. */}
      <aside className="sticky top-0 flex h-dvh w-[68px] shrink-0 flex-col bg-brand-deep px-3 py-6 text-brand-deep-contrast md:w-60 md:px-4">
        <div className="mb-4 flex items-center justify-center gap-3 border-b border-deep-line px-2 pb-5 md:justify-start">
          {logoPath ? (
            <span className="grid h-9 w-9 place-items-center rounded-[9px] bg-white text-ink-950">
              <MandelaMark path={logoPath} className="h-4.5 w-4.5" title={schoolName} />
            </span>
          ) : null}
          <span className="hidden min-w-0 md:block">
            <span className="block truncate text-sm font-semibold tracking-[-0.01em]">{schoolName}</span>
            {motto ? <span className="block truncate text-[11px] text-ink-400">{motto}</span> : null}
          </span>
        </div>

        <p className="hidden px-3 pb-1.5 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-600 md:block">Work</p>
        <NavPill
          responsive
          className="flex flex-col gap-0.5"
          items={shown.map((tab) => ({
            href: tabToHref(tab, first),
            label: tab,
            icon: (
              <svg
                viewBox="0 0 24 24"
                className="h-[17px] w-[17px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                {ICONS[tab] ?? FALLBACK_ICON}
              </svg>
            ),
          }))}
        />

        <div className="mt-auto flex flex-col items-center gap-2.5 border-t border-deep-line px-2 pt-4 md:flex-row md:justify-start">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-deep-line text-xs font-semibold text-white">
            {initials(userName)}
          </span>
          <span className="hidden min-w-0 flex-1 md:block">
            <span className="block truncate text-[13px] font-semibold">{userName}</span>
            <span className="block truncate text-[11px] text-ink-400">{userMeta}</span>
          </span>
          <button
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
            className="grid h-9 w-9 place-items-center rounded-pill text-ink-400 hover:bg-ink-900 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </aside>

      {/* MAIN COLUMN */}
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-10 md:py-9">{children}</main>
      </div>
    </div>
  );
}
