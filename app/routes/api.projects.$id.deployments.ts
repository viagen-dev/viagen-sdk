import { requireAuth, isAdminRole } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSecret } from "~/lib/infisical.server";
import {
  listVercelDeployments,
  redeployVercelDeployment,
  createVercelDeployment,
} from "~/lib/vercel.server";
import { log } from "~/lib/logger.server";

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const { org } = await requireAuth(request);
  const projectId = params.id;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, org.id)));

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  if (!project.vercelProjectId) {
    return Response.json({ deployments: [] });
  }

  let token: string | null = null;
  try {
    token = await getSecret(org.id, "VERCEL_TOKEN");
  } catch {
    log.warn({ projectId, orgId: org.id }, "deployments: failed to retrieve VERCEL_TOKEN");
  }

  if (!token) {
    return Response.json({ deployments: [] });
  }

  try {
    const data = await listVercelDeployments(token, {
      projectId: project.vercelProjectId,
      teamId: project.vercelOrgId ?? undefined,
      limit: 10,
    });

    log.debug(
      { projectId, count: data.deployments.length },
      "deployments listed",
    );

    return Response.json({ deployments: data.deployments });
  } catch (err) {
    log.error(
      { projectId, err: err instanceof Error ? err.message : String(err) },
      "deployments: Vercel API error",
    );
    return Response.json({ deployments: [], error: "Failed to fetch deployments" });
  }
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { user, org, role } = await requireAuth(request);
  const projectId = params.id;

  if (!isAdminRole(role)) {
    log.warn({ userId: user.id, projectId }, "deployments: non-admin tried to redeploy");
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, org.id)));

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  if (!project.vercelProjectId) {
    return Response.json({ error: "No Vercel project linked" }, { status: 400 });
  }

  let token: string | null = null;
  try {
    token = await getSecret(org.id, "VERCEL_TOKEN");
  } catch {
    log.warn({ projectId, orgId: org.id }, "deployments: failed to retrieve VERCEL_TOKEN");
  }

  if (!token) {
    return Response.json({ error: "VERCEL_TOKEN not configured" }, { status: 400 });
  }

  let body: { target?: string } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine
  }

  const target = body.target === "production" || body.target === "preview"
    ? body.target
    : undefined;

  try {
    // Try to redeploy the most recent deployment, or create a fresh one
    const { deployments } = await listVercelDeployments(token, {
      projectId: project.vercelProjectId,
      teamId: project.vercelOrgId ?? undefined,
      limit: 1,
    });

    let deployment;
    if (deployments.length > 0) {
      deployment = await redeployVercelDeployment(
        token,
        deployments[0].uid,
        { target, teamId: project.vercelOrgId ?? undefined },
      );
    } else {
      deployment = await createVercelDeployment(token, {
        name: project.vercelProjectName ?? project.vercelProjectId,
        target,
        teamId: project.vercelOrgId ?? undefined,
      });
    }

    log.info(
      { projectId, userId: user.id, deploymentId: deployment.uid, target },
      "deployment triggered",
    );

    return Response.json({ deployment }, { status: 201 });
  } catch (err) {
    log.error(
      { projectId, err: err instanceof Error ? err.message : String(err) },
      "deployments: redeploy failed",
    );
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to trigger deployment" },
      { status: 500 },
    );
  }
}
