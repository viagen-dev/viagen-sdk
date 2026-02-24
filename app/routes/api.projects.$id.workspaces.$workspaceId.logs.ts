import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects, workspaces } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { log } from "~/lib/logger.server";

/**
 * Extract the sandbox domain and auth token from a workspace URL.
 * URLs look like:
 *   https://sb-xxx.vercel.run/t/{token}
 *   https://sb-xxx.vercel.run/via/iframe/t/{token}
 */
function parseWorkspaceUrl(url: string) {
  const match = url.match(/^(https?:\/\/[^/]+).*\/t\/([^/]+)$/);
  if (!match) return null;
  return { domain: match[1], token: match[2] };
}

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { id: string; workspaceId: string };
}) {
  const { org } = await requireAuth(request);
  const { id, workspaceId } = params;

  // Verify project belongs to org
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, org.id)));

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // Look up workspace
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(
      and(eq(workspaces.id, workspaceId), eq(workspaces.projectId, id)),
    );

  if (!workspace) {
    return Response.json({ error: "Workspace not found" }, { status: 404 });
  }

  const parsed = parseWorkspaceUrl(workspace.url);
  if (!parsed) {
    log.error(
      { workspaceId, url: workspace.url },
      "workspace logs: could not parse URL",
    );
    return Response.json(
      { error: "Could not parse workspace URL" },
      { status: 500 },
    );
  }

  // Forward ?since= query param
  const reqUrl = new URL(request.url);
  const since = reqUrl.searchParams.get("since");
  const logsUrl = `${parsed.domain}/via/logs${since ? `?since=${since}` : ""}`;

  log.info(
    { projectId: id, workspaceId, logsUrl, token: parsed.token },
    "workspace logs: fetching",
  );

  try {
    const resp = await fetch(logsUrl, {
      headers: { Authorization: `Bearer ${parsed.token}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      log.warn(
        { workspaceId, status: resp.status, body },
        "workspace logs: sandbox returned error",
      );
      return Response.json(
        { error: `Sandbox returned ${resp.status}`, detail: body },
        { status: resp.status },
      );
    }

    const data = await resp.json();
    return Response.json({ ...data, token: parsed.token });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn(
      { workspaceId, err: message },
      "workspace logs: sandbox unreachable",
    );
    return Response.json(
      { error: "Sandbox unreachable", detail: message, token: parsed.token },
      { status: 502 },
    );
  }
}
