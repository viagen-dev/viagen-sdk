import { requireAuth, isAdminRole } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  setProjectSecret,
  ensureFolder,
  resolveAllSecrets,
  flattenSecrets,
} from "~/lib/infisical.server";
import { log } from "~/lib/logger.server";

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { role, user, org } = await requireAuth(request);
  if (!isAdminRole(role)) {
    return Response.json({ error: "Admin role required" }, { status: 403 });
  }

  const body = await request.json();

  if (
    !body.name ||
    typeof body.name !== "string" ||
    body.name.trim().length === 0
  ) {
    return Response.json(
      { error: "Project name is required" },
      { status: 400 },
    );
  }

  let project;

  // If id is provided, try to find and update the existing project
  if (body.id) {
    const [existing] = await db
      .update(projects)
      .set({
        name: body.name.trim(),
        ...(body.templateId !== undefined && { templateId: body.templateId }),
        ...(body.githubRepo !== undefined && { githubRepo: body.githubRepo }),
        ...(body.vercelProjectId !== undefined && { vercelProjectId: body.vercelProjectId }),
        ...(body.vercelOrgId !== undefined && { vercelOrgId: body.vercelOrgId }),
      })
      .where(and(eq(projects.id, body.id), eq(projects.organizationId, org.id)))
      .returning();

    if (existing) {
      project = existing;
    }
  }

  // If no existing project found (or no id provided), create a new one
  if (!project) {
    const [created] = await db
      .insert(projects)
      .values({
        organizationId: org.id,
        name: body.name.trim(),
        templateId: body.templateId ?? null,
        githubRepo: body.githubRepo ?? null,
        vercelProjectId: body.vercelProjectId ?? null,
        vercelOrgId: body.vercelOrgId ?? null,
      })
      .returning();

    project = created;
  }

  // Store secrets in Infisical (ensure folder once, then write sequentially
  // to avoid race conditions in Infisical's create-vs-update check)
  let stored = 0;
  const failed: string[] = [];
  if (body.secrets && typeof body.secrets === "object") {
    const entries = Object.entries(body.secrets).filter(
      ([key, value]) => {
        if (typeof key !== "string" || typeof value !== "string") {
          log.warn(
            { projectId: project.id, key, valueType: typeof value },
            "sync: skipping secret with invalid type",
          );
          failed.push(key);
          return false;
        }
        return true;
      },
    );

    // Create the folder path once upfront
    await ensureFolder(`${org.id}/${project.id}`);

    for (const [key, value] of entries) {
      try {
        await setProjectSecret(org.id, project.id, key, value as string, { skipEnsure: true });
        stored++;
      } catch (err) {
        log.error(
          { projectId: project.id, key, err },
          "sync: failed to store secret",
        );
        failed.push(key);
      }
    }
  }

  // Resolve all secrets across scopes so the CLI can verify what's available
  let resolvedKeys: string[] = [];
  try {
    const resolved = await resolveAllSecrets(org.id, project.id, user.id);
    const flat = flattenSecrets(resolved);
    resolvedKeys = Object.keys(flat).sort();
  } catch (err) {
    log.warn(
      { projectId: project.id, err },
      "sync: failed to resolve secrets for response",
    );
  }

  log.info(
    {
      projectId: project.id,
      projectName: project.name,
      secretsStored: stored,
      secretsFailed: failed.length,
      resolvedCount: resolvedKeys.length,
    },
    "project synced",
  );

  return Response.json({
    project,
    secrets: { stored, failed },
    resolvedKeys,
  });
}
