import { Body, Controller, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import * as z from "zod";
import * as web from "./queries.js";
import { resolveTenant } from "./queries.js";
import { getSchoolPool } from "../db/pool.js";

/**
 * Web REST surface — consumed by the Next.js app (frontend/).
 * Auth: `mandela_session` cookie (HMAC-signed token). In dev the app may
 * also POST who the user is; production moves to better-auth + cookies.
 * Every response is derived from the tenant's school database.
 */

const SESSION_COOKIE = "mandela_session";

function tenantFromReq(req: Request): Promise<{ dbName: string; slug: string }> {
  return (async () => {
    // The Next.js server forwards the original school host via x-mandela-host.
    const host = (req.headers["x-mandela-host"] as string | undefined) ?? req.headers.host;
    const t = await resolveTenant(host);
    if (!t) {
      throw new Error("no tenant resolved — provision a school or set WEB_DEFAULT_TENANT");
    }
    return t;
  })();
}

function principalFromReq(req: Request): web.Principal | null {
  return web.verifyToken(parseCookies(req)[SESSION_COOKIE]);
}

// Tiny cookie parse/serialize (avoids a dependency; better-auth replaces later)
function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

@Controller("web")
export class WebController {
  // -- session ---------------------------------------------------------------

  @Post("login/staff")
  @HttpCode(200)
  async loginStaff(@Req() req: Request, @Body() body: unknown) {
    const input = z.object({ email: z.string().email() }).parse(body);
    const tenant = await tenantFromReq(req);
    const result = await web.resolveStaffLogin(tenant.dbName, input.email);
    if (!result) return { ok: false as const, error: "No active staff with that email." };
    const res = req.res!;
    res.cookie(SESSION_COOKIE, result.token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 3600 * 1000,
      path: "/",
    });
    // token is also returned so server-side consumers (Next.js server actions)
    // can set their own cookie jar.
    return { ok: true as const, staff: result.staff, token: result.token };
  }

  @Post("login/guardian")
  @HttpCode(200)
  async loginGuardian(@Req() req: Request, @Body() body: unknown) {
    const input = z.object({ phone: z.string().regex(/^2547\d{8}$/) }).parse(body);
    const tenant = await tenantFromReq(req);
    const result = await web.resolveGuardianLogin(tenant.dbName, input.phone);
    if (!result) return { ok: false as const, error: "No guardian registered on that phone." };
    const res = req.res!;
    res.cookie(SESSION_COOKIE, result.token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 3600 * 1000,
      path: "/",
    });
    return { ok: true as const, guardian: result.guardian, token: result.token };
  }

  @Post("logout")
  @HttpCode(200)
  logout(@Req() req: Request) {
    req.res?.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  }

  @Get("whoami")
  async whoami(@Req() req: Request) {
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal) return { authenticated: false as const, tenant: tenant.slug };
    if (principal.kind === "staff") {
      const db = getSchoolPool(tenant.dbName);
      const r = await db.query<{ full_name: string; role: string; email: string | null }>(
        `SELECT full_name, role::text AS role, email FROM staff WHERE id = $1`,
        [principal.userId],
      );
      if (!r.rowCount) return { authenticated: false as const, tenant: tenant.slug };
      return { authenticated: true as const, tenant: tenant.slug, principal: { kind: "staff" as const, ...r.rows[0] } };
    }
    const db = getSchoolPool(tenant.dbName);
    const r = await db.query<{ full_name: string }>(
      `SELECT full_name FROM guardian WHERE id = $1`,
      [principal.guardianId],
    );
    if (!r.rowCount) return { authenticated: false as const, tenant: tenant.slug };
    return { authenticated: true as const, tenant: tenant.slug, principal: { kind: "guardian" as const, ...r.rows[0] } };
  }

  // -- branding + navigation (the shell is data) ------------------------------

  @Get("bootstrap")
  async bootstrap(@Req() req: Request) {
    const tenant = await tenantFromReq(req);
    const boot = await web.getBootstrap(tenant.dbName);
    return { tenant: tenant.slug, ...boot };
  }

  /** Public aggregates for the landing's live card — no session, no personal rows. */
  @Get("pulse")
  async pulse(@Req() req: Request) {
    const tenant = await tenantFromReq(req);
    return web.publicPulse(tenant.dbName);
  }

  /** Cheap change-detection payloads for LiveRefresh polling. */
  @Get("watch/staff")
  async watchStaff(@Req() req: Request) {
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal || principal.kind !== "staff") return { error: "staff session required" };
    return { hash: await web.pulseHash(tenant.dbName) };
  }

  @Get("watch/guardian")
  async watchGuardian(@Req() req: Request) {
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal || principal.kind !== "guardian") return { error: "guardian session required" };
    return { hash: await web.guardianHash(tenant.dbName, principal.guardianId) };
  }

  // -- role homes -------------------------------------------------------------

  @Get("home/guardian")
  async guardianHome(@Req() req: Request) {
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal || principal.kind !== "guardian") return { error: "guardian session required" };
    return web.guardianHome(tenant.dbName, principal.guardianId);
  }

  @Get("home/staff")
  async staffHome(@Req() req: Request) {
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal || principal.kind !== "staff") return { error: "staff session required" };
    return web.staffHome(tenant.dbName, principal);
  }

  // -- people ------------------------------------------------------------------

  @Get("learners")
  async learners(@Req() req: Request) {
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal || principal.kind !== "staff") return { error: "staff session required" };
    return { learners: await web.listLearners(tenant.dbName, principal) };
  }

  @Get("classes")
  async classes(@Req() req: Request) {
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal || principal.kind !== "staff") return { error: "staff session required" };
    return { classes: await web.listClasses(tenant.dbName, principal) };
  }

  // -- classroom ----------------------------------------------------------------

  @Get("roster/:classId")
  async roster(@Req() req: Request, @Param("classId") classId: string) {
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal || principal.kind !== "staff") return { error: "staff session required" };
    return { roster: await web.rosterForToday(tenant.dbName, principal, Number(classId)) };
  }

  @Post("attendance")
  @HttpCode(200)
  async markAttendance(@Req() req: Request, @Body() body: unknown) {
    const input = z
      .object({
        marks: z.array(z.object({ learnerId: z.string().uuid(), mark: z.enum(["present", "absent", "late", "excused"]) })).min(1),
      })
      .parse(body);
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal || principal.kind !== "staff") return { error: "staff session required" };
    const marked = await web.markAttendance(tenant.dbName, principal, input.marks);
    return { ok: true, marked };
  }

  @Get("homework")
  async homework(@Req() req: Request) {
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal || principal.kind !== "staff") return { error: "staff session required" };
    return { homework: await web.listHomework(tenant.dbName, principal) };
  }

  @Post("homework")
  @HttpCode(200)
  async createHomework(@Req() req: Request, @Body() body: unknown) {
    const input = z
      .object({
        classId: z.number().int(),
        subject: z.string().min(1),
        title: z.string().min(1),
        body: z.string().min(1),
        dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      .parse(body);
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal || principal.kind !== "staff") return { error: "staff session required" };
    const id = await web.createHomework(tenant.dbName, principal, input);
    return { ok: true, id };
  }

  // -- money ---------------------------------------------------------------------

  @Get("money/collections")
  async collections(@Req() req: Request) {
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal || principal.kind !== "staff") return { error: "staff session required" };
    return { collections: await web.collectionByClass(tenant.dbName, principal) };
  }

  @Get("money/payments")
  async payments(@Req() req: Request) {
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal || principal.kind !== "staff") return { error: "staff session required" };
    return { payments: await web.recentPayments(tenant.dbName, principal) };
  }

  @Post("money/payments")
  @HttpCode(200)
  async recordPayment(@Req() req: Request, @Body() body: unknown) {
    const input = z
      .object({
        learnerId: z.string().uuid(),
        amountCents: z.number().int().positive(),
        method: z.enum(["mpesa", "bank", "cash", "cheque"]),
        reference: z.string().max(80).optional(),
      })
      .parse(body);
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal) return { error: "session required" };
    const result = await web.recordPayment(tenant.dbName, principal, input);
    return { ok: true, ...result };
  }

  // -- talk ------------------------------------------------------------------------

  @Get("messages")
  async messages(@Req() req: Request) {
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal || principal.kind !== "staff") return { error: "staff session required" };
    return { messages: await web.listMessages(tenant.dbName, principal) };
  }

  @Get("announcements")
  async announcements(@Req() req: Request) {
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal) return { error: "session required" };
    return { announcements: await web.listAnnouncements(tenant.dbName, principal) };
  }

  @Post("announcements")
  @HttpCode(200)
  async createAnnouncement(@Req() req: Request, @Body() body: unknown) {
    const input = z
      .object({
        title: z.string().min(1).max(120),
        body: z.string().min(1),
        urgency: z.enum(["alert", "update"]).default("update"),
        audience: z.record(z.unknown()).default({ all: true }),
      })
      .parse(body);
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal || principal.kind !== "staff") return { error: "staff session required" };
    const id = await web.createAnnouncement(tenant.dbName, principal, input);
    return { ok: true, id };
  }

  // -- insights ----------------------------------------------------------------------

  @Get("insights")
  async insights(@Req() req: Request) {
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal || principal.kind !== "staff") return { error: "staff session required" };
    return web.insights(tenant.dbName, principal);
  }

  // -- people: staff directory ----------------------------------------------------

  @Get("staff")
  async staff(@Req() req: Request) {
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal || principal.kind !== "staff") return { error: "staff session required" };
    return { staff: await web.listStaff(tenant.dbName, principal) };
  }

  // -- money: levies + pending payments --------------------------------------------

  @Get("money/levies")
  async levies(@Req() req: Request) {
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal || principal.kind !== "staff") return { error: "staff session required" };
    return { levies: await web.listLevies(tenant.dbName, principal) };
  }

  @Get("money/pending")
  async pending(@Req() req: Request) {
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal || principal.kind !== "staff") return { error: "staff session required" };
    return { pending: await web.listPendingPayments(tenant.dbName, principal) };
  }

  @Post("money/payments/confirm")
  @HttpCode(200)
  async confirmPayment(@Req() req: Request, @Body() body: unknown) {
    const input = z.object({ receiptNo: z.string().min(3).max(40) }).parse(body);
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal || principal.kind !== "staff") return { error: "staff session required" };
    const result = await web.confirmPayment(tenant.dbName, principal, input.receiptNo);
    return { ok: true, ...result };
  }

  // -- settings: the school edits its own identity ----------------------------------

  @Get("settings")
  async settings(@Req() req: Request) {
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal || principal.kind !== "staff") return { error: "staff session required" };
    return web.getSettings(tenant.dbName);
  }

  @Post("settings")
  @HttpCode(200)
  async updateSettings(@Req() req: Request, @Body() body: unknown) {
    const input = z
      .object({
        name: z.string().min(1).max(120).optional(),
        tagline: z.string().max(200).optional(),
        motto: z.string().max(160).optional(),
        contact_phone: z.string().max(30).nullable().optional(),
        contact_email: z.string().max(120).nullable().optional(),
        contact_address: z.string().max(160).nullable().optional(),
        quote_text: z.string().max(400).nullable().optional(),
        quote_author: z.string().max(120).nullable().optional(),
        modules: z.array(z.object({ title: z.string().min(1).max(60), body: z.string().min(1).max(300) })).max(8).optional(),
        nav: z.record(z.array(z.string().max(24)).max(6)).optional(),
        prime_questions: z.record(z.string().max(160)).optional(),
      })
      .parse(body);
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal || principal.kind !== "staff") return { error: "staff session required" };
    try {
      await web.updateSettings(tenant.dbName, principal, input);
      return { ok: true };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  // -- guardian: profile + message history ------------------------------------------

  @Get("guardian/profile")
  async guardianProfile(@Req() req: Request) {
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal || principal.kind !== "guardian") return { error: "guardian session required" };
    return web.guardianProfile(tenant.dbName, principal.guardianId);
  }

  @Get("guardian/messages")
  async guardianMessages(@Req() req: Request) {
    const tenant = await tenantFromReq(req);
    const principal = principalFromReq(req);
    if (!principal || principal.kind !== "guardian") return { error: "guardian session required" };
    return { messages: await web.guardianMessages(tenant.dbName, principal.guardianId) };
  }
}
