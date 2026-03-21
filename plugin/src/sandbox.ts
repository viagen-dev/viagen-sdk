import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { Sandbox } from "@vercel/sandbox";

export interface GitInfo {
  /** HTTPS remote URL (transformed from SSH if needed). */
  remoteUrl: string;
  /** Branch to check out. */
  branch: string;
  /** Revision to clone (branch/tag/sha). If omitted, clones the default branch. */
  revision?: string;
  /** Git user name for commits. */
  userName: string;
  /** Git user email for commits. */
  userEmail: string;
  /** GitHub PAT (or other host token) for auth. */
  token: string;
}

interface DeploySandboxOptions {
  /** Project directory to upload (used in file-upload mode). */
  cwd: string;
  /** Anthropic API key (mutually exclusive with oauth). */
  apiKey?: string;
  /** OAuth tokens from Max/Pro flow (mutually exclusive with apiKey). */
  oauth?: {
    accessToken: string;
    refreshToken: string;
    tokenExpires: string;
  };
  /** If provided, clone the repo instead of uploading files. */
  git?: GitInfo;
  /** Dirty files to overlay on top of a git clone. */
  overlayFiles?: { path: string; content: Buffer }[];
  /** Vercel credentials for preview deploys from the sandbox. */
  vercel?: {
    token: string;
    teamId: string;
    projectId: string;
  };
  /** Fling platform credentials. */
  fling?: {
    token: string;
  };
  /** Sandbox timeout in minutes (default: 30, max depends on Vercel plan). */
  timeoutMinutes?: number;
  /** User's .env variables to forward into the sandbox. */
  envVars?: Record<string, string>;
  /** Initial prompt to auto-send in the chat UI on load. */
  prompt?: string;
}

interface DeploySandboxResult {
  /** Full URL with auth token in query string. */
  url: string;
  /** Auth token for API access. */
  token: string;
  /** Sandbox ID for later management. */
  sandboxId: string;
  /** Deployment mode used. */
  mode: "git" | "upload";
  /** Stream dev server logs. Yields { data, stream } entries. Call close() to stop. */
  streamLogs(opts?: { signal?: AbortSignal }): AsyncIterable<{ data: string; stream: string }>;
  /** Stop the sandbox. */
  stop(): Promise<void>;
}

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".viagen",
  ".next",
  ".nuxt",
]);

const SKIP_FILES = new Set([".env", ".env.local"]);

export function collectFiles(
  dir: string,
  base: string,
): { path: string; content: Buffer }[] {
  const files: { path: string; content: Buffer }[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && SKIP_DIRS.has(entry.name)) continue;
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = join(dir, entry.name);
    const relPath = relative(base, fullPath);

    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, base));
    } else if (entry.isFile()) {
      if (SKIP_FILES.has(entry.name)) continue;
      files.push({ path: relPath, content: readFileSync(fullPath) });
    }
  }

  return files;
}

function extractHost(httpsUrl: string): string {
  try {
    return new URL(httpsUrl).host;
  } catch {
    return "github.com";
  }
}

function startDots(label: string): { stop: () => void } {
  process.stdout.write(label);
  const timer = setInterval(() => process.stdout.write("."), 1000);
  return {
    stop() {
      clearInterval(timer);
      process.stdout.write("\n");
    },
  };
}

/**
 * Wait for the dev server to respond or capture early failure output.
 * Polls the base URL for up to 60 seconds while capturing logs.
 */
