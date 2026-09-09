import crypto from "node:crypto";
import { config } from "../config.js";
import { getControlPool, getSchoolPool, withRlsSession, type PoolClient } from "../db/pool.js";

/**
 * Web module — every byte the web app renders is queried here, from the
 * per-school databases. Nothing is hardcoded in the frontend: the landing
 * page, navigation labels, role homes, tables, even the logo mark arrive
 * as JSON from these queries (branding lives in school_settings).
 */

// ---------------------------------------------------------------------------
// Tenancy: host subdomain -> school db (dev fallback: WEB_DEFAULT_TENANT)
// ---------------------------------------------------------------------------

export async function resolveTenant(host: string | undefined): Promise<{ dbName: string; slug: string } | null> {
  const control = await getControlPool();
  if (host) {
    const sub = host.split(":")[0]!.split(".")[0]!;
    if (sub && sub !== "www" && sub !== "localhost" && !/^\d+\.\d+\.\d+\.\d+$/.test(sub)) {
      const r = await control.query<{ db_name: string; slug: string }>(
        `SELECT db_name, slug FROM school WHERE caddy_host = $1 OR slug = $1 LIMIT 1`,
        [sub],
      );
      if (r.rowCount) return { dbName: r.rows[0]!.db_name, slug: r.rows[0]!.slug };
    }
  }
  const fallback = await control.query<{ db_name: string; slug: string }>(
    `SELECT db_name, slug FROM school WHERE slug = $1 LIMIT 1`,
    [config.WEB_DEFAULT_TENANT],
  );
  return fallback.rowCount ? { dbName: fallback.rows[0]!.db_name, slug: fallback.rows[0]!.slug } : null;
}

// ---------------------------------------------------------------------------
// Sessions: stateless HMAC tokens (better-auth replaces this in v2)
// token = base64url(principal json).base64url(hmac-sha256(principal))
// ---------------------------------------------------------------------------

export type Principal =
  | { kind: "staff"; userId: string; role: string }
  | { kind: "guardian"; guardianId: string };

function b64url(s: Buffer | string): string {
  return Buffer.from(s).toString("base64url");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", config.WEB_SESSION_SECRET).update(payload).digest("base64url");
}

export function issueToken(principal: Principal): string {
  const payload = b64url(JSON.stringify(principal));
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | undefined | null): Principal | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Principal;
    if (parsed.kind === "staff" && parsed.userId && parsed.role) return parsed;
    if (parsed.kind === "guardian" && parsed.guardianId) return parsed;
    return null;
  } catch {
    return null;
  }
}

/**
 * Run a query block with the RLS session GUCs set, always releasing the
 * client (even on error) so the per-school pool never leaks.
 */
