"use server";

/**
 * Server-side API client for the Mandela web app.
 * The Next.js server is the only browser-facing consumer of the NestJS API;
 * the session cookie is forwarded/set here, never exposed to client JS.
 */
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

const API_URL = process.env.MANDELA_API_URL ?? "http://localhost:4000";
const COOKIE = "mandela_session";

export interface Whoami {
  authenticated: boolean;
  tenant: string;
  principal?: {
    kind: "staff" | "guardian";
    full_name: string;
    role?: string;
    email?: string | null;
  };
}

export interface BootstrapPayload {
  tenant: string;
  school: {
    name: string;
    tagline: string | null;
    motto: string | null;
    logo_svg_path: string | null;
    logo_aspect: number;
    contact_phone: string | null;
    contact_email: string | null;
    contact_address: string | null;
    quote_text: string | null;
    quote_author: string | null;
  };
  nav: Record<string, string[]>;
  modules: { title: string; body: string }[];
  prime_questions: Record<string, string>;
}

export interface PublicPulse {
  present: number;
  expected: number;
  rate: number | null;
  collected_today_cents: string;
  active_learners: number;
}

async function apiFetch(path: string, init?: RequestInit & { tenantHeader?: string }): Promise<Response> {
  const h = await headers();
  const tenant = (await cookies()).get("mandela_tenant")?.value ?? hostToTenant(h.get("host"));
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      cookie: `mandela_session=${(await cookies()).get(COOKIE)?.value ?? ""}`,
      ...(tenant ? { "x-mandela-host": `${tenant}.mandela.school` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

function hostToTenant(host: string | null): string | undefined {
  if (!host) return undefined;
  const sub = host.split(":")[0]!.split(".")[0]!;
  return sub && sub !== "localhost" && sub !== "www" && !/^\d+\.\d+\.\d+\.\d+$/.test(sub) ? sub : undefined;
}

export async function whoami(): Promise<Whoami> {
  try {
    const r = await apiFetch("/web/whoami");
    if (!r.ok) return { authenticated: false, tenant: "?" };
    return (await r.json()) as Whoami;
  } catch {
    return { authenticated: false, tenant: "?" };
  }
}

export async function getBootstrap(): Promise<BootstrapPayload | null> {
  try {
    const r = await apiFetch("/web/bootstrap");
    if (!r.ok) return null;
    return (await r.json()) as BootstrapPayload;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Whoami & { principal: NonNullable<Whoami["principal"]> }> {
  const me = await whoami();
  if (!me.authenticated || !me.principal) redirect("/login");
  return me as Whoami & { principal: NonNullable<Whoami["principal"]> };
}

export async function requireBootstrap(): Promise<BootstrapPayload> {
  const boot = await getBootstrap();
  if (!boot) redirect("/down");
  return boot;
}

export async function getPulse(): Promise<PublicPulse | null> {
  try {
    const r = await apiFetch("/web/pulse");
    if (!r.ok) return null;
    return (await r.json()) as PublicPulse;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Mutations (server actions) — login/logout + all write paths
// ---------------------------------------------------------------------------

export async function loginStaff(email: string): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch(`${API_URL}/web/login/staff`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
    cache: "no-store",
  });
  const body = (await r.json()) as { ok: boolean; error?: string; token?: string };
  if (body.ok && body.token) {
    const jar = await cookies();
    jar.set(COOKIE, body.token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 30 * 24 * 3600 });
    return { ok: true };
  }
  return { ok: false, error: body.error ?? "Sign-in failed." };
}

export async function loginGuardian(phone: string): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch(`${API_URL}/web/login/guardian`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone }),
    cache: "no-store",
  });
  const body = (await r.json()) as { ok: boolean; error?: string; token?: string };
  if (body.ok && body.token) {
    const jar = await cookies();
    jar.set(COOKIE, body.token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 30 * 24 * 3600 });
    return { ok: true };
  }
  return { ok: false, error: body.error ?? "Sign-in failed." };
}

export async function logout(): Promise<void> {
  (await cookies()).delete(COOKIE);
  redirect("/login");
}

