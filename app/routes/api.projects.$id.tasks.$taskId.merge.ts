import { eq, and } from "drizzle-orm";
import { requireAuth } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects, tasks } from "~/lib/db/schema";
import { getSecret } from "~/lib/infisical.server";
import { parsePrUrl, mergePr } from "~/lib/github.server";
import { log } from "~/lib/logger.server";
import { findProject } from "~/lib/project-lookup.server";

export async function action({
  params,
  request,
}: {
  params: { id: string; taskId: string };
  request: Request;
}) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { user, org } = await requireAuth(request);
  const { taskId } = params;

  const project = await findProject(org.id, params.id);
  if (!project) {
    log.warn({ userId: user.id, projectIdOrSlug: params.id }, "project merge: project not found or not in org");
    return Response.json({ error: "Project not found" }, { status: 404 });
  }
  const projectId = project.id;

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)));

  if (!task) {
    log.warn({ userId: user.id, projectId, taskId }, "project merge: task not found");
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  if (!task.prUrl) {
    log.warn({ userId: user.id, taskId }, "project merge: task has no PR URL");
    return Response.json({ error: "Task has no pull request" }, { status: 400 });
  }

  const parsed = parsePrUrl(task.prUrl);
  if (!parsed) {
    log.warn({ userId: user.id, taskId, prUrl: task.prUrl }, "project merge: could not parse PR URL");
    return Response.json({ error: "Could not parse PR URL" }, { status: 400 });
  }

  const githubToken = await getSecret(org.id, "GITHUB_TOKEN");
  if (!githubToken) {
    log.warn({ orgId: org.id }, "project merge: no GitHub token configured");
    return Response.json({ error: "GitHub is not connected" }, { status: 400 });
  }

  try {
    const result = await mergePr(githubToken, parsed.owner, parsed.repo, parsed.number);
    log.info(
      { userId: user.id, projectId, taskId, pr: `${parsed.owner}/${parsed.repo}#${parsed.number}` },
      "project merge: PR merged successfully",
    );

    const [updated] = await db
      .update(tasks)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(tasks.id, taskId))
      .returning();

    return Response.json({ task: updated, merge: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error({ userId: user.id, taskId, error: message }, "project merge: GitHub merge failed");
    return Response.json({ error: message }, { status: 422 });
  }
}