async function withSession<T>(
  dbName: string,
  session: { userId: string; role: string; guardianId?: string },
  fn: (c: PoolClient) => Promise<T>,
): Promise<T> {
  const db = getSchoolPool(dbName);
  const client = await db.connect();
  try {
    return await withRlsSession(client, session, fn);
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Bootstrap: branding + nav for a tenant (powers the whole shell)
// ---------------------------------------------------------------------------

export interface Bootstrap {
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
  modules: { title: string; body: string }[];
  nav: Record<string, string[]>;
  prime_questions: Record<string, string>;
}

const DEFAULT_PRIME: Record<string, string> = {
  parent: "What do I owe, and what's happening today?",
  teacher: "Who's here, who's not, and what's due?",
  bursar: "What came in, what's expected, what's off?",
  principal: "Is the school healthy — money, people, mood?",
  admin: "Is the term running — and what needs me?",
  driver: "Who boards where, and who's left?",
};

export async function getBootstrap(dbName: string): Promise<Bootstrap> {
  const db = getSchoolPool(dbName);
  const s = await db.query<{
    name: string; tagline: string | null; motto: string | null;
    logo_svg_path: string | null; logo_aspect: string;
    contact_phone: string | null; contact_email: string | null; contact_address: string | null;
    quote_text: string | null; quote_author: string | null;
    modules_json: unknown;
    nav_json: unknown;
  }>(
    `SELECT name, tagline, motto, logo_svg_path, logo_aspect,
            contact_phone, contact_email, contact_address,
            quote_text, quote_author, modules_json, nav_json
     FROM school_settings WHERE id = 'default'`,
  );
  if (!s.rowCount) throw new Error(`school_settings missing in ${dbName} — run migrations`);
  const row = s.rows[0]!;
  return {
    school: {
      name: row.name,
      tagline: row.tagline,
      motto: row.motto,
      logo_svg_path: row.logo_svg_path,
      logo_aspect: Number(row.logo_aspect) || 1,
      contact_phone: row.contact_phone,
      contact_email: row.contact_email,
      contact_address: row.contact_address,
      quote_text: row.quote_text,
      quote_author: row.quote_author,
    },
    modules: (row.modules_json as { title: string; body: string }[] | null) ?? [],
    nav: (row.nav_json as Record<string, string[]> | null) ?? {},
    prime_questions: DEFAULT_PRIME,
  };
}

// ---------------------------------------------------------------------------
// Auth: sign-in resolves a staff row by email (guardians: phone OTP later)
// ---------------------------------------------------------------------------

export async function resolveStaffLogin(dbName: string, email: string): Promise<{ token: string; staff: { id: string; full_name: string; role: string } } | null> {
  const db = getSchoolPool(dbName);
  const r = await db.query<{ id: string; full_name: string; role: string; active: boolean }>(
    `SELECT id, full_name, role::text AS role, active FROM staff WHERE email = $1 AND active = true`,
    [email],
  );
  if (!r.rowCount) return null;
  const staff = r.rows[0]!;
  return {
    token: issueToken({ kind: "staff", userId: staff.id, role: staff.role }),
    staff: { id: staff.id, full_name: staff.full_name, role: staff.role },
  };
}

export async function resolveGuardianLogin(dbName: string, phone: string): Promise<{ token: string; guardian: { id: string; full_name: string } } | null> {
  const db = getSchoolPool(dbName);
  const r = await db.query<{ id: string; full_name: string }>(
    `SELECT id, full_name FROM guardian WHERE phone = $1 AND active = true`,
    [phone],
  );
  if (!r.rowCount) return null;
  const g = r.rows[0]!;
  return { token: issueToken({ kind: "guardian", guardianId: g.id }), guardian: g };
}

// ---------------------------------------------------------------------------
// Role dashboards — one query per role, all numbers from the database
// ---------------------------------------------------------------------------

export interface GuardianHome {
  learners: { id: string; name: string; class: string | null }[];
  due_cents: Record<string, string>;
  paid_this_term_cents: Record<string, string>;
  homework_due: { learner: string; subject: string; title: string; due_on: string }[];
  announcements: { title: string; body: string; created_at: string }[];
  next_due?: { learner: string; item: string; amount_cents: string };
}

export async function guardianHome(dbName: string, guardianId: string): Promise<GuardianHome> {
  const out: GuardianHome = { learners: [], due_cents: {}, paid_this_term_cents: {}, homework_due: [], announcements: [] };

  await withSession(dbName, { userId: guardianId, role: "guardian", guardianId }, async (c) => {
    const learners = await c.query<{ id: string; name: string; class: string | null }>(
      `SELECT l.id, l.first_name || ' ' || l.last_name AS name, cl.name AS class
       FROM learner l LEFT JOIN class cl ON cl.id = l.class_id ORDER BY l.first_name`,
    );
    out.learners = learners.rows;
    const ids = learners.rows.map((l) => l.id);

    const due = await c.query<{ learner_id: string; due: string }>(
      `SELECT fi.learner_id, SUM(fi.amount)::text AS due
       FROM fee_item fi LEFT JOIN consent cs ON cs.id = fi.consent_id
       WHERE fi.is_optional = false OR cs.choice = 'granted'
       GROUP BY fi.learner_id`,
    );
    for (const row of due.rows) out.due_cents[row.learner_id] = row.due;

    if (ids.length) {
      const paid = await c.query<{ learner_id: string; paid: string }>(
        `SELECT learner_id, SUM(amount)::text AS paid FROM payments
         WHERE state = 'confirmed' AND learner_id = ANY($1::uuid[]) GROUP BY learner_id`,
        [ids],
      );
      for (const row of paid.rows) out.paid_this_term_cents[row.learner_id] = row.paid;

      const hw = await c.query<{ learner: string; subject: string; title: string; due_on: string }>(
        `SELECT l.first_name || ' ' || l.last_name AS learner, h.subject, h.title, h.due_on::text
         FROM homework h
         JOIN learner l ON l.class_id = h.class_id
         WHERE l.id = ANY($1::uuid[]) AND h.due_on >= CURRENT_DATE
         ORDER BY h.due_on LIMIT 5`,
        [ids],
      );
      out.homework_due = hw.rows;

      const next = await c.query<{ learner: string; item: string; amount_cents: string }>(
        `SELECT l.first_name || ' ' || l.last_name AS learner, fi.name AS item, fi.amount::text AS amount_cents
         FROM fee_item fi JOIN learner l ON l.id = fi.learner_id
         LEFT JOIN consent cs ON cs.id = fi.consent_id
         WHERE l.id = ANY($1::uuid[]) AND (fi.is_optional = false OR cs.choice = 'granted')
         ORDER BY fi.created_at DESC LIMIT 1`,
        [ids],
      );
      if (next.rowCount) out.next_due = next.rows[0];
    }

    const ann = await c.query<{ title: string; body: string; created_at: string }>(
      `SELECT title, body, created_at::text FROM announcement ORDER BY created_at DESC LIMIT 3`,
    );
    out.announcements = ann.rows;
  });

  return out;
}

export interface StaffHome {
  today: { present: number; absent: number; marked: number; expected: number };
  money: { collected_today_cents: string; expected_term_cents: string };
  count: number;
  /** term collections (bento anchor card) */
  collected_term_cents: string;
  /** attendance rate per day, last 7 days (bento mini chart) */
  last7: { day: string; present: string; total: string }[];
}

export async function staffHome(dbName: string, principal: Extract<Principal, { kind: "staff" }>): Promise<StaffHome> {
  const out: StaffHome = {
    today: { present: 0, absent: 0, marked: 0, expected: 0 },
    money: { collected_today_cents: "0", expected_term_cents: "0" },
    count: 0,
    collected_term_cents: "0",
    last7: [],
  };

  await withSession(dbName, { userId: principal.userId, role: principal.role }, async (c: PoolClient) => {
    const attendance = await c.query<{ present: string; absent: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE a.mark = 'present')::text AS present,
         COUNT(*) FILTER (WHERE a.mark = 'absent')::text AS absent
       FROM attendance a WHERE a.day = CURRENT_DATE`,
    );
    const expected = await c.query<{ expected: string }>(
      `SELECT COUNT(*)::text AS expected FROM learner WHERE status = 'active'`,
    );
    const collected = await c.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount), 0)::text AS total FROM payments
       WHERE state = 'confirmed' AND paid_at::date = CURRENT_DATE`,
    );
    const expectedTerm = await c.query<{ total: string }>(
      `SELECT COALESCE(SUM(fi.amount), 0)::text AS total
       FROM fee_item fi WHERE fi.is_optional = false`,
    );
    const learners = await c.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM learner WHERE status = 'active'`,
    );
    out.today = {
      present: Number(attendance.rows[0]!.present),
      absent: Number(attendance.rows[0]!.absent),
      marked: Number(attendance.rows[0]!.present) + Number(attendance.rows[0]!.absent),
      expected: Number(expected.rows[0]!.expected),
    };
    out.money = {
      collected_today_cents: collected.rows[0]!.total,
      expected_term_cents: expectedTerm.rows[0]!.total,
    };
    out.count = Number(learners.rows[0]!.count);

    const term = await c.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount), 0)::text AS total FROM payments WHERE state = 'confirmed'`,
    );
    out.collected_term_cents = term.rows[0]!.total;

    const last7 = await c.query<{ day: string; present: string; total: string }>(
      `SELECT to_char(d.day, 'Dy') AS day,
              COUNT(a.id) FILTER (WHERE a.mark = 'present')::text AS present,
              COUNT(a.id)::text AS total
       FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') AS d(day)
       LEFT JOIN attendance a ON a.day = d.day
       GROUP BY d.day ORDER BY d.day`,
    );
    out.last7 = last7.rows;
  });

  return out;
}