async function mutate(path: string, payload: unknown): Promise<{ ok: boolean; error?: string; data?: unknown }> {
  const r = await apiFetch(path, { method: "POST", body: JSON.stringify(payload) });
  if (!r.ok) return { ok: false, error: `Request failed (${r.status})` };
  const body = (await r.json()) as Record<string, unknown>;
  if (body.error) return { ok: false, error: String(body.error) };
  return { ok: true, data: body };
}

export async function markAttendanceAction(marks: { learnerId: string; mark: string }[]) {
  return mutate("/web/attendance", { marks });
}

export async function recordPaymentAction(input: { learnerId: string; amountCents: number; method: string; reference?: string }) {
  return mutate("/web/money/payments", input);
}

export async function createHomeworkAction(input: { classId: number; subject: string; title: string; body: string; dueOn?: string }) {
  return mutate("/web/homework", input);
}

export async function createAnnouncementAction(input: { title: string; body: string; urgency: string }) {
  return mutate("/web/announcements", { ...input, audience: { all: true } });
}

// ---------------------------------------------------------------------------
// Reads used by the role screens
// ---------------------------------------------------------------------------

async function read<T>(path: string, fallback: T): Promise<T> {
  try {
    const r = await apiFetch(path);
    if (!r.ok) return fallback;
    return (await r.json()) as T;
  } catch {
    return fallback;
  }
}

export interface StaffHomeData {
  today: { present: number; absent: number; marked: number; expected: number };
  money: { collected_today_cents: string; expected_term_cents: string };
  count: number;
  collected_term_cents: string;
  last7: { day: string; present: string; total: string }[];
}

export async function getStaffHome() {
  return read<StaffHomeData | { error: string }>("/web/home/staff", { error: "unavailable" });
}

export interface GuardianHomeData {
  learners: { id: string; name: string; class: string | null }[];
  due_cents: Record<string, string>;
  paid_this_term_cents: Record<string, string>;
  homework_due: { learner: string; subject: string; title: string; due_on: string }[];
  announcements: { title: string; body: string; created_at: string }[];
  next_due?: { learner: string; item: string; amount_cents: string };
}

export async function getGuardianHome() {
  return read<GuardianHomeData | { error: string }>("/web/home/guardian", { error: "unavailable" });
}

export interface LearnerRow {
  id: string; admission_no: string; name: string; class: string | null; status: string; gender: string | null;
}
export async function getLearners() {
  return read<{ learners: LearnerRow[] }>("/web/learners", { learners: [] });
}

export interface ClassRow { id: number; code: string; name: string; learners: string }
export async function getClasses() {
  return read<{ classes: ClassRow[] }>("/web/classes", { classes: [] });
}

export interface RosterRow { id: string; name: string; admission_no: string; mark: string | null }
export async function getRoster(classId: number) {
  return read<{ roster: RosterRow[] }>(`/web/roster/${classId}`, { roster: [] });
}

export interface HomeworkRow { id: string; subject: string; title: string; body: string; due_on: string | null; class: string }
export async function getHomework() {
  return read<{ homework: HomeworkRow[] }>("/web/homework", { homework: [] });
}

export interface PaymentRow { receipt_no: string; learner: string; amount_cents: string; method: string; state: string; paid_at: string }
export async function getPayments() {
  return read<{ payments: PaymentRow[] }>("/web/money/payments", { payments: [] });
}

export interface CollectionRow { class: string; billed_cents: string; paid_cents: string }
export async function getCollections() {
  return read<{ collections: CollectionRow[] }>("/web/money/collections", { collections: [] });
}

export interface AnnouncementRow { id: string; title: string; body: string; urgency: string; created_at: string }
export async function getAnnouncements() {
  return read<{ announcements: AnnouncementRow[] }>("/web/announcements", { announcements: [] });
}

export interface InsightsData {
  learners: { active: string; boarding: string };
  guardians: { total: string; wa: string };
  attendance7: { day: string; present: string; total: string }[];
  collection: CollectionRow[];
}
export async function getInsights() {
  return read<InsightsData | { error: string }>("/web/insights", { error: "unavailable" });
}
