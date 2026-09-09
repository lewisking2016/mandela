import { requireSession, requireBootstrap } from "@/lib/api";
import { AppShell } from "./AppShell";

/**
 * /app layout — the shell (ink sidebar + mobile top bar + bottom tabs) wraps
 * EVERY module page. Because Next.js layouts persist across child
 * navigations, the sidebar never disappears and never re-renders when you
 * open Money, Mark, Insights… (previously only the Today page rendered the
 * shell, so every module click left you full-bleed with no way back).
 *
 * Tabs still come from school_settings.nav per role — nothing hardcoded —
 * and requireSession() here guards every child route in one place.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [me, boot] = await Promise.all([requireSession(), requireBootstrap()]);
  const roleKey = me.principal.kind === "guardian" ? "parent" : me.principal.role ?? "admin";

  return (
    <AppShell
      schoolName={boot.school.name}
      motto={boot.school.motto}
      logoPath={boot.school.logo_svg_path}
      tabs={boot.nav[roleKey] ?? []}
      userName={me.principal.full_name}
      userMeta={
        me.principal.kind === "guardian"
          ? "Guardian · signed in"
          : `${(me.principal.role ?? "staff").replace(/^\w/, (c) => c.toUpperCase())} · signed in`
      }
    >
      {children}
    </AppShell>
  );
}