async function waitForServer(
  baseUrl: string,
  token: string,
  devServer: { exitCode: number | null; logs(opts?: { signal?: AbortSignal }): AsyncIterable<{ data: string; stream: string }> },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const timeout = 60_000;
  const start = Date.now();
  const ac = new AbortController();
  let serverOutput = "";

  // Capture dev server logs silently for error reporting
  const logStream = (async () => {
    try {
      for await (const log of devServer.logs({ signal: ac.signal })) {
        serverOutput += log.data;
      }
    } catch {
      // Stream closed or aborted — expected
    }
  })();

  // Poll until server responds
  while (Date.now() - start < timeout) {
    // Check if the process exited (crashed)
    if (devServer.exitCode !== null) {
      ac.abort();
      await logStream.catch(() => {});
      return {
        ok: false,
        error: serverOutput.slice(-2000) || `Process exited with code ${devServer.exitCode}`,
      };
    }

    try {
      const res = await fetch(`${baseUrl}/via/health`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        ac.abort();
        await logStream.catch(() => {});
        return { ok: true };
      }
    } catch {
      // Not ready yet
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  ac.abort();
  await logStream.catch(() => {});
  return {
    ok: false,
    error: serverOutput.slice(-2000) || "Timed out waiting for dev server",
  };
}

export async function deploySandbox(
  opts: DeploySandboxOptions,
): Promise<DeploySandboxResult> {
  const token = randomUUID();
  const useGit = !!opts.git;

  const timeoutMs = (opts.timeoutMinutes ?? 30) * 60 * 1000;

  // Create sandbox — with git source or bare
  const sourceOpts = opts.git
    ? {
        source: {
          type: "git" as const,
          url: opts.git.remoteUrl,
          username: "x-access-token",
          password: opts.git.token,
          ...(opts.git.revision ? { revision: opts.git.revision } : {}),
        },
      }
    : {};

  let sandbox: Awaited<ReturnType<typeof Sandbox.create>>;
  try {
    sandbox = await Sandbox.create({
      runtime: "node22",
      ports: [5173],
      timeout: timeoutMs,
      ...sourceOpts,
    });
  } catch (err: unknown) {
    console.error("\nSandbox creation failed.");
    if (opts.git) {
      console.error(`  URL:      ${opts.git.remoteUrl}`);
      console.error(`  Revision: ${opts.git.revision ?? "(default branch)"}`);
      console.error(`  Branch:   ${opts.git.branch}`);
    }
    // Surface the Vercel API error body (APIError exposes .json and .text)
    const apiErr = err as { message?: string; json?: unknown; text?: string };
    if (apiErr.message) console.error(`  Message:  ${apiErr.message}`);
    if (apiErr.json) {
      console.error(`  Response: ${JSON.stringify(apiErr.json, null, 2)}`);
    } else if (apiErr.text) {
      console.error(`  Response: ${apiErr.text}`);
    }
    throw err;
  }

  try {
    if (useGit && opts.git) {
      // Configure git identity for commits (global so it works from any dir)
      await sandbox.runCommand("git", [
        "config",
        "--global",
        "user.name",
        opts.git.userName,
      ]);
      await sandbox.runCommand("git", [
        "config",
        "--global",
        "user.email",
        opts.git.userEmail,
      ]);

      // Ensure we're on the branch (not detached HEAD).
      // Vercel clones at a specific commit hash, so the local branch doesn't
      // exist yet — use -B to create it at the current HEAD.
      const checkout = await sandbox.runCommand("git", ["checkout", "-B", opts.git.branch]);
      if (checkout.exitCode !== 0) {
        const err = await checkout.stderr();
        throw new Error(`git checkout failed (exit ${checkout.exitCode}): ${err}`);
      }

      // Configure credential helper so Claude can push
      // Use global config + home dir so it works regardless of cwd
      await sandbox.runCommand("bash", [
        "-c",
        `echo 'https://x-access-token:${opts.git.token}@${extractHost(opts.git.remoteUrl)}' > ~/.git-credentials`,
      ]);
      await sandbox.runCommand("git", [
        "config",
        "--global",
        "credential.helper",
        "store",
      ]);

      // Install gh CLI for pull requests and issue management
      await sandbox.runCommand("bash", [
        "-c",
        "apt-get update -qq && apt-get install -y -qq gh > /dev/null 2>&1 || true",
      ]);

      // Install vercel CLI for preview deploys
      if (opts.vercel) {
        await sandbox.runCommand("npm", [
          "install",
          "-g",
          "vercel",
          "--silent",
        ]);
      }

      // Overlay dirty files if provided
      if (opts.overlayFiles && opts.overlayFiles.length > 0) {
        await sandbox.writeFiles(opts.overlayFiles);
      }
    } else {
      // File upload mode
      const files = collectFiles(opts.cwd, opts.cwd);
      if (files.length > 0) {
        await sandbox.writeFiles(files);
      }
    }

    // Install Fling credentials
    if (opts.fling) {
      await sandbox.runCommand("bash", [
        "-c",
        `mkdir -p ~/.fling && echo '${opts.fling.token}' > ~/.fling/token && chmod 600 ~/.fling/token`,
      ]);
    }

    // Write .env — start with user's app vars, then overlay viagen secrets
    const envMap: Record<string, string> = { ...(opts.envVars ?? {}) };
    envMap["VIAGEN_AUTH_TOKEN"] = token;
    envMap["VIAGEN_SESSION_START"] = String(Math.floor(Date.now() / 1000));
    envMap["VIAGEN_SESSION_TIMEOUT"] = String((opts.timeoutMinutes ?? 30) * 60);
    if (opts.apiKey) {
      envMap["ANTHROPIC_API_KEY"] = opts.apiKey;
    } else if (opts.oauth) {
      envMap["CLAUDE_ACCESS_TOKEN"] = opts.oauth.accessToken;
      envMap["CLAUDE_REFRESH_TOKEN"] = opts.oauth.refreshToken;
      envMap["CLAUDE_TOKEN_EXPIRES"] = opts.oauth.tokenExpires;
    }
    if (opts.git) {
      envMap["GITHUB_TOKEN"] = opts.git.token;
      envMap["VIAGEN_BRANCH"] = opts.git.branch;
    }
    if (opts.vercel) {
      envMap["VERCEL_TOKEN"] = opts.vercel.token;
      envMap["VERCEL_ORG_ID"] = opts.vercel.teamId;
      envMap["VERCEL_PROJECT_ID"] = opts.vercel.projectId;
    }
    if (opts.prompt) {
      envMap["VIAGEN_PROMPT"] = opts.prompt;
    }
    const envLines = Object.entries(envMap).map(([k, v]) => `${k}=${v}`);
    await sandbox.writeFiles([
      {
        path: ".env",
        content: Buffer.from(envLines.join("\n")),
      },
    ]);

    // Install dependencies — capture output for error reporting
    const dots = startDots("  Installing dependencies");
    const install = await sandbox.runCommand("npm", ["install"]);
    dots.stop();
    if (install.exitCode !== 0) {
      const stderr = await install.stderr();
      console.error(stderr);
      throw new Error(`npm install failed (exit ${install.exitCode})`);
    }

    // Start dev server (detached so it runs in background)
    // The viagen plugin sets server.host=true when VIAGEN_AUTH_TOKEN is present,
    // so we don't pass --host here (which would break non-Vite dev servers).
    const devServer = await sandbox.runCommand({
      cmd: "npm",
      args: ["run", "dev"],
      detached: true,
    });

    const baseUrl = sandbox.domain(5173);
    const url = `${baseUrl}/t/${token}`;

    // Wait for the dev server to be ready or fail
    const dots2 = startDots("  Starting dev server");
    const ready = await waitForServer(baseUrl, token, devServer);
    dots2.stop();
    if (!ready.ok) {
      throw new Error(
        `Dev server failed to start: ${ready.error}`,
      );
    }

    return {
      url,
      token,
      sandboxId: sandbox.sandboxId,
      mode: useGit ? "git" : "upload",
      streamLogs: (opts) => devServer.logs(opts),
      stop: () => sandbox.stop(),
    };
  } catch (err) {
    // Clean up on failure
    await sandbox.stop().catch(() => {});
    throw err;
  }
}

export async function stopSandbox(sandboxId: string): Promise<void> {
  const sandbox = await Sandbox.get({ sandboxId });
  await sandbox.stop();
}
