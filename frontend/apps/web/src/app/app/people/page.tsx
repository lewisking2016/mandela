import { requireSession, requireBootstrap, getLearners, getClasses } from "@/lib/api";
import { Card, CardHead, DataTable, StatusPill, EmptyState, SerifHeader } from "@mandela/ui";
import { redirect } from "next/navigation";

/** People — the directory. Columns and rows come straight from the API. */
export default async function PeoplePage() {
  const me = await requireSession();
  await requireBootstrap();
  if (me.principal.kind !== "staff") redirect("/app");
  const [learners, classes] = await Promise.all([getLearners(), getClasses()]);

  return (
    <div>
      <SerifHeader
        crumb="People · Directory"
        title={<>Everyone, <em>in one place.</em></>}
        sub="Classes, learners and admission numbers — the school's own directory, straight from the database."
      />

      <div className="mt-s7 grid gap-s3h">
        <Card>
          <CardHead title="Classes" sub={`${classes.classes.length} classes this term`} />
          {classes.classes.length === 0 ? (
            <EmptyState title="No classes yet" body="Add classes to start enrolling learners." />
          ) : (
            <DataTable
              columns={[
                { key: "code", title: "Code" },
                { key: "name", title: "Class" },
                { key: "learners", title: "Learners", align: "right" },
              ]}
              rows={classes.classes}
            />
          )}
        </Card>

        <Card>
          <CardHead title="Learners" sub={`${learners.learners.length} shown`} />
          {learners.learners.length === 0 ? (
            <EmptyState title="No learners yet" body="Enrol learners and they appear here instantly." />
          ) : (
            <DataTable
              columns={[
                { key: "admission_no", title: "Adm no" },
                { key: "name", title: "Name" },
                { key: "class", title: "Class" },
                { key: "status", title: "Status" },
              ]}
              rows={learners.learners.map((l) => ({
                admission_no: <span className="font-mono text-xs">{l.admission_no}</span>,
                name: l.name,
                class: l.class ?? "—",
                status: <StatusPill tone={l.status === "active" ? "ok" : "neutral"}>{l.status}</StatusPill>,
              }))}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
