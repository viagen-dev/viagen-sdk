import { SidebarToggle } from "~/components/sidebar-toggle";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { environments } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { EnvironmentSettingsPanel } from "~/components/environment-settings";

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const { org, role } = await requireAuth(request);
  const [app] = await db
    .select()
    .from(environments)
    .where(
      and(
        eq(environments.id, params.id),
        eq(environments.organizationId, org.id),
      ),
    );

  if (!app) {
    throw Response.json({ error: "App not found" }, { status: 404 });
  }

  return { app, role };
}

export default function AppSettingsRoute({
  loaderData,
}: {
  loaderData: {
    app: Parameters<typeof EnvironmentSettingsPanel>[0]["app"];
    role: string;
  };
}) {
  return (
    <div className="flex flex-col h-full w-full min-w-0 overflow-hidden">
      <div className="flex items-center h-14 px-4 border-b shrink-0 gap-2">
        <SidebarToggle />
        <h1 className="text-base font-semibold">Settings</h1>
      </div>
      <div className="flex-1 overflow-y-auto min-w-0">
        <EnvironmentSettingsPanel app={loaderData.app} role={loaderData.role} />
      </div>
    </div>
  );
}
