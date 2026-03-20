import { requireAuth, isAdminRole } from "~/lib/session.server";
import { resolveAllSecrets, flattenSecrets } from "~/lib/infisical.server";
import { deleteVercelProject } from "~/lib/vercel.server";
import { db } from "~/lib/db/index.server";
import { environments } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
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

  const [app] = await db
    .select()
    .from(environments)
    .where(and(eq(environments.id, id), eq(environments.organizationId, org.id)));

  if (!app) {
    return Response.json({ error: "App not found" }, { status: 404 });
  }

  return Response.json({ environment: app });
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

  if (request.method === "PATCH") {
    if (!isAdminRole(role)) {
      return Response.json(
        { error: "Admin role required to update environments" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if ("name" in body) updates.name = body.name;
    if ("vercelProjectId" in body)
      updates.vercelProjectId = body.vercelProjectId ?? null;
    if ("vercelProjectName" in body)
      updates.vercelProjectName = body.vercelProjectName ?? null;
    if ("vercelOrgId" in body)
      updates.vercelOrgId = body.vercelOrgId ?? null;
    if ("githubRepo" in body) updates.githubRepo = body.githubRepo ?? null;
    if ("taskPrefix" in body) updates.taskPrefix = body.taskPrefix ?? null;
    if ("kind" in body) updates.kind = body.kind;
    if ("domain" in body) updates.domain = body.domain ?? null;

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No updates provided" }, { status: 400 });
    }

    const [app] = await db
      .update(environments)
      .set(updates)
      .where(and(eq(environments.id, id), eq(environments.organizationId, org.id)))
      .returning();

    if (!app) {
      return Response.json({ error: "App not found" }, { status: 404 });
    }

    log.info(
      { environmentId: id, updates: Object.keys(updates) },
      "app updated",
    );
    return Response.json({ environment: app });
  }

  if (request.method === "DELETE") {
    if (!isAdminRole(role)) {
      return Response.json(
        { error: "Admin role required to delete environments" },
        { status: 403 },
      );
    }

    // Read the app first so we know what to clean up
    const [app] = await db
      .select()
      .from(environments)
      .where(and(eq(environments.id, id), eq(environments.organizationId, org.id)));

    if (!app) {
      return Response.json({ error: "App not found" }, { status: 404 });
    }

    // Parse optional cascade flags from request body
    let deleteGithubRepo = false;
    let deleteVercel = false;
    try {
      const body = await request.json();
      deleteGithubRepo = body.deleteGithubRepo === true;
      deleteVercel = body.deleteVercelProject === true;
    } catch {
      // No body or invalid JSON — just delete the app record
    }

    const warnings: string[] = [];

    // Resolve secrets from both org and app scopes (same as sandbox)
    let envVars: Record<string, string> = {};
    if (deleteGithubRepo || deleteVercel) {
      try {
        const resolved = await resolveAllSecrets(org.id, id);
        envVars = flattenSecrets(resolved);
        log.info(
          { environmentId: id, hasGithubToken: !!envVars["GITHUB_TOKEN"], hasVercelToken: !!envVars["VERCEL_TOKEN"] },
          "delete app: secrets resolved",
        );
      } catch (err) {
        log.error(
          { environmentId: id, err: err instanceof Error ? err.message : String(err) },
          "delete app: failed to resolve secrets",
        );
        warnings.push("Could not resolve secrets — external resources may not be deleted");
      }
    }

    // Delete GitHub repo if requested
    if (deleteGithubRepo && app.githubRepo) {
      const ghToken = envVars["GITHUB_TOKEN"] ?? null;
      if (!ghToken) {
        log.warn({ environmentId: id }, "delete app: cannot delete GitHub repo — no token");
        warnings.push("GitHub repo not deleted: GITHUB_TOKEN not configured");
      } else {
        try {
          const res = await fetch(
            `https://api.github.com/repos/${app.githubRepo}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${ghToken}`,
                Accept: "application/vnd.github+json",
                "User-Agent": "viagen-sdk",
              },
            },
          );
          if (res.ok || res.status === 404) {
            log.info({ environmentId: id, repo: app.githubRepo }, "delete app: GitHub repo deleted");
          } else {
            const data = await res.json().catch(() => ({}));
            log.error(
              { environmentId: id, repo: app.githubRepo, status: res.status, error: data.message },
              "delete app: failed to delete GitHub repo",
            );
            warnings.push(`GitHub repo not deleted: ${data.message ?? "API error"}`);
          }
        } catch (err) {
          log.error(
            { environmentId: id, err: err instanceof Error ? err.message : String(err) },
            "delete app: GitHub repo deletion threw",
          );
          warnings.push("GitHub repo not deleted: unexpected error");
        }
      }
    }

    // Delete Vercel project if requested
    if (deleteVercel && app.vercelProjectId) {
      const vcToken = envVars["VERCEL_TOKEN"] ?? null;
      if (!vcToken) {
        log.warn({ environmentId: id }, "delete app: cannot delete Vercel project — no token");
        warnings.push("Vercel project not deleted: VERCEL_TOKEN not configured");
      } else {
        try {
          await deleteVercelProject(vcToken, app.vercelProjectId);
          log.info(
            { environmentId: id, vercelProjectId: app.vercelProjectId },
            "delete app: Vercel project deleted",
          );
        } catch (err) {
          log.error(
            { environmentId: id, err: err instanceof Error ? err.message : String(err) },
            "delete app: Vercel project deletion threw",
          );
          warnings.push("Vercel project not deleted: unexpected error");
        }
      }
    }

    // Delete the app record
    await db
      .delete(environments)
      .where(and(eq(environments.id, id), eq(environments.organizationId, org.id)));

    log.info(
      { environmentId: id, orgId: org.id, deleteGithubRepo, deleteVercel, warnings },
      "app deleted",
    );
    return Response.json({ success: true, warnings });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
