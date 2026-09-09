export default function Down() {
  return (
    <div className="grid min-h-dvh place-items-center p-s5 text-center">
      <div>
        <h1 className="text-lg font-semibold">The school system isn't set up yet</h1>
        <p className="mx-auto mt-s2 max-w-md text-sm text-muted">
          This address doesn't point to a provisioned school. Run{" "}
          <code className="rounded bg-paper-100 px-1 py-0.5 text-xs">pnpm provision:school</code> then{" "}
          <code className="rounded bg-paper-100 px-1 py-0.5 text-xs">pnpm seed:demo</code> from the backend, and refresh.
        </p>
      </div>
    </div>
  );
}
