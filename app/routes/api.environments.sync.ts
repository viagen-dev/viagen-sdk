import { requireAuth, isAdminRole } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { environments } from "~/lib/db/schema";
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
      { error: "App name is required" },
      { status: 400 },
    );
  }

  let app;

  // If id is provided, try to find and update the existing app
  if (body.id) {
    const [existing] = await db
      .update(environments)
      .set({
        name: body.name.trim(),
        ...(body.templateId !== undefined && { templateId: body.templateId }),
        ...(body.githubRepo !== undefined && { githubRepo: body.githubRepo }),
        ...(body.vercelProjectId !== undefined && { vercelProjectId: body.vercelProjectId }),
        ...(body.vercelProjectName !== undefined && { vercelProjectName: body.vercelProjectName }),
        ...(body.vercelOrgId !== undefined && { vercelOrgId: body.vercelOrgId }),
      })
      .where(and(eq(environments.id, body.id), eq(environments.organizationId, org.id)))
      .returning();

    if (existing) {
      app = existing;
    }
  }

  // If no existing app found (or no id provided), create a new one
  if (!app) {
    const [created] = await db
      .insert(environments)
      .values({
        organizationId: org.id,
        name: body.name.trim(),
        templateId: body.templateId ?? null,
        githubRepo: body.githubRepo ?? null,
        vercelProjectId: body.vercelProjectId ?? null,
        vercelProjectName: body.vercelProjectName ?? null,
        vercelOrgId: body.vercelOrgId ?? null,
      })
      .returning();

    app = created;
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
            { environmentId: app.id, key, valueType: typeof value },
            "sync: skipping secret with invalid type",
          );
          failed.push(key);
          return false;
        }
        return true;
      },
    );

    // Create the folder path once upfront
    await ensureFolder(`${org.id}/${app.id}`);

    for (const [key, value] of entries) {
      try {
        await setProjectSecret(org.id, app.id, key, value as string, { skipEnsure: true });
        stored++;
      } catch (err) {
        log.error(
          { environmentId: app.id, key, err },
          "sync: failed to store secret",
        );
        failed.push(key);
      }
    }
  }

  // Resolve all secrets across scopes so the CLI can verify what's available
  let resolvedKeys: string[] = [];
  try {
    const resolved = await resolveAllSecrets(org.id, app.id);
    const flat = flattenSecrets(resolved);
    resolvedKeys = Object.keys(flat).sort();
  } catch (err) {
    log.warn(
      { environmentId: app.id, err },
      "sync: failed to resolve secrets for response",
    );
  }

  log.info(
    {
      environmentId: app.id,
      appName: app.name,
      secretsStored: stored,
      secretsFailed: failed.length,
      resolvedCount: resolvedKeys.length,
    },
    "app synced",
  );

  return Response.json({
    app,
    secrets: { stored, failed },
    resolvedKeys,
  });
}
