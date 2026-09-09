"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * RoleNav — the ≤5 tabs, labels straight from bootstrap.nav (school_settings).
 * tab[0] is the home screen; the rest are work areas.
 */
export function RoleNav({ tabs }: { tabs: string[] }) {
  const pathname = usePathname();
  if (tabs.length === 0) return null;
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface"
    >
      <div className="mx-auto flex w-full max-w-2xl items-stretch justify-around md:max-w-5xl">
        {tabs.slice(0, 5).map((tab) => {
          const href = tab === tabs[0] ? "/app" : tabToHref(tab);
          const active = pathname === href;
          return (
            <Link
              key={tab}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex h-tap min-w-tap flex-1 items-center justify-center text-xs font-medium ${
                active ? "text-text" : "text-muted hover:text-text"
              }`}
            >
              <span className={active ? "border-b-2 border-primary pb-0.5" : "pb-0.5"}>{tab}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function tabToHref(tab: string): string {
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
  return map[tab] ?? `/app/${tab.toLowerCase()}`;
}
