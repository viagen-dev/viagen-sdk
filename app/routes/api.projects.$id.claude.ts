import { requireAuth, isAdminRole } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  getProjectSecret,
  setProjectSecret,
  deleteProjectSecret,
  getSecret,
} from "~/lib/infisical.server";
import { log } from "~/lib/logger.server";

// Check these keys in order — sandboxes use CLAUDE_ACCESS_TOKEN, manual setup uses ANTHROPIC_API_KEY
const CLAUDE_KEYS = ["CLAUDE_ACCESS_TOKEN", "ANTHROPIC_API_KEY"];

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  const { user, org } = await requireAuth(request);
  const id = params.id;

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, org.id)));

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // Check in priority order: project > org > user
  for (const key of CLAUDE_KEYS) {
    const projectKey = await getProjectSecret(org.id, id, key).catch(
      () => null,
    );
    if (projectKey) {
      return Response.json({
        connected: true,
        source: "project",
        keyPrefix: projectKey.slice(0, 12) + "...",
      });
    }
  }

  for (const key of CLAUDE_KEYS) {
    const orgKey = await getSecret(org.id, key).catch(() => null);
    if (orgKey) {
      return Response.json({
        connected: true,
        source: "org",
        keyPrefix: orgKey.slice(0, 12) + "...",
      });
    }
  }

  for (const key of CLAUDE_KEYS) {
    const userKey = await getSecret(`user/${user.id}`, key).catch(() => null);
    if (userKey) {
      return Response.json({
        connected: true,
        source: "user",
        keyPrefix: userKey.slice(0, 12) + "...",
      });
    }
  }

  return Response.json({ connected: false });
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

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, org.id)));

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // DELETE — remove all project-level Claude credentials
  if (request.method === "DELETE") {
    if (!isAdminRole(role)) {
      return Response.json({ error: "Admin role required" }, { status: 403 });
    }
    await deleteProjectSecret(org.id, id, "ANTHROPIC_API_KEY").catch(() => {});
    await deleteProjectSecret(org.id, id, "CLAUDE_ACCESS_TOKEN").catch(
      () => {},
    );
    await deleteProjectSecret(org.id, id, "CLAUDE_TOKEN_EXPIRES").catch(
      () => {},
    );
    log.info({ projectId: id }, "claude credentials removed from project");
    return Response.json({ success: true });
  }

  // PUT — set API key at specified scope
  // Setting a raw ANTHROPIC_API_KEY always removes any OAuth credentials
  // (CLAUDE_ACCESS_TOKEN / CLAUDE_TOKEN_EXPIRES). Only CLI sync can set those.
  if (request.method === "PUT") {
    const body = await request.json();
    if (!body.apiKey) {
      return Response.json({ error: "apiKey is required" }, { status: 400 });
    }

    const scope = body.scope ?? "project";

    if (scope === "project") {
      if (!isAdminRole(role)) {
        return Response.json({ error: "Admin role required" }, { status: 403 });
      }
      // Save the API key
      await setProjectSecret(org.id, id, "ANTHROPIC_API_KEY", body.apiKey);
      // Remove any stale OAuth credentials — manual key entry supersedes OAuth
      await deleteProjectSecret(org.id, id, "CLAUDE_ACCESS_TOKEN").catch(
        () => {},
      );
      await deleteProjectSecret(org.id, id, "CLAUDE_TOKEN_EXPIRES").catch(
        () => {},
      );
      log.info({ projectId: id }, "claude api key set at project level");
    } else {
      return Response.json(
        { error: "Use /api/claude-key for org/user scope" },
        { status: 400 },
      );
    }

    return Response.json({ success: true });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
