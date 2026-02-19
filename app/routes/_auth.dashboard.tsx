import { useRouteLoaderData } from "react-router";

export default function Dashboard() {
  const parentData = useRouteLoaderData("routes/_auth") as any;
  const orgName = parentData?.currentOrg?.name ?? "";

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-2">Dashboard</h1>
      <p className="text-[0.9375rem] text-muted-foreground mb-8">
        Welcome to {orgName}
      </p>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3">
            Projects
          </h3>
          <p className="text-3xl font-semibold mb-1 text-card-foreground">0</p>
          <p className="text-[0.8125rem] text-muted-foreground">
            Active projects
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3">
            API Calls
          </h3>
          <p className="text-3xl font-semibold mb-1 text-card-foreground">0</p>
          <p className="text-[0.8125rem] text-muted-foreground">This month</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3">
            Usage
          </h3>
          <p className="text-3xl font-semibold mb-1 text-card-foreground">0%</p>
          <p className="text-[0.8125rem] text-muted-foreground">
            Of quota used
          </p>
        </div>
      </div>
    </div>
  );
}
