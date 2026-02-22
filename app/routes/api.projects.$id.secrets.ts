import { requireAuth, isAdminRole } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  resolveAllSecrets,
  setProjectSecret,
  deleteProjectSecret,
  getSecret,
} from "~/lib/infisical.server";
import {
  upsertVercelEnvVars,
  listVercelEnvVars,
  deleteVercelEnvVar,
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
  const id = params.id;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, org.id)));

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const resolved = await resolveAllSecrets(org.id, id);

  log.info(
    {
      projectId: id,
      orgId: org.id,
      projectCount: resolved.project.length,
      orgCount: resolved.org.length,
    },
    "secrets loader: resolved all secrets",
  );

  const sort = (secrets: { key: string; value: string }[]) =>
    [...secrets].sort((a, b) => a.key.localeCompare(b.key));

  return Response.json({
    project: sort(resolved.project),
    org: sort(resolved.org),
  });
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const { role, user, org } = await requireAuth(request);
  const id = params.id;

  if (!isAdminRole(role)) {
    return Response.json({ error: "Admin role required" }, { status: 403 });
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, org.id)));

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  if (request.method === "POST") {
    const body = await request.json();
    const key = body.key?.trim();
    const value = body.value;

    if (
      !key ||
      typeof key !== "string" ||
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)
    ) {
      return Response.json(
        { error: "Invalid key. Use letters, numbers, and underscores." },
        { status: 400 },
      );
    }
    if (typeof value !== "string") {
      return Response.json({ error: "Value is required" }, { status: 400 });
    }

    await setProjectSecret(org.id, id, key, value);
    log.info({ projectId: id, key }, "project secret set");

    // Sync to Vercel if connected
    if (project.vercelProjectId) {
      try {
        const vercelToken = await getSecret(
          org.id,
          "VERCEL_TOKEN",
        );
        if (vercelToken) {
          await upsertVercelEnvVars(vercelToken, project.vercelProjectId, [
            { key, value },
          ]);
          log.info(
            { projectId: id, key, vercelProjectId: project.vercelProjectId },
            "secret synced to vercel",
          );
        }
      } catch (err) {
        log.warn(
          { projectId: id, key, err },
          "failed to sync secret to vercel",
        );
      }
    }

    return Response.json({ success: true });
  }

  if (request.method === "DELETE") {
    const body = await request.json();
    const key = body.key?.trim();

    if (!key || typeof key !== "string") {
      return Response.json({ error: "Key is required" }, { status: 400 });
    }

    await deleteProjectSecret(org.id, id, key);
    log.info({ projectId: id, key }, "project secret deleted");

    // Remove from Vercel if connected
    if (project.vercelProjectId) {
      try {
        const vercelToken = await getSecret(
          org.id,
          "VERCEL_TOKEN",
        );
        if (vercelToken) {
          const envVars = await listVercelEnvVars(
            vercelToken,
            project.vercelProjectId,
          );
          const match = envVars.find((v) => v.key === key);
          if (match) {
            await deleteVercelEnvVar(
              vercelToken,
              project.vercelProjectId,
              match.id,
            );
          }
        }
      } catch (err) {
        log.warn(
          { projectId: id, key, err },
          "failed to delete secret from vercel",
        );
      }
    }

    return Response.json({ success: true });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
