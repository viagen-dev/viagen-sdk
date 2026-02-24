import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { ProjectSettingsPanel } from "~/components/project-settings";

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const { org, role } = await requireAuth(request);
  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.id, params.id), eq(projects.organizationId, org.id)),
    );

  if (!project) {
    throw Response.json({ error: "Project not found" }, { status: 404 });
  }

  return { project, role };
}

export default function ProjectSettingsRoute({
  loaderData,
}: {
  loaderData: {
    project: Parameters<typeof ProjectSettingsPanel>[0]["project"];
    role: string;
  };
}) {
  return (
    <ProjectSettingsPanel project={loaderData.project} role={loaderData.role} />
  );
}
