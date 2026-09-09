import { requireSession, requireBootstrap, getSettings } from "@/lib/api";
import { Card, CardHead, EmptyState, SerifHeader, StatusPill } from "@mandela/ui";
import { SettingsForm } from "./SettingsForm";
import { AppLiveBar } from "../LiveBar";
import type { SettingsData } from "@/lib/api";
import { redirect } from "next/navigation";

/** Settings — the school edits its own identity. Saved straight to school_settings. */
export default async function SettingsPage() {
  const me = await requireSession();
  const boot = await requireBootstrap();
  if (me.principal.kind !== "staff") redirect("/app");
  const settings = (await getSettings()) as SettingsData | { error: string };
  const canEdit = me.principal.role === "admin" || me.principal.role === "principal";

  if ("error" in settings) {
    return (
      <div>
        <SerifHeader crumb={`${boot.school.name} · Admin`} title={<>School <em>settings.</em></>} />
        <div className="mt-s7">
          <EmptyState title="Settings unavailable" body="The school database did not respond. Try again shortly." />
        </div>
      </div>
    );
  }

  return (
    <div>
      <SerifHeader
        crumb={`${boot.school.name} · Admin`}
        title={<>The school, <em>as data.</em></>}
        sub="Everything the world sees about your school lives here — change it and every screen updates, because no page is hardcoded."
        actions={
          <div className="flex items-center gap-3">
            <StatusPill tone={canEdit ? "ok" : "neutral"}>{canEdit ? "you can edit" : "read-only"}</StatusPill>
            <AppLiveBar />
          </div>
        }
      />

      <div className="mt-s7">
        <SettingsForm
          settings={settings}
          canEdit={canEdit}
          heroLines={settings.tagline?.split("\n") ?? []}
        />
      </div>
    </div>
  );
}
