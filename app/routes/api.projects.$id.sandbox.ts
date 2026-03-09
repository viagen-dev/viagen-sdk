import { randomUUID, createHash } from "crypto";
import { Sandbox } from "@vercel/sandbox";
import { requireAuth, isAdminRole } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects, workspaces, tasks } from "~/lib/db/schema";
import { eq, and, gt, desc } from "drizzle-orm";
import { resolveAllSecrets, flattenSecrets } from "~/lib/infisical.server";
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

  // Verify project belongs to org
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, org.id)));

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // Return all active workspaces (not expired)
  const activeWorkspaces = await db
    .select()
    .from(workspaces)
    .where(
      and(eq(workspaces.projectId, id), gt(workspaces.expiresAt, new Date())),
    )
    .orderBy(desc(workspaces.createdAt));

  return Response.json({ workspaces: activeWorkspaces });
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { id: string };
}) {
  if (request.method !== "POST" && request.method !== "DELETE") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { role, user, org } = await requireAuth(request);
  if (!isAdminRole(role)) {
    log.warn(
      { userId: user.id, orgId: org.id, projectId: params.id },
      "sandbox launch denied: not admin/owner",
    );
    return Response.json({ error: "Admin role required" }, { status: 403 });
  }

  const id = params.id;
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, org.id)));

  if (!project) {
    log.warn(
      { userId: user.id, projectId: id },
      "sandbox launch: project not found",
    );
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // ── Stop workspace ──────────────────────────────────
  if (request.method === "DELETE") {
    const body = await request.json();
    if (!body.workspaceId) {
      return Response.json(
        { error: "workspaceId is required" },
        { status: 400 },
      );
    }

    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(
        and(eq(workspaces.id, body.workspaceId), eq(workspaces.projectId, id)),
      );

    if (!workspace) {
      return Response.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Stop the Vercel sandbox
    try {
      const sandbox = await Sandbox.get({ sandboxId: workspace.sandboxId });
      await sandbox.stop();
    } catch (err) {
      log.warn(
        { workspaceId: workspace.id, sandboxId: workspace.sandboxId, err },
        "sandbox stop failed (may already be stopped)",
      );
    }

    // Remove the workspace row
    await db.delete(workspaces).where(eq(workspaces.id, workspace.id));
    log.info(
      {
        workspaceId: workspace.id,
        sandboxId: workspace.sandboxId,
        projectId: id,
      },
      "workspace stopped",
    );

    // If this workspace was linked to a task that's currently running,
    // revert the task status back to "validating" (PR Ready).
    if (workspace.taskId) {
      const [linkedTask] = await db
        .select({ id: tasks.id, status: tasks.status })
        .from(tasks)
        .where(eq(tasks.id, workspace.taskId));

      if (linkedTask && linkedTask.status === "running") {
        await db
          .update(tasks)
          .set({ status: "validating", workspaceId: null })
          .where(eq(tasks.id, linkedTask.id));
        log.info(
          { taskId: linkedTask.id, projectId: id },
          "task reverted to validating after workspace stopped",
        );
      }
    }

    return Response.json({ success: true });
  }

  if (!project.githubRepo) {
    log.warn({ projectId: id }, "sandbox launch: no github repo linked");
    return Response.json(
      { error: "Project must have a GitHub repo to launch a sandbox" },
      { status: 400 },
    );
  }

  // Accept branch + optional prompt + optional model from request body
  const body = await request.json().catch(() => ({}));
  const rawBranch: string = body.branch?.trim() || "main";
  // Sanitize branch name: lowercase, replace spaces/invalid chars with dashes, collapse runs
  const branch = rawBranch
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  const prompt: string | null = body.prompt?.trim() || null;
  const model: string = body.model?.trim() || "claude-sonnet-4-6";
  const taskId: string | null = body.taskId?.trim() || null;
  const reviewMode: boolean = body.reviewMode === true;

  if (rawBranch !== branch) {
    log.info({ rawBranch, branch }, "sanitized branch name");
  }

  log.info(
    {
      projectId: id,
      projectName: project.name,
      userId: user.id,
      orgId: org.id,
      repo: project.githubRepo,
      vercelProjectId: project.vercelProjectId,
      branch,
      model,
      hasPrompt: !!prompt,
    },
    "sandbox launch requested",
  );

  // ── Gather secrets (centralized resolution) ───────
  const resolved = await resolveAllSecrets(org.id, id);
  const envVars = flattenSecrets(resolved);

  // Pull out integration tokens for sandbox config
  const githubToken = envVars["GITHUB_TOKEN"] ?? null;
  const vercelToken = envVars["VERCEL_TOKEN"] ?? null;

  const claudeAuth = envVars["CLAUDE_ACCESS_TOKEN"]
    ? "oauth"
    : envVars["ANTHROPIC_API_KEY"]
      ? "api_key"
      : "none";
  log.info(
    {
      projectId: id,
      claudeAuth,
      hasGithubToken: !!githubToken,
      hasVercelToken: !!vercelToken,
      hasVercelProjectId: !!project.vercelProjectId,
      hasVercelOrgId: !!project.vercelOrgId,
      resolvedKeyCount: Object.keys(envVars).length,
    },
    "sandbox credentials resolved",
  );

  // ── Verify GitHub repo is accessible ────────────────
  const remoteUrl = `https://github.com/${project.githubRepo}.git`;

  if (githubToken) {
    try {
      const repoCheck = await fetch(
        `https://api.github.com/repos/${project.githubRepo}`,
        {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "viagen-sdk",
          },
        },
      );
      if (!repoCheck.ok) {
        const data = await repoCheck.json().catch(() => ({}));
        log.error(
          {
            projectId: id,
            repo: project.githubRepo,
            status: repoCheck.status,
            error: data.message,
          },
          "sandbox launch: GitHub repo not accessible",
        );
        if (repoCheck.status === 404) {
          return Response.json(
            {
              error: `Repository ${project.githubRepo} not found or token lacks access. Check that the repo exists and your GitHub token has the repo scope.`,
            },
            { status: 400 },
          );
        }
        if (repoCheck.status === 401) {
          return Response.json(
            { error: "GitHub token is invalid or expired" },
            { status: 401 },
          );
        }
        return Response.json(
          { error: `Cannot access repo: ${data.message ?? "unknown error"}` },
          { status: 400 },
        );
      }
      log.info(
        { projectId: id, repo: project.githubRepo },
        "sandbox launch: repo access verified",
      );
    } catch (err) {
      log.warn(
        {
          projectId: id,
          err: err instanceof Error ? err.message : String(err),
        },
        "sandbox launch: repo check failed, proceeding anyway",
      );
    }
  }

  // ── Build sandbox ───────────────────────────────────
  const token = randomUUID();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const timeoutMinutes = 45;
  const timeoutMs = timeoutMinutes * 60 * 1000;

  try {
    const start = Date.now();

    // 1. Create sandbox with git source
    const sandbox = await Sandbox.create({
      runtime: "node22",
      ports: [5173],
      timeout: timeoutMs,
      ...(githubToken
        ? {
            source: {
              type: "git" as const,
              url: remoteUrl,
              username: "x-access-token",
              password: githubToken,
            },
          }
        : {}),
    });

    // Insert workspace record immediately with "provisioning" status
    const expiresAt = new Date(Date.now() + timeoutMs);
    const [workspace] = await db
      .insert(workspaces)
      .values({
        projectId: id,
        sandboxId: sandbox.sandboxId,
        url: "", // placeholder until setup completes
        expiresAt,
        branch,
        gitRemoteUrl: remoteUrl,
        gitUserName: "viagen",
        gitUserEmail: "bot@viagen.dev",
        vercelOrgId: project.vercelOrgId ?? null,
        vercelProjectId: project.vercelProjectId ?? null,
        viagenProjectId: id,
        taskId: taskId ?? undefined,
        status: "provisioning",
        createdBy: user.id,
      })
      .returning();

    log.info(
      { projectId: id, workspaceId: workspace.id, sandboxId: sandbox.sandboxId },
      "sandbox: workspace record created (provisioning)",
    );

    try {
      // 2. Configure git inside sandbox
      if (githubToken) {
        await sandbox.runCommand("git", [
          "config",
          "--global",
          "user.name",
          "viagen",
        ]);
        await sandbox.runCommand("git", [
          "config",
          "--global",
          "user.email",
          "bot@viagen.dev",
        ]);
        await sandbox.runCommand("git", ["checkout", "-B", branch]);
        await sandbox.runCommand("bash", [
          "-c",
          `echo 'https://x-access-token:${githubToken}@github.com' > ~/.git-credentials`,
        ]);
        await sandbox.runCommand("git", [
          "config",
          "--global",
          "credential.helper",
          "store",
        ]);
      }

      // 3. Install vercel CLI (global so it's available anywhere)
      await sandbox.runCommand("npm", ["install", "-g", "vercel", "--silent"]);

      // 4. Build .env — layer sandbox-specific vars on top of resolved secrets
      const envMap: Record<string, string> = { ...envVars };
      envMap["VIAGEN_AUTH_TOKEN"] = token;
      envMap["VIAGEN_AUTH_EMAIL"] = user.email;
      envMap["VIAGEN_SESSION_START"] = String(Math.floor(Date.now() / 1000));
      envMap["VIAGEN_SESSION_TIMEOUT"] = String(timeoutMinutes * 60);
      envMap["VIAGEN_PROJECT_ID"] = id;
      envMap["VIAGEN_MODEL"] = model;

      const redirectBase =
        process.env.AUTH_REDIRECT_BASE ?? "http://localhost:5173";
      envMap["VIAGEN_CALLBACK_URL"] = `${redirectBase}/api/sandbox/callback`;
      if (taskId) {
        envMap["VIAGEN_TASK_ID"] = taskId;

        // Look up task details for type and review mode
        const [taskRow] = await db
          .select({ type: tasks.type, prompt: tasks.prompt, prUrl: tasks.prUrl })
          .from(tasks)
          .where(eq(tasks.id, taskId));
        if (taskRow?.type) {
          envMap["VIAGEN_TASK_TYPE"] = reviewMode ? "review" : taskRow.type;
        }

        // Build review-mode prompt if requested
        if (reviewMode && taskRow?.prUrl) {
          const reviewCallbackSnippet = `

After completing your review, report your verdict. If the viagen_update_task MCP tool is available, use it with prReviewStatus set to your verdict. Otherwise, fall back to a direct fetch call.

IMPORTANT: Always include token usage, cost, and your review verdict when reporting. The viagen_update_task tool accepts these fields:
- status: "review" (keeps task in review state)
- prReviewStatus: "pass", "flag", or "fail"
- result: brief summary of your review
- inputTokens: total input tokens used (number)
- outputTokens: total output tokens used (number)
- costUsd: estimated total cost in USD (number)

Fallback fetch example:

fetch(process.env.VIAGEN_CALLBACK_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + process.env.VIAGEN_AUTH_TOKEN,
  },
  body: JSON.stringify({
    taskId: process.env.VIAGEN_TASK_ID,
    status: "validating",
    prReviewStatus: "<pass|flag|fail>",
    result: "<brief summary of your review>",
    inputTokens: <number>,
    outputTokens: <number>,
    costUsd: <number>,
  }),
});`;

          envMap["VIAGEN_PROMPT"] = `You are a lightweight PR reviewer. Your job is to review a pull request — NOT write code.

## Original Task
${taskRow.prompt}

## PR to Review
${taskRow.prUrl}

## Instructions
1. Use viagen_get_task to get full task context if needed
2. Fetch the PR diff using GITHUB_TOKEN via the GitHub API (the gh CLI is not installed):
   GET https://api.github.com/repos/{owner}/{repo}/pulls/{number} with Accept: application/vnd.github.v3.diff
3. Post a summary comment on the PR expressing your understanding of the changes
4. Comment on specific lines ONLY if they are clearly incorrect or will cause failures
5. Issue your final verdict — you MUST call viagen_update_task with ALL of these fields:
   - status: "review"
   - prReviewStatus: "pass", "flag", or "fail" (THIS IS REQUIRED — the review is incomplete without it)
   - result: brief summary of your review findings
   - inputTokens: total input tokens used
   - outputTokens: total output tokens used
   - costUsd: estimated cost in USD

## Verdict guidelines
- "pass" — PR looks good, no critical issues
- "flag" — Possible concerns needing human eyes, but not blocking
- "fail" — Will absolutely break something (obvious errors ONLY)

Be LIBERAL with passes. Only flag real problems. Do NOT nitpick style, naming, or minor issues.
Do NOT write or modify any code — you are only reviewing.

## MCP tools available

- viagen_list_tasks — List tasks in this project. Use status to filter (ready, running, validating, completed, timed_out).
- viagen_get_task — Get full details of a task by ID, including its prompt, status, branch, and PR URL.
- viagen_create_task — Create a follow-up task if you discover work outside the review scope.
- viagen_update_task — Report your review verdict. You MUST include prReviewStatus ("pass", "flag", or "fail") along with result, inputTokens, outputTokens, and costUsd. A review without prReviewStatus is considered incomplete.

GITHUB_TOKEN is available in your environment for GitHub API calls via fetch.${reviewCallbackSnippet}`;
        }
      }

      if (prompt && !reviewMode) {
        const callbackSnippet = taskId
          ? `

After creating the PR, report your status back. If the viagen_update_task MCP tool is available, use it. Otherwise, fall back to a direct fetch call.

IMPORTANT: Always include token usage and cost when reporting status. The viagen_update_task tool accepts these fields:
- status: "review" (PR created) or "completed" (fully done)
- prUrl: the PR URL you created
- result: brief summary of what you did
- inputTokens: total input tokens used (number)
- outputTokens: total output tokens used (number)
- costUsd: estimated total cost in USD (number)

Fallback fetch example:

fetch(process.env.VIAGEN_CALLBACK_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + process.env.VIAGEN_AUTH_TOKEN,
  },
  body: JSON.stringify({
    taskId: process.env.VIAGEN_TASK_ID,
    status: "validating",
    prUrl: "<the PR URL you created>",
    result: "<brief one-line summary of what you did>",
    inputTokens: <number>,
    outputTokens: <number>,
    costUsd: <number>,
  }),
});`
          : "";

        envMap["VIAGEN_PROMPT"] = `${prompt}.

When you need to manage tasks on the viagen platform, you have these MCP tools available:

- viagen_list_tasks — List tasks in this project. Use status to filter (ready, running, validating, completed, timed_out). Call this first to understand what's been done and what's pending.
- viagen_get_task — Get full details of a task by ID, including its prompt, status, branch, and PR URL.
- viagen_create_task — Create a follow-up task. Provide a clear, actionable prompt. Set type to "plan" for architecture/design work or "task" (default) for code changes.
- viagen_update_task — Report your current task's status. Use "review" after pushing a PR, or "completed" when fully done. Always include: result (summary), prUrl, inputTokens, outputTokens, and costUsd.

Guidelines:
- Before starting work, check existing tasks to avoid duplicating effort.
- When you discover work outside your current scope, create a follow-up task rather than scope-creeping.
- Always update your task status when you're done — don't leave it hanging.

GITHUB_TOKEN is available in your environment for GitHub API calls via fetch (the gh CLI is not installed). When you are done, commit your changes, push, and create a pull request using the GitHub REST API.${callbackSnippet}`;
      }

      if (githubToken) {
        envMap["VIAGEN_BRANCH"] = branch;
      }

      if (project.vercelOrgId) envMap["VERCEL_ORG_ID"] = project.vercelOrgId;
      if (project.vercelProjectId)
        envMap["VERCEL_PROJECT_ID"] = project.vercelProjectId;

      const escapeEnvValue = (v: string) =>
        v.includes("\n") || v.includes('"') || v.includes("'")
          ? `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`
          : v;
      const envLines = Object.entries(envMap).map(
        ([k, v]) => `${k}=${escapeEnvValue(v)}`,
      );
      await sandbox.writeFiles([
        { path: ".env", content: Buffer.from(envLines.join("\n") + "\n") },
      ]);

      // 5. Install dependencies (include dev so viagen plugin loads)
      const install = await sandbox.runCommand("npm", [
        "install",
        "--include=dev",
      ]);
      if (install.exitCode !== 0) {
        const stderr = await install.stderr();
        throw new Error(
          `npm install failed (exit ${install.exitCode}): ${stderr}`,
        );
      }

      // 6. Start dev server with supervisor (auto-restarts on crash)
      const supervisorScript = [
        "#!/bin/bash",
        "while true; do",
        '  npm run dev -- --host 0.0.0.0',
        '  echo "[supervisor] dev server exited, restarting in 1s..."',
        "  sleep 1",
        "done",
        "",
      ].join("\n");

      await sandbox.writeFiles([
        { path: "_supervisor.sh", content: Buffer.from(supervisorScript) },
      ]);

      // Ensure supervisor script doesn't show up in git diffs
      await sandbox.runCommand("bash", [
        "-c",
        "echo '_supervisor.sh' >> .gitignore",
      ]);

      await sandbox.runCommand({
        cmd: "bash",
        args: ["_supervisor.sh"],
        env: envMap,
        detached: true,
      });

      // 7. Update workspace record to "running" with real URL
      const baseUrl = sandbox.domain(5173);
      const url = prompt
        ? `${baseUrl}/via/iframe/t/${token}`
        : `${baseUrl}/t/${token}`;
      log.info(
        {
          projectId: id,
          baseUrl,
          hasToken: !!token,
          envKeysWritten: Object.keys(envMap).length,
        },
        "sandbox URL constructed",
      );

      await db
        .update(workspaces)
        .set({ url, status: "running" })
        .where(eq(workspaces.id, workspace.id));

      // Link workspace to task and mark as running
      if (taskId) {
        await db
          .update(tasks)
          .set({
            callbackTokenHash: tokenHash,
            status: "running",
            workspaceId: workspace.id,
            startedAt: new Date(),
          })
          .where(eq(tasks.id, taskId));
        log.info(
          { taskId, workspaceId: workspace.id },
          "task linked to workspace and marked as running",
        );
      }

      const durationMs = Date.now() - start;
      log.info(
        {
          projectId: id,
          workspaceId: workspace.id,
          sandboxId: sandbox.sandboxId,
          durationMs,
        },
        "sandbox deployed successfully",
      );

      return Response.json({ workspace });
    } catch (err) {
      // Clean up provisioning workspace record on failure
      await db
        .delete(workspaces)
        .where(eq(workspaces.id, workspace.id))
        .catch(() => {});
      await sandbox.stop().catch(() => {});
      throw err;
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Sandbox deployment failed";
    // Extract nested error details from Vercel sandbox API errors
    const errJson = (err as any)?.json ?? (err as any)?.response ?? null;
    log.error(
      {
        projectId: id,
        projectName: project.name,
        repo: project.githubRepo,
        remoteUrl,
        hasGithubToken: !!githubToken,
        branch,
        err,
        errJson,
      },
      "sandbox deployment failed",
    );
    return Response.json({ error: message }, { status: 500 });
  }
}
