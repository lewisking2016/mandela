import { cn } from "../cn";

/**
 * DataTable — the comp's table: mono uppercase header, hairline rows,
 * 13.5px body, right-aligned tabular numerals. Columns come from the API
 * payload; cells render as text or pre-rendered nodes (StatusPill, Money).
 */
export interface TableColumn {
  key: string;
  title: string;
  align?: "left" | "right";
}

export function DataTable({
  columns,
  rows,
  className,
  empty,
}: {
  columns: readonly TableColumn[];
  rows: readonly unknown[];
  className?: string;
  empty?: React.ReactNode;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div className={cn("min-w-0 overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  "microlabel px-s3 pb-s2 pt-s1 font-medium",
                  c.align === "right" ? "text-right" : "text-left",
                )}
              >
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-paper-200 last:border-0 hover:bg-paper-50">
              {columns.map((c) => {
                const cell = (row as Record<string, unknown>)[c.key];
                return (
                  <td
                    key={c.key}
                    className={cn(
                      "px-s3 py-s3 text-[13.5px]",
                      c.align === "right" ? "text-right font-semibold tabular-nums" : "text-left",
                    )}
                  >
                    {cell == null ? "" : (cell as React.ReactNode)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
