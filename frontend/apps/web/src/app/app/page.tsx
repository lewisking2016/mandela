import { requireSession, requireBootstrap, getStaffHome, getGuardianHome, getAnnouncements, getCollections, getPayments, type StaffHomeData, type GuardianHomeData } from "@/lib/api";
import { Card, CardHead, KpiCard, Meter, Delta, Money, StatusPill, EmptyState, SerifHeader, Reveal, CountUpMoney, CountUp } from "@mandela/ui";
import { AppShell } from "./AppShell";
import { AppLiveBar } from "./LiveBar";
import Link from "next/link";

/**
 * /app — the role's world, in comp 02's bento — now alive: numbers count
 * up, the header polls for school changes and refreshes RSC content,
 * rows reveal in a stagger. The shell (tabs, prime question) is resolved
 * from the session role + bootstrap payload; every number from the DB.
 */
export default async function AppHome() {
  const me = await requireSession();
  const boot = await requireBootstrap();
  const roleKey = me.principal.kind === "guardian" ? "parent" : me.principal.role ?? "admin";
  const nav = boot.nav[roleKey] ?? [];
  const prime = boot.prime_questions[roleKey] ?? "";

  const isGuardian = me.principal.kind === "guardian";
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = me.principal.full_name.split(/\s+/)[0] ?? me.principal.full_name;
  const today = new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" });

  const [home, announcements, collections, payments] = await Promise.all([
    isGuardian ? getGuardianHome() : getStaffHome(),
    getAnnouncements(),
    isGuardian ? Promise.resolve({ collections: [] }) : getCollections(),
    isGuardian ? Promise.resolve({ payments: [] }) : getPayments(),
  ]);

  const canSeeMoney = !isGuardian && ["bursar", "principal", "admin"].includes(me.principal.role ?? "");

  return (
    <AppShell
      schoolName={boot.school.name}
      motto={boot.school.motto}
      logoPath={boot.school.logo_svg_path}
      tabs={nav}
      userName={me.principal.full_name}
      userMeta={isGuardian ? "Guardian · signed in" : `${(me.principal.role ?? "staff").replace(/^\w/, (c) => c.toUpperCase())} · signed in`}
    >
      <SerifHeader
        crumb={`Today · ${today}`}
        title={<>{greet}, <em>{firstName}.</em></>}
        sub={prime}
        actions={<AppLiveBar />}
      />

      <div className="mt-s7 grid gap-s3h">
        {isGuardian ? (
          <GuardianHome data={home as GuardianHomeData} />
        ) : (
          <StaffHome
            data={home as StaffHomeData}
            role={me.principal.role ?? "admin"}
            canSeeMoney={canSeeMoney}
            collections={(collections as { collections: { class: string; billed_cents: string; paid_cents: string }[] }).collections}
            payments={(payments as { payments: { receipt_no: string; learner: string; amount_cents: string; method: string; state: string; paid_at: string }[] }).payments}
          />
        )}

        {/* Latest from the school — announcements feed */}
        <Reveal delay={200}>
          <section className="mt-s3h grid gap-s3h lg:grid-cols-2">
            <Card>
              <CardHead
                title="Latest from the school"
                sub="Announcements to guardians"
                action={
                  !isGuardian ? (
                    <Link href="/app/broadcast" className="inline-flex h-11 items-center text-[12.5px] font-semibold underline decoration-paper-300 underline-offset-4 hover:decoration-primary">
                      Broadcast →
                    </Link>
                  ) : undefined
                }
              />
              {announcements.announcements.length === 0 ? (
                <EmptyState title="No announcements yet" body="Messages from the school will appear here." />
              ) : (
                <FeedRows
                  rows={announcements.announcements.slice(0, 3).map((a) => ({
                    title: a.title,
                    meta: new Date(a.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" }),
                    pill: a.urgency === "alert" ? { tone: "warn" as const, label: "Alert" } : { tone: "ok" as const, label: "Sent" },
                  }))}
                />
              )}
            </Card>
          </section>
        </Reveal>
      </div>
    </AppShell>
  );
}

type PaymentRow = { receipt_no: string; learner: string; amount_cents: string; method: string; state: string; paid_at: string };
type CollectionRow = { class: string; billed_cents: string; paid_cents: string };

function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

function FeedRows({ rows }: { rows: { title: string; meta: string; pill: { tone: "ok" | "warn" | "danger" | "neutral"; label: string } }[] }) {
  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-s3 border-t border-paper-200 py-s3 transition-colors first:border-t-0 first:pt-0 hover:bg-paper-50">
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold">{r.title}</p>
            <p className="mt-0.5 text-[11.5px] text-muted">{r.meta}</p>
          </div>
          <StatusPill tone={r.pill.tone}>{r.pill.label}</StatusPill>
        </div>
      ))}
    </div>
  );
}

