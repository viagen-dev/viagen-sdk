import { randomUUID } from "crypto";
import { Sandbox } from "@vercel/sandbox";
import { requireAuth, isAdminRole } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { projects, workspaces } from "~/lib/db/schema";
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

    return Response.json({ success: true });
  }

  if (!project.githubRepo) {
    log.warn({ projectId: id }, "sandbox launch: no github repo linked");
    return Response.json(
      { error: "Project must have a GitHub repo to launch a sandbox" },
      { status: 400 },
    );
  }

  // Accept branch + optional prompt from request body
  const body = await request.json().catch(() => ({}));
  const rawBranch: string = body.branch?.trim() || "main";
  // Sanitize branch name: lowercase, replace spaces/invalid chars with dashes, collapse runs
  const branch = rawBranch
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  const prompt: string | null = body.prompt?.trim() || null;

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
        { projectId: id, err: err instanceof Error ? err.message : String(err) },
        "sandbox launch: repo check failed, proceeding anyway",
      );
    }
  }

  // ── Build sandbox ───────────────────────────────────
  const token = randomUUID();
  const timeoutMinutes = 30;
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

      // 3. Install vercel CLI
      await sandbox.runCommand("npm", ["install", "-g", "vercel", "--silent"]);

      // 4. Build .env — layer sandbox-specific vars on top of resolved secrets
      const envMap: Record<string, string> = { ...envVars };
      envMap["VIAGEN_AUTH_TOKEN"] = token;
      envMap["VIAGEN_AUTH_EMAIL"] = user.email;
      envMap["VIAGEN_SESSION_START"] = String(Math.floor(Date.now() / 1000));
      envMap["VIAGEN_SESSION_TIMEOUT"] = String(timeoutMinutes * 60);
      envMap["VIAGEN_PROJECT_ID"] = id;

      if (prompt) {
        envMap["VIAGEN_PROMPT"] = `${prompt}.

          When you are done, commit your changes push and create a pull request using github API via fetch call.`;
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

      // Export env vars so ALL processes can access them (not just Vite):
      // 1. /etc/environment — PAM-level, read by all login sessions
      // 2. /etc/profile.d/viagen.sh — sourced by login shells
      const etcEnvLines = Object.entries(envMap)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join("\n");
      const shellExports = Object.entries(envMap)
        .map(([k, v]) => `export ${k}=${JSON.stringify(v)}`)
        .join("\n");
      await sandbox.writeFiles([
        {
          path: "/etc/environment",
          content: Buffer.from(etcEnvLines + "\n"),
        },
        {
          path: "/etc/profile.d/viagen.sh",
          content: Buffer.from(shellExports + "\n"),
        },
      ]);

      // 5. Install dependencies (include dev so viagen plugin loads)
      const install = await sandbox.runCommand("npm", ["install", "--include=dev"]);
      if (install.exitCode !== 0) {
        const stderr = await install.stderr();
        throw new Error(
          `npm install failed (exit ${install.exitCode}): ${stderr}`,
        );
      }

      // 6. Start dev server (detached, with env vars passed directly)
      await sandbox.runCommand({
        cmd: "npm",
        args: ["run", "dev", "--", "--host", "0.0.0.0"],
        env: envMap,
        detached: true,
      });

      // 7. Build result and save workspace
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
      const expiresAt = new Date(Date.now() + timeoutMs);

      const [workspace] = await db
        .insert(workspaces)
        .values({
          projectId: id,
          sandboxId: sandbox.sandboxId,
          url,
          expiresAt,
          branch,
          gitRemoteUrl: remoteUrl,
          gitUserName: "viagen",
          gitUserEmail: "bot@viagen.dev",
          vercelOrgId: project.vercelOrgId ?? null,
          vercelProjectId: project.vercelProjectId ?? null,
          viagenProjectId: id,
          createdBy: user.id,
        })
        .returning();

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