// ---------------------------------------------------------------------------
// Public pulse — the landing page's live "Today at school" card.
// Read WITHOUT RLS session on purpose: aggregates only, no personal rows.
// ---------------------------------------------------------------------------

export interface PublicPulse {
  present: number;
  expected: number;
  rate: number | null;
  collected_today_cents: string;
  active_learners: number;
}

export async function publicPulse(dbName: string): Promise<PublicPulse> {
  const db = getSchoolPool(dbName);
  const att = await db.query<{ present: string; expected: string }>(
    `SELECT
       (SELECT COUNT(*) FROM attendance a WHERE a.day = CURRENT_DATE AND a.mark = 'present')::text AS present,
       (SELECT COUNT(*) FROM learner WHERE status = 'active')::text AS expected`,
  );
  const money = await db.query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0)::text AS total FROM payments
     WHERE state = 'confirmed' AND paid_at::date = CURRENT_DATE`,
  );
  const present = Number(att.rows[0]!.present);
  const expected = Number(att.rows[0]!.expected);
  return {
    present,
    expected,
    rate: expected > 0 ? Math.round((present / expected) * 1000) / 10 : null,
    collected_today_cents: money.rows[0]!.total,
    active_learners: expected,
  };
}

// ---------------------------------------------------------------------------
// People: learners directory (staff) + class roster (teacher)
// ---------------------------------------------------------------------------

export async function listLearners(dbName: string, principal: Extract<Principal, { kind: "staff" }>, opts: { classId?: number; limit?: number } = {}) {
  return withSession(dbName, { userId: principal.userId, role: principal.role }, async (c) => {
    const r = await c.query<{
      id: string; admission_no: string; name: string; class: string | null; status: string; gender: string | null;
    }>(
      `SELECT l.id, l.admission_no,
              l.first_name || ' ' || COALESCE(l.middle_name || ' ', '') || l.last_name AS name,
              cl.name AS class, l.status::text, l.gender
       FROM learner l LEFT JOIN class cl ON cl.id = l.class_id
       WHERE ($1::int IS NULL OR l.class_id = $1::int)
       ORDER BY l.admission_no LIMIT $2`,
      [opts.classId ?? null, opts.limit ?? 200],
    );
    return r.rows;
  });
}

export async function listClasses(dbName: string, principal: Extract<Principal, { kind: "staff" }>) {
  return withSession(dbName, { userId: principal.userId, role: principal.role }, async (c) => {
    const r = await c.query<{ id: number; code: string; name: string; learners: string }>(
      `SELECT cl.id, cl.code, cl.name,
              (SELECT COUNT(*)::text FROM learner l WHERE l.class_id = cl.id AND l.status = 'active') AS learners
       FROM class cl ORDER BY cl.code`,
    );
    return r.rows;
  });
}

// ---------------------------------------------------------------------------
// Classroom: attendance marking (teacher write path)
// ---------------------------------------------------------------------------

export async function rosterForToday(dbName: string, principal: Extract<Principal, { kind: "staff" }>, classId: number) {
  return withSession(dbName, { userId: principal.userId, role: principal.role }, async (c) => {
    const r = await c.query<{ id: string; name: string; admission_no: string; mark: string | null }>(
      `SELECT l.id, l.first_name || ' ' || l.last_name AS name, l.admission_no, a.mark::text
       FROM learner l
       LEFT JOIN attendance a ON a.learner_id = l.id AND a.day = CURRENT_DATE
       WHERE l.class_id = $1 AND l.status = 'active'
       ORDER BY l.first_name`,
      [classId],
    );
    return r.rows;
  });
}

export async function markAttendance(
  dbName: string,
  principal: Extract<Principal, { kind: "staff" }>,
  marks: { learnerId: string; mark: string }[],
): Promise<number> {
  return withSession(dbName, { userId: principal.userId, role: principal.role }, async (c) => {
    let n = 0;
    for (const m of marks) {
      await c.query(
        `INSERT INTO attendance (learner_id, day, mark, marked_by)
         VALUES ($1, CURRENT_DATE, $2, $3)
         ON CONFLICT (learner_id, day, id) DO NOTHING`,
        [m.learnerId, m.mark, principal.userId],
      );
      n++;
    }
    return n;
  });
}

export async function listHomework(dbName: string, principal: Extract<Principal, { kind: "staff" }>, opts: { classId?: number } = {}) {
  return withSession(dbName, { userId: principal.userId, role: principal.role }, async (c) => {
    const r = await c.query<{ id: string; subject: string; title: string; body: string; due_on: string | null; class: string }>(
      `SELECT h.id, h.subject, h.title, h.body, h.due_on::text, cl.name AS class
       FROM homework h JOIN class cl ON cl.id = h.class_id
       WHERE ($1::int IS NULL OR h.class_id = $1::int)
       ORDER BY h.created_at DESC LIMIT 50`,
      [opts.classId ?? null],
    );
    return r.rows;
  });
}

export async function createHomework(
  dbName: string,
  principal: Extract<Principal, { kind: "staff" }>,
  input: { classId: number; subject: string; title: string; body: string; dueOn?: string },
) {
  return withSession(dbName, { userId: principal.userId, role: principal.role }, async (c) => {
    const r = await c.query<{ id: string }>(
      `INSERT INTO homework (class_id, subject, title, body, due_on, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [input.classId, input.subject, input.title, input.body, input.dueOn ?? null, principal.userId],
    );
    return r.rows[0]!.id;
  });
}

