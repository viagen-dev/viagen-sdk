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
      and(eq(environments.id, params.id), eq(environments.organizationId, org.id)),
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
    <EnvironmentSettingsPanel app={loaderData.app} role={loaderData.role} />
  );
}
