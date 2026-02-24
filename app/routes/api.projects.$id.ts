import { requireAuth, isAdminRole } from "~/lib/session.server";
import { resolveAllSecrets, flattenSecrets } from "~/lib/infisical.server";
import { deleteVercelProject } from "~/lib/vercel.server";
import { db } from "~/lib/db/index.server";
import { projects } from "~/lib/db/schema";
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

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, org.id)));

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  return Response.json({ project });
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
        { error: "Admin role required to update projects" },
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

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No updates provided" }, { status: 400 });
    }

    const [project] = await db
      .update(projects)
      .set(updates)
      .where(and(eq(projects.id, id), eq(projects.organizationId, org.id)))
      .returning();

    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    log.info(
      { projectId: id, updates: Object.keys(updates) },
      "project updated",
    );
    return Response.json({ project });
  }

  if (request.method === "DELETE") {
    if (!isAdminRole(role)) {
      return Response.json(
        { error: "Admin role required to delete projects" },
        { status: 403 },
      );
    }

    // Read the project first so we know what to clean up
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, org.id)));

    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    // Parse optional cascade flags from request body
    let deleteGithubRepo = false;
    let deleteVercel = false;
    try {
      const body = await request.json();
      deleteGithubRepo = body.deleteGithubRepo === true;
      deleteVercel = body.deleteVercelProject === true;
    } catch {
      // No body or invalid JSON — just delete the project record
    }

    const warnings: string[] = [];

    // Resolve secrets from both org and project scopes (same as sandbox)
    let envVars: Record<string, string> = {};
    if (deleteGithubRepo || deleteVercel) {
      try {
        const resolved = await resolveAllSecrets(org.id, id);
        envVars = flattenSecrets(resolved);
        log.info(
          { projectId: id, hasGithubToken: !!envVars["GITHUB_TOKEN"], hasVercelToken: !!envVars["VERCEL_TOKEN"] },
          "delete project: secrets resolved",
        );
      } catch (err) {
        log.error(
          { projectId: id, err: err instanceof Error ? err.message : String(err) },
          "delete project: failed to resolve secrets",
        );
        warnings.push("Could not resolve secrets — external resources may not be deleted");
      }
    }

    // Delete GitHub repo if requested
    if (deleteGithubRepo && project.githubRepo) {
      const ghToken = envVars["GITHUB_TOKEN"] ?? null;
      if (!ghToken) {
        log.warn({ projectId: id }, "delete project: cannot delete GitHub repo — no token");
        warnings.push("GitHub repo not deleted: GITHUB_TOKEN not configured");
      } else {
        try {
          const res = await fetch(
            `https://api.github.com/repos/${project.githubRepo}`,
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
            log.info({ projectId: id, repo: project.githubRepo }, "delete project: GitHub repo deleted");
          } else {
            const data = await res.json().catch(() => ({}));
            log.error(
              { projectId: id, repo: project.githubRepo, status: res.status, error: data.message },
              "delete project: failed to delete GitHub repo",
            );
            warnings.push(`GitHub repo not deleted: ${data.message ?? "API error"}`);
          }
        } catch (err) {
          log.error(
            { projectId: id, err: err instanceof Error ? err.message : String(err) },
            "delete project: GitHub repo deletion threw",
          );
          warnings.push("GitHub repo not deleted: unexpected error");
        }
      }
    }

    // Delete Vercel project if requested
    if (deleteVercel && project.vercelProjectId) {
      const vcToken = envVars["VERCEL_TOKEN"] ?? null;
      if (!vcToken) {
        log.warn({ projectId: id }, "delete project: cannot delete Vercel project — no token");
        warnings.push("Vercel project not deleted: VERCEL_TOKEN not configured");
      } else {
        try {
          await deleteVercelProject(vcToken, project.vercelProjectId);
          log.info(
            { projectId: id, vercelProjectId: project.vercelProjectId },
            "delete project: Vercel project deleted",
          );
        } catch (err) {
          log.error(
            { projectId: id, err: err instanceof Error ? err.message : String(err) },
            "delete project: Vercel project deletion threw",
          );
          warnings.push("Vercel project not deleted: unexpected error");
        }
      }
    }

    // Delete the project record
    await db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, org.id)));

    log.info(
      { projectId: id, orgId: org.id, deleteGithubRepo, deleteVercel, warnings },
      "project deleted",
    );
    return Response.json({ success: true, warnings });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