// ---------------------------------------------------------------------------
// Money: collections, balances, ledger (bursar/principal)
// ---------------------------------------------------------------------------

export async function collectionByClass(dbName: string, principal: Extract<Principal, { kind: "staff" }>) {
  return withSession(dbName, { userId: principal.userId, role: principal.role }, async (c) => {
    const r = await c.query<{ class: string; billed_cents: string; paid_cents: string }>(
      `SELECT cl.name AS class,
              COALESCE(SUM(fi.amount) FILTER (WHERE fi.is_optional = false), 0)::text AS billed_cents,
              COALESCE((SELECT SUM(p.amount) FROM payments p JOIN learner l2 ON l2.id = p.learner_id
                        WHERE l2.class_id = cl.id AND p.state = 'confirmed'), 0)::text AS paid_cents
       FROM class cl
       LEFT JOIN learner l ON l.class_id = cl.id
       LEFT JOIN fee_item fi ON fi.learner_id = l.id
       GROUP BY cl.id, cl.name ORDER BY cl.code`,
    );
    return r.rows;
  });
}

export async function recentPayments(dbName: string, principal: Extract<Principal, { kind: "staff" }>, limit = 20) {
  return withSession(dbName, { userId: principal.userId, role: principal.role }, async (c) => {
    const r = await c.query<{ receipt_no: string; learner: string; amount_cents: string; method: string; state: string; paid_at: string }>(
      `SELECT p.receipt_no,
              l.first_name || ' ' || l.last_name AS learner,
              p.amount::text AS amount_cents, p.method::text, p.state::text, p.paid_at::text
       FROM payments p JOIN learner l ON l.id = p.learner_id
       ORDER BY p.paid_at DESC LIMIT $1`,
      [limit],
    );
    return r.rows;
  });
}