function StaffHome({
  data,
  role,
  canSeeMoney,
  collections,
  payments,
}: {
  data: StaffHomeData;
  role: string;
  canSeeMoney: boolean;
  collections: CollectionRow[];
  payments: PaymentRow[];
}) {
  if ("error" in data) {
    return <EmptyState title="Could not load today" body="The school database did not respond. Try again shortly." />;
  }
  const att = data.today;
  const attRate = att.expected > 0 ? Math.round((att.present / att.expected) * 100) : 0;
  const collectedTerm = Number(data.collected_term_cents);
  const billedTerm = Number(data.money.expected_term_cents);
  const outstanding = Math.max(billedTerm - collectedTerm, 0);
  const collectRate = billedTerm > 0 ? Math.round((collectedTerm / billedTerm) * 100) : 0;
  const max7 = Math.max(...data.last7.map((d) => Number(d.total)), 1);

  return (
    <div className="grid gap-s3h">
      {/* Row 1 — the three answers, counting up */}
      <Reveal>
        <div className="grid gap-s3h sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            ink
            label="Collected this term"
            value={<CountUpMoney cents={collectedTerm} />}
            note={`of ${new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(billedTerm / 100)} billed`}
          >
            <div className="flex h-16 items-end gap-2.5">
              {data.last7.map((d, i) => {
                const pct = Math.round((Number(d.present) / max7) * 100);
                const empty = Number(d.total) === 0;
                return (
                  <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                    <div
                      aria-hidden
                      className={`w-full rounded-md rounded-b-sm transition-[height] duration-700 ease-[cubic-bezier(.22,1,.36,1)] ${empty ? "bg-deep-line" : "bg-white"}`}
                      style={{ height: `${Math.max(pct, 6)}%` }}
                    />
                    <span className="font-mono text-[9.5px] text-ink-400">{d.day}</span>
                  </div>
                );
              })}
            </div>
          </KpiCard>

          {canSeeMoney ? (
            <KpiCard
              label="Outstanding"
              tone="danger"
              value={<CountUpMoney cents={outstanding} />}
              note={`across ${collections.length} ${collections.length === 1 ? "class" : "classes"} · ${collectRate}% collected`}
            >
              <div>
                <Delta tone={outstanding > 0 ? "danger" : "ok"}>
                  {outstanding > 0 ? "▲ still to collect" : "✓ fully collected"}
                </Delta>
              </div>
            </KpiCard>
          ) : (
            <KpiCard label="Active learners" value={<CountUp value={data.count} />} note="learners on roll" />
          )}

          <KpiCard
            label="Attendance today"
            value={<><CountUp value={attRate} /><span className="text-xl font-medium text-ink-500">%</span></>}
            note={`${att.present} present · ${att.absent} absent`}
          >
            <div>
              <Delta tone={att.marked >= att.expected && att.expected > 0 ? "ok" : "neutral"}>
                {att.marked} of {att.expected} marked
              </Delta>
            </div>
          </KpiCard>
        </div>
      </Reveal>

      {/* Row 2 — ledger + quick actions */}
      <Reveal delay={80}>
        <div className="grid gap-s3h lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHead
              title="Recent payments"
              sub={canSeeMoney ? "Receipts issued this week" : "Money rows are hidden for your role"}
              action={
                canSeeMoney ? (
                  <Link href="/app/money" className="inline-flex h-11 items-center text-[12.5px] font-semibold underline decoration-paper-300 underline-offset-4 hover:decoration-primary">
                    View ledger →
                  </Link>
                ) : undefined
              }
            />
            {payments.length === 0 ? (
              <EmptyState title="No payments yet" body="Confirmed payments appear here instantly." />
            ) : (
              <div>
                {payments.slice(0, 4).map((p) => (
                  <div key={p.receipt_no} className="flex items-center justify-between gap-s3 border-t border-paper-200 py-s3 transition-colors first:border-t-0 first:pt-0 hover:bg-paper-50">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-paper-100 text-[10.5px] font-semibold text-ink-700">
                        {initialsOf(p.learner)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-semibold">{p.learner}</span>
                        <span className="block truncate font-mono text-[11.5px] text-muted">
                          {p.receipt_no} · {p.method} · {new Date(p.paid_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                        </span>
                      </span>
                    </div>
                    <span className="numeral shrink-0 text-sm font-semibold text-ok">
                      <Money cents={p.amount_cents} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHead title="Quick actions" />
            <div className="grid gap-2.5">
              {(role === "teacher"
                ? [
                    { href: "/app/mark", label: "Mark attendance" },
                    { href: "/app/homework", label: "Assign homework" },
                    { href: "/app/class", label: "My class" },
                  ]
                : canSeeMoney
                  ? [
                      { href: "/app/money", label: "Record a payment" },
                      { href: "/app/mark", label: "Mark attendance" },
                      { href: "/app/broadcast", label: "Send announcement" },
                    ]
                  : [
                      { href: "/app/broadcast", label: "Send announcement" },
                      { href: "/app/people", label: "Open the directory" },
                      { href: "/app/insights", label: "See insights" },
                    ]
              ).map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="flex min-h-[48px] items-center justify-between rounded-sm border border-paper-200 px-4 py-3 text-[13.5px] font-semibold text-text transition-all hover:-translate-y-px hover:bg-paper-50 hover:shadow-1"
                >
                  {a.label}
                  <span aria-hidden className="text-muted transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] group-hover:translate-x-0.5">→</span>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </Reveal>

      {/* Row 3 — collections */}
      {canSeeMoney ? (
        <Reveal delay={160}>
          <Card>
            <CardHead
              title="Collections by class"
              sub="Billed vs collected, this term"
              action={
                <Link href="/app/money" className="inline-flex h-11 items-center text-[12.5px] font-semibold underline decoration-paper-300 underline-offset-4 hover:decoration-primary">
                  All classes →
                </Link>
              }
            />
            {collections.length === 0 ? (
              <EmptyState title="No fee items yet" body="Collections appear once fee items are billed." />
            ) : (
              <div>
                {collections.slice(0, 4).map((c) => {
                  const billed = Number(c.billed_cents);
                  const paid = Number(c.paid_cents);
                  const pct = billed > 0 ? Math.round((paid / billed) * 100) : 0;
                  return (
                    <div key={c.class} className="flex items-center justify-between gap-s3 border-t border-paper-200 py-s3 transition-colors first:border-t-0 first:pt-0 hover:bg-paper-50">
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold">{c.class}</p>
                        <p className="mt-0.5 text-[11.5px] text-muted tabular-nums">
                          {new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(billed / 100)} billed
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2.5">
                        <span className="numeral text-sm font-semibold">
                          <Money cents={paid} />
                        </span>
                        <StatusPill tone={pct >= 90 ? "ok" : pct >= 50 ? "warn" : "danger"}>{pct}%</StatusPill>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Reveal>
      ) : null}
    </div>
  );
}

function GuardianHome({ data }: { data: GuardianHomeData }) {
  if ("error" in data) {
    return <EmptyState title="Could not load your family" body="The school database did not respond. Try again shortly." />;
  }
  return (
    <Reveal>
      <div className="grid gap-s3h lg:grid-cols-2">
        {data.learners.map((l) => {
          const due = Number(data.due_cents[l.id] ?? 0);
          const paid = Number(data.paid_this_term_cents[l.id] ?? 0);
          const balance = Math.max(due - paid, 0);
          const pct = due > 0 ? Math.round((paid / due) * 100) : 100;
          return (
            <Card key={l.id}>
              <CardHead
                title={l.name}
                sub={l.class ?? undefined}
                action={
                  balance <= 0 ? (
                    <StatusPill tone="ok">Fully paid</StatusPill>
                  ) : (
                    <StatusPill tone="danger">Balance due</StatusPill>
                  )
                }
              />
              <div className="grid grid-cols-3 gap-s3">
                <div>
                  <p className="microlabel">Billed</p>
                  <p className="numeral mt-1.5 text-lg font-semibold"><CountUpMoney cents={due} /></p>
                </div>
                <div>
                  <p className="microlabel">Paid</p>
                  <p className="numeral mt-1.5 text-lg font-semibold text-ok"><CountUpMoney cents={paid} /></p>
                </div>
                <div>
                  <p className="microlabel">Balance</p>
                  <p className={`numeral mt-1.5 text-lg font-semibold ${balance > 0 ? "text-danger" : "text-ok"}`}>
                    <CountUpMoney cents={balance} />
                  </p>
                </div>
              </div>
              <div className="mt-s4">
                <Meter value={pct} ok={pct >= 100} />
              </div>
              {data.next_due && data.next_due.learner === l.name ? (
                <p className="mt-s3 font-mono text-[11.5px] text-muted">
                  Latest item: {data.next_due.item} — <Money cents={data.next_due.amount_cents} />
                </p>
              ) : null}
            </Card>
          );
        })}

        {data.homework_due.length > 0 ? (
          <Card>
            <CardHead title="Homework coming due" sub="From your children's classes" />
            <div>
              {data.homework_due.map((h, i) => (
                <div key={i} className="flex items-center justify-between gap-s3 border-t border-paper-200 py-s3 transition-colors first:border-t-0 first:pt-0 hover:bg-paper-50">
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold">{h.learner} · {h.subject}</p>
                    <p className="mt-0.5 truncate text-[12px] text-muted">{h.title}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[11.5px] text-muted">{h.due_on}</span>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>
    </Reveal>
  );
}
