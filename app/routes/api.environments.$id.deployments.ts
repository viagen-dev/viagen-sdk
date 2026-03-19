import { requireAuth, isAdminRole } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { environments } from "~/lib/db/schema";
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
  const environmentId = params.id;

  const [app] = await db
    .select()
    .from(environments)
    .where(and(eq(environments.id, environmentId), eq(environments.organizationId, org.id)));

  if (!app) {
    log.warn({ environmentId, orgId: org.id }, "deployments: app not found");
    return Response.json({ error: "App not found" }, { status: 404 });
  }

  if (!app.vercelProjectId) {
    log.debug({ environmentId }, "deployments: no Vercel project linked");
    return Response.json({ deployments: [] });
  }

  let token: string | null = null;
  try {
    token = await getSecret(org.id, "VERCEL_TOKEN");
  } catch {
    log.warn({ environmentId, orgId: org.id }, "deployments: failed to retrieve VERCEL_TOKEN");
  }

  if (!token) {
    log.debug({ environmentId }, "deployments: no VERCEL_TOKEN available");
    return Response.json({ deployments: [] });
  }

  try {
    const data = await listVercelDeployments(token, {
      projectId: app.vercelProjectId,
      teamId: app.vercelOrgId ?? undefined,
      limit: 10,
    });

    log.debug(
      { environmentId, count: data.deployments.length },
      "deployments listed",
    );

    return Response.json({ deployments: data.deployments });
  } catch (err) {
    log.error(
      { environmentId, err: err instanceof Error ? err.message : String(err) },
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
  const environmentId = params.id;

  if (!isAdminRole(role)) {
    log.warn({ userId: user.id, environmentId }, "deployments: non-admin tried to redeploy");
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const [app] = await db
    .select()
    .from(environments)
    .where(and(eq(environments.id, environmentId), eq(environments.organizationId, org.id)));

  if (!app) {
    return Response.json({ error: "App not found" }, { status: 404 });
  }

  if (!app.vercelProjectId) {
    return Response.json({ error: "No Vercel project linked" }, { status: 400 });
  }

  let token: string | null = null;
  try {
    token = await getSecret(org.id, "VERCEL_TOKEN");
  } catch {
    log.warn({ environmentId, orgId: org.id }, "deployments: failed to retrieve VERCEL_TOKEN");
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
    const { deployments } = await listVercelDeployments(token, {
      projectId: app.vercelProjectId,
      teamId: app.vercelOrgId ?? undefined,
      limit: 1,
    });

    let deployment;
    if (deployments.length > 0) {
      deployment = await redeployVercelDeployment(
        token,
        deployments[0].uid,
        { target, teamId: app.vercelOrgId ?? undefined },
      );
    } else if (app.githubRepo) {
      const [ghOrg, repo] = app.githubRepo.split("/");
      deployment = await createVercelDeployment(token, {
        name: app.vercelProjectName ?? app.vercelProjectId,
        target,
        teamId: app.vercelOrgId ?? undefined,
        gitSource: { type: "github", org: ghOrg, repo, ref: "main" },
      });
    } else {
      return Response.json(
        { error: "No deployments to redeploy and no GitHub repo linked" },
        { status: 400 },
      );
    }

    log.info(
      { environmentId, userId: user.id, deploymentId: deployment.uid, target },
      "deployment triggered",
    );

    return Response.json({ deployment }, { status: 201 });
  } catch (err) {
    log.error(
      { environmentId, err: err instanceof Error ? err.message : String(err) },
      "deployments: redeploy failed",
    );
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to trigger deployment" },
      { status: 500 },
    );
  }
}
