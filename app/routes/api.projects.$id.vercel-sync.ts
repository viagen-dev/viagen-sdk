import { requireAuth, isAdminRole } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  resolveAllSecrets,
  flattenSecrets,
  getSecret,
} from "~/lib/infisical.server";
import { upsertVercelEnvVars } from "~/lib/vercel.server";
import { log } from "~/lib/logger.server";

const VERCEL_SYNC_DENYLIST_PREFIX = "VIAGEN_";

function isDenylisted(key: string): boolean {
  return key.startsWith(VERCEL_SYNC_DENYLIST_PREFIX);
}

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
  const flat = flattenSecrets(resolved);
  const config = (project.vercelEnvSync as Record<string, boolean>) ?? {};

  log.info(
    { projectId: id, orgId: org.id, keyCount: Object.keys(flat).length },
    "vercel-sync GET: returning sync state",
  );

  const keys = Object.entries(flat).map(([key]) => {
    const denylisted = isDenylisted(key);
    return {
      key,
      syncEnabled: denylisted ? false : config[key] !== false,
      isDenylisted: denylisted,
    };
  });

  return Response.json({ keys, config });
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const { role, org } = await requireAuth(request);
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

  // ── POST: bulk sync to Vercel ──────────────────────
  if (request.method === "POST") {
    if (!project.vercelProjectId) {
      return Response.json(
        { error: "No Vercel project connected" },
        { status: 400 },
      );
    }

    const resolved = await resolveAllSecrets(org.id, id);
    const flat = flattenSecrets(resolved);
    const config = (project.vercelEnvSync as Record<string, boolean>) ?? {};

    let synced = 0;
    let skipped = 0;
    let denylisted = 0;
    const toSync: { key: string; value: string }[] = [];

    for (const [key, value] of Object.entries(flat)) {
      if (isDenylisted(key)) {
        denylisted++;
        continue;
      }
      if (config[key] === false) {
        skipped++;
        continue;
      }
      toSync.push({ key, value });
      synced++;
    }

    if (toSync.length > 0) {
      const vercelToken = await getSecret(org.id, "VERCEL_TOKEN");
      if (!vercelToken) {
        log.warn(
          { projectId: id },
          "vercel-sync POST: VERCEL_TOKEN not found in org secrets",
        );
        return Response.json(
          { error: "VERCEL_TOKEN not found in organization secrets" },
          { status: 400 },
        );
      }

      await upsertVercelEnvVars(vercelToken, project.vercelProjectId, toSync);
    }

    log.info(
      { projectId: id, synced, skipped, denylisted },
      "vercel-sync POST: bulk sync completed",
    );

    return Response.json({ synced, skipped, denylisted });
  }

  // ── PATCH: update per-key sync config ──────────────
  if (request.method === "PATCH") {
    const body = await request.json();

    let updates: Record<string, boolean> = {};

    if (body.key && typeof body.enabled === "boolean") {
      updates[body.key] = body.enabled;
    } else if (body.keys && typeof body.keys === "object") {
      updates = body.keys;
    } else {
      return Response.json(
        { error: "Provide { key, enabled } or { keys: Record<string, boolean> }" },
        { status: 400 },
      );
    }

    // Reject denylisted keys being enabled
    for (const [key, enabled] of Object.entries(updates)) {
      if (isDenylisted(key) && enabled) {
        log.warn(
          { projectId: id, key },
          "vercel-sync PATCH: attempted to enable denylisted key",
        );
        return Response.json(
          { error: `Cannot enable sync for denylisted key: ${key}` },
          { status: 400 },
        );
      }
    }

    const existing = (project.vercelEnvSync as Record<string, boolean>) ?? {};
    const merged = { ...existing, ...updates };

    await db
      .update(projects)
      .set({ vercelEnvSync: merged })
      .where(eq(projects.id, id));

    log.info(
      { projectId: id, updates },
      "vercel-sync PATCH: updated sync config",
    );

    return Response.json({ config: merged });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