export async function recordPayment(
  dbName: string,
  principal: Principal,
  input: { learnerId: string; amountCents: number; method: string; reference?: string },
) {
  const staff = principal.kind === "staff";
  const session = staff
    ? { userId: principal.userId, role: principal.role }
    : { userId: principal.guardianId, role: "guardian", guardianId: principal.guardianId };
  return withSession(dbName, session, async (c) => {
    const receipt = `R-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    const r = await c.query<{ id: string; receipt_no: string }>(
      `INSERT INTO payments (learner_id, amount, method, state, reference, receipt_no, recorded_by, paid_at)
       VALUES ($1, $2, $3, 'confirmed', $4, $5, $6, now())
       RETURNING id, receipt_no`,
      [
        input.learnerId,
        input.amountCents,
        input.method,
        input.reference ?? null,
        receipt,
        staff ? principal.userId : null, // guardians pay too; recorded_by is staff-only
      ],
    );
    await c.query(
      `INSERT INTO audit_log (actor_id, actor_kind, action, entity, entity_id, after)
       VALUES ($1, $2, 'payment.record', 'payments', $3, $4)`,
      [staff ? principal.userId : principal.guardianId, staff ? "staff" : "guardian", r.rows[0]!.id, JSON.stringify(input)],
    );
    return r.rows[0]!;
  });
}

// ---------------------------------------------------------------------------
// Talk: announcements (principal/admin write, everyone read)
// ---------------------------------------------------------------------------

export async function listAnnouncements(dbName: string, principal: Principal, limit = 20) {
  const session = principal.kind === "staff"
    ? { userId: principal.userId, role: principal.role }
    : { userId: principal.guardianId, role: "guardian", guardianId: principal.guardianId };
  return withSession(dbName, session, async (c) => {
    const r = await c.query<{ id: string; title: string; body: string; urgency: string; created_at: string }>(
      `SELECT id, title, body, urgency, created_at::text FROM announcement ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return r.rows;
  });
}

export async function createAnnouncement(
  dbName: string,
  principal: Extract<Principal, { kind: "staff" }>,
  input: { title: string; body: string; urgency: "alert" | "update"; audience: Record<string, unknown> },
) {
  return withSession(dbName, { userId: principal.userId, role: principal.role }, async (c) => {
    const r = await c.query<{ id: string }>(
      `INSERT INTO announcement (title, body, audience, urgency, channel, created_by)
       VALUES ($1, $2, $3::jsonb, $4, 'whatsapp', $5) RETURNING id`,
      [input.title, input.body, JSON.stringify(input.audience), input.urgency, principal.userId],
    );
    return r.rows[0]!.id;
  });
}

// ---------------------------------------------------------------------------
// Live watchers — tiny payloads polled by LiveRefresh; the hash drives
// router.refresh() so RSC pages update without heavy client state.
// ---------------------------------------------------------------------------

