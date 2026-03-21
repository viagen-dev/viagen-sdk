import type { ViteDevServer } from "vite";
import { debug } from "./debug";

declare const __VIAGEN_VERSION__: string | undefined;

export interface ViteError {
  message: string;
  stack: string;
  frame?: string;
  plugin?: string;
  loc?: { file: string; line: number; column: number };
}

export function registerHealthRoutes(
  server: ViteDevServer,
  env: Record<string, string>,
  errorRef: { get(): ViteError | null },
) {
  server.middlewares.use("/via/error", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: errorRef.get() }));
  });

  server.middlewares.use("/via/health", (_req, res) => {
    debug("health", "health check requested");
    const configured =
      !!env["ANTHROPIC_API_KEY"] || !!env["CLAUDE_ACCESS_TOKEN"];
    const git = !!env["GITHUB_TOKEN"];
    const vercel =
      !!env["VERCEL_TOKEN"] &&
      !!env["VERCEL_ORG_ID"] &&
      !!env["VERCEL_PROJECT_ID"];
    const branch = env["VIAGEN_BRANCH"] || null;

    // Build checklist of missing env vars
    const missing: string[] = [];
    if (!env["ANTHROPIC_API_KEY"] && !env["CLAUDE_ACCESS_TOKEN"])
      missing.push("ANTHROPIC_API_KEY");
    if (!env["GITHUB_TOKEN"]) missing.push("GITHUB_TOKEN");

    // Session timing (sandbox only)
    const sessionStart = env["VIAGEN_SESSION_START"]
      ? parseInt(env["VIAGEN_SESSION_START"], 10)
      : null;
    const sessionTimeout = env["VIAGEN_SESSION_TIMEOUT"]
      ? parseInt(env["VIAGEN_SESSION_TIMEOUT"], 10)
      : null;
    const session =
      sessionStart && sessionTimeout
        ? {
            startedAt: sessionStart,
            expiresAt: sessionStart + sessionTimeout,
            timeoutSeconds: sessionTimeout,
          }
        : null;

    const prompt = env["VIAGEN_PROMPT"] || null;
    const taskId = env["VIAGEN_TASK_ID"] || null;
    const environmentId = env["VIAGEN_ENVIRONMENT_ID"] || null;
    const projectId = env["VIAGEN_PROJECT_ID"] || null;

    res.setHeader("Content-Type", "application/json");

    if (configured) {
      res.end(JSON.stringify({ status: "ok", configured: true, git, vercel, branch, session, prompt, taskId, environmentId, projectId, missing }));
    } else {
      res.end(
        JSON.stringify({ status: "error", configured: false, git, vercel, branch, session, prompt, taskId, environmentId, projectId, missing }),
      );
    }
  });

  // GET /via/version — current version + check for updates
  const currentVersion =
    typeof __VIAGEN_VERSION__ !== "undefined" ? __VIAGEN_VERSION__ : "0.0.0";
  debug("health", `version resolved: ${currentVersion}`);
  let versionCache: { latest: string; ts: number } | null = null;

  server.middlewares.use("/via/version", (_req, res) => {
    res.setHeader("Content-Type", "application/json");

    const current = currentVersion;

    // Return cached if fresh (5 min)
    if (versionCache && Date.now() - versionCache.ts < 300_000) {
      res.end(
        JSON.stringify({
          current,
          latest: versionCache.latest,
          updateAvailable: versionCache.latest !== current,
        }),
      );
      return;
    }

    fetch("https://registry.npmjs.org/viagen/latest", {
      headers: { Accept: "application/json" },
    })
      .then((r) => r.json())
      .then((data: unknown) => {
        const latest =
          (data as { version?: string }).version ?? current;
        versionCache = { latest, ts: Date.now() };
        res.end(
          JSON.stringify({
            current,
            latest,
            updateAvailable: latest !== current,
          }),
        );
      })
      .catch(() => {
        res.end(
          JSON.stringify({
            current,
            latest: null,
            updateAvailable: false,
          }),
        );
      });
  });
}