export async function pulseHash(dbName: string): Promise<string> {
  const db = getSchoolPool(dbName);
  const r = await db.query<{
    present: string; expected: string; paid_today: string; paid_count: string; ann: string;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM attendance WHERE day = CURRENT_DATE AND mark = 'present')::text AS present,
       (SELECT COUNT(*) FROM learner WHERE status = 'active')::text AS expected,
       (SELECT COALESCE(SUM(amount),0) FROM payments WHERE state='confirmed' AND paid_at::date = CURRENT_DATE)::text AS paid_today,
       (SELECT COUNT(*) FROM payments WHERE state='confirmed' AND paid_at::date = CURRENT_DATE)::text AS paid_count,
       (SELECT COALESCE(MAX(extract(epoch FROM created_at)),0) FROM announcement)::text AS ann`,
  );
  const row = r.rows[0]!;
  return `${row.present}/${row.expected}/${row.paid_today}/${row.paid_count}/${row.ann}`;
}

export async function guardianHash(dbName: string, guardianId: string): Promise<string> {
  return withSession(dbName, { userId: guardianId, role: "guardian", guardianId }, async (c) => {
    const r = await c.query<{ h: string | null }>(
      `SELECT
         (SELECT COALESCE(SUM(extract(epoch FROM paid_at))::text || ':' || COUNT(*), '0')
            FROM payments WHERE state='confirmed' AND learner_id IN (SELECT learner_id FROM learner_guardian WHERE guardian_id = $1))
         || '/' ||
         (SELECT COALESCE(MAX(extract(epoch FROM created_at))::text, '0') FROM announcement)
         || '/' ||
         (SELECT COALESCE(MAX(extract(epoch FROM due_on))::text || ':' || COUNT(*), '0') FROM homework
            WHERE due_on >= CURRENT_DATE AND class_id IN (SELECT class_id FROM learner WHERE id IN (SELECT learner_id FROM learner_guardian WHERE guardian_id = $1)))
         AS h`,
      [guardianId],
    );
    return r.rows[0]!.h ?? "0";
  });
}

// ---------------------------------------------------------------------------
// Messages: the delivery ledger (announcement -> guardian messages)
// ---------------------------------------------------------------------------

export interface MessageRow {
  id: string;
  title: string | null;
  guardian: string;
  learner: string | null;
  channel: string;
  state: string;
  created_at: string;
}

export async function listMessages(dbName: string, principal: Extract<Principal, { kind: "staff" }>, limit = 40): Promise<MessageRow[]> {
  return withSession(dbName, { userId: principal.userId, role: principal.role }, async (c) => {
    const r = await c.query<MessageRow>(
      `SELECT m.id::text, a.title, g.full_name AS guardian, l.first_name || ' ' || l.last_name AS learner,
              m.channel::text, m.state::text, m.created_at::text
       FROM message m
       JOIN guardian g ON g.id = m.guardian_id
       LEFT JOIN learner l ON l.id = m.learner_id
       LEFT JOIN announcement a ON a.id = m.announcement_id
       ORDER BY m.created_at DESC LIMIT $1`,
      [limit],
    );
    return r.rows;
  });
}

// ---------------------------------------------------------------------------
// People: staff directory (RLS: everyone sees staff rows per policy)
// ---------------------------------------------------------------------------

export interface StaffRow {
  id: string; full_name: string; role: string; email: string | null; phone: string | null; active: boolean; classes: string | null;
}

export async function listStaff(dbName: string, principal: Extract<Principal, { kind: "staff" }>): Promise<StaffRow[]> {
  return withSession(dbName, { userId: principal.userId, role: principal.role }, async (c) => {
    const r = await c.query<StaffRow>(
      `SELECT id::text, full_name, role::text, email::text, phone, active,
              CASE WHEN classes IS NULL THEN NULL ELSE array_to_string(classes, ', ') END AS classes
       FROM staff ORDER BY active DESC, role, full_name`,
    );
    return r.rows;
  });
}

// ---------------------------------------------------------------------------
// Money: levies (fee structures) + pending payments + confirm
// ---------------------------------------------------------------------------

export interface LevyRow { id: string; name: string; class: string | null; amount_cents: string; is_optional: boolean }

export async function listLevies(dbName: string, principal: Extract<Principal, { kind: "staff" }>): Promise<LevyRow[]> {
  return withSession(dbName, { userId: principal.userId, role: principal.role }, async (c) => {
    const r = await c.query<LevyRow>(
      `SELECT fs.id::text, fs.name, cl.name AS class, fs.amount::text AS amount_cents, fs.is_optional
       FROM fee_structure fs
       LEFT JOIN class cl ON cl.id = fs.class_id
       WHERE fs.term_id = (SELECT id FROM term ORDER BY starts_on DESC LIMIT 1)
       ORDER BY fs.is_optional, fs.name`,
    );
    return r.rows;
  });
}

export interface PendingPaymentRow {
  receipt_no: string; learner: string; amount_cents: string; method: string; reference: string | null; paid_at: string;
}

export async function listPendingPayments(
  dbName: string,
  principal: Extract<Principal, { kind: "staff" }>,
): Promise<PendingPaymentRow[]> {
  return withSession(dbName, { userId: principal.userId, role: principal.role }, async (c) => {
    const r = await c.query<PendingPaymentRow>(
      `SELECT p.receipt_no, l.first_name || ' ' || l.last_name AS learner,
              p.amount::text AS amount_cents, p.method::text, p.reference, p.paid_at::text
       FROM payments p JOIN learner l ON l.id = p.learner_id
       WHERE p.state = 'pending'
       ORDER BY p.paid_at ASC LIMIT 50`,
    );
    return r.rows;
  });
}

export async function confirmPayment(
  dbName: string,
  principal: Extract<Principal, { kind: "staff" }>,
  receiptNo: string,
): Promise<{ receipt_no: string }> {
  return withSession(dbName, { userId: principal.userId, role: principal.role }, async (c) => {
    const r = await c.query<{ receipt_no: string }>(
      `UPDATE payments SET state = 'confirmed' WHERE receipt_no = $1 AND state = 'pending' RETURNING receipt_no`,
      [receiptNo],
    );
    if (!r.rowCount) throw new Error("payment not found or not pending");
    await c.query(
      `INSERT INTO audit_log (actor_id, actor_kind, action, entity, entity_id, after)
       VALUES ($1, 'staff', 'payment.confirm', 'payments', $2, $3)`,
      [principal.userId, receiptNo, JSON.stringify({ receiptNo })],
    );
    return r.rows[0]!;
  });
}

// ---------------------------------------------------------------------------
// Settings: the school edits its own identity (everything-is-data, kept true)
// ---------------------------------------------------------------------------

export interface SettingsUpdate {
  name?: string;
  tagline?: string;
  motto?: string;
  contact_phone?: string | null;
  contact_email?: string | null;
  contact_address?: string | null;
  quote_text?: string | null;
  quote_author?: string | null;
  modules?: { title: string; body: string }[];
  nav?: Record<string, string[]>;
  prime_questions?: Record<string, string>;
}

export async function getSettings(dbName: string) {
  const db = getSchoolPool(dbName);
  const r = await db.query<{
    name: string; tagline: string | null; motto: string | null;
    contact_phone: string | null; contact_email: string | null; contact_address: string | null;
    quote_text: string | null; quote_author: string | null;
    modules_json: unknown; nav_json: unknown;
  }>(
    `SELECT name, tagline, motto, contact_phone, contact_email, contact_address,
            quote_text, quote_author, modules_json, nav_json
     FROM school_settings WHERE id = 'default'`,
  );
  if (!r.rowCount) throw new Error("school_settings missing");
  const row = r.rows[0]!;
  return {
    name: row.name,
    tagline: row.tagline,
    motto: row.motto,
    contact_phone: row.contact_phone,
    contact_email: row.contact_email,
    contact_address: row.contact_address,
    quote_text: row.quote_text,
    quote_author: row.quote_author,
    modules: (row.modules_json as { title: string; body: string }[] | null) ?? [],
    nav: (row.nav_json as Record<string, string[]> | null) ?? {},
    prime_questions: DEFAULT_PRIME,
  };
}

export async function updateSettings(
  dbName: string,
  principal: Extract<Principal, { kind: "staff" }>,
  input: SettingsUpdate,
): Promise<void> {
  if (principal.role !== "admin" && principal.role !== "principal") {
    throw new Error("only the principal or admin can change school settings");
  }
  const db = getSchoolPool(dbName);
  await db.query(
    `UPDATE school_settings SET
       name = COALESCE($1, name),
       tagline = COALESCE($2, tagline),
       motto = COALESCE($3, motto),
       contact_phone = COALESCE($4, contact_phone),
       contact_email = COALESCE($5, contact_email),
       contact_address = COALESCE($6, contact_address),
       quote_text = COALESCE($7, quote_text),
       quote_author = COALESCE($8, quote_author),
       modules_json = COALESCE($9::jsonb, modules_json),
       nav_json = COALESCE($10::jsonb, nav_json),
       updated_at = now()
     WHERE id = 'default'`,
    [
      input.name ?? null,
      input.tagline ?? null,
      input.motto ?? null,
      input.contact_phone ?? null,
      input.contact_email ?? null,
      input.contact_address ?? null,
      input.quote_text ?? null,
      input.quote_author ?? null,
      input.modules ? JSON.stringify(input.modules) : null,
      input.nav ? JSON.stringify(input.nav) : null,
    ],
  );
  await db.query(
    `INSERT INTO audit_log (actor_id, actor_kind, action, entity, entity_id, after)
     VALUES ($1, 'staff', 'settings.update', 'school_settings', 'default', $2)`,
    [principal.userId, JSON.stringify({ keys: Object.keys(input) })],
  ).catch(() => undefined); // audit RLS: only admin/principal read, but insert via app role is allowed
}

// ---------------------------------------------------------------------------
// Guardian profile + message history (Profile / Messages screens)
// ---------------------------------------------------------------------------

export interface GuardianProfile {
  full_name: string;
  phone: string;
  email: string | null;
  relationship: string;
  wa_opt_in: boolean;
  sms_fallback: boolean;
  learners: { id: string; name: string; class: string | null }[];
}

export async function guardianProfile(dbName: string, guardianId: string): Promise<GuardianProfile> {
  return withSession(dbName, { userId: guardianId, role: "guardian", guardianId }, async (c) => {
    const g = await c.query<{
      full_name: string; phone: string; email: string | null; relationship: string;
      wa_opt_in: boolean; sms_fallback: boolean;
    }>(
      `SELECT full_name, phone, email::text, relationship, wa_opt_in, sms_fallback
       FROM guardian WHERE id = $1`,
      [guardianId],
    );
    if (!g.rowCount) throw new Error("guardian not found");
    const kids = await c.query<{ id: string; name: string; class: string | null }>(
      `SELECT l.id::text, l.first_name || ' ' || l.last_name AS name, cl.name AS class
       FROM learner_guardian lg JOIN learner l ON l.id = lg.learner_id
       LEFT JOIN class cl ON cl.id = l.class_id
       WHERE lg.guardian_id = $1 ORDER BY l.first_name`,
      [guardianId],
    );
    return { ...g.rows[0]!, learners: kids.rows };
  });
}

export interface GuardianMessageRow {
  id: string; title: string | null; body: string | null; urgency: string | null;
  channel: string; state: string; created_at: string;
}

export async function guardianMessages(dbName: string, guardianId: string, limit = 50): Promise<GuardianMessageRow[]> {
  return withSession(dbName, { userId: guardianId, role: "guardian", guardianId }, async (c) => {
    const r = await c.query<GuardianMessageRow>(
      `SELECT m.id::text, a.title, a.body, a.urgency::text, m.channel::text, m.state::text, m.created_at::text
       FROM message m
       LEFT JOIN announcement a ON a.id = m.announcement_id
       WHERE m.guardian_id = $1
       ORDER BY m.created_at DESC LIMIT $2`,
      [guardianId, limit],
    );
    return r.rows;
  });
}

// ---------------------------------------------------------------------------
// Insights (principal): one query per number, straight from the DB
// ---------------------------------------------------------------------------

export async function insights(dbName: string, principal: Extract<Principal, { kind: "staff" }>) {
  return withSession(dbName, { userId: principal.userId, role: principal.role }, async (c) => {
    const learners = await c.query<{ active: string; boarding: string }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'active')::text AS active,
              COUNT(*) FILTER (WHERE boarding)::text AS boarding
       FROM learner`,
    );
    const guardians = await c.query<{ total: string; wa: string }>(
      `SELECT COUNT(*)::text AS total, COUNT(*) FILTER (WHERE wa_opt_in)::text AS wa FROM guardian WHERE active`,
    );
    const attendance7 = await c.query<{ day: string; present: string; total: string }>(
      `SELECT day::text, COUNT(*) FILTER (WHERE mark = 'present')::text AS present, COUNT(*)::text AS total
       FROM attendance WHERE day > CURRENT_DATE - INTERVAL '7 days'
       GROUP BY day ORDER BY day`,
    );
    const collection = await collectionByClass(dbName, principal);
    return {
      learners: learners.rows[0]!,
      guardians: guardians.rows[0]!,
      attendance7: attendance7.rows,
      collection,
    };
  });
}
