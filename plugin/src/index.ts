import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnv, type Plugin } from "vite";
import { LogBuffer, wrapLogger } from "./logger";
import { registerHealthRoutes, type ViteError } from "./health";
import { registerChatRoutes, ChatSession } from "./chat";
import { buildClientScript, buildPreviewScript } from "./overlay";
import { buildUiHtml } from "./ui";
import { buildIframeHtml } from "./iframe";
import { createAuthMiddleware } from "./auth";
import { registerFileRoutes } from "./files";
import { createInjectionMiddleware, createPreviewInjectionMiddleware } from "./inject";
import { registerGitRoutes } from "./git";
import { registerLogRoutes } from "./logs";
import { setDebug, debug } from "./debug";
import {
  createViagenTools,
  PLAN_SYSTEM_PROMPT,
  PLAN_MODE_DISALLOWED_TOOLS,
  planModeCanUseTool,
  buildTaskToolsPrompt,
} from "./tools";
import { createViagen, type ViagenClient } from "viagen-sdk";
import { ProcessManager } from "./process-manager";
import type { McpServerConfig } from "@anthropic-ai/claude-agent-sdk";

export interface ViagenOptions {
  /** Toggle button placement. Default: 'bottom-right' */
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  /** Claude model to use. Default: 'sonnet' */
  model?: string;
  /** Chat panel width in px. Default: 375 */
  panelWidth?: number;
  /** Show "Fix This Error" button on Vite error overlay. Default: true */
  overlay?: boolean;
  /** Inject the toggle button + chat panel into pages. Default: true */
  ui?: boolean;
  /** Custom system prompt appended to Claude. Overrides the default. */
  systemPrompt?: string;
  /**
   * Files to always include in sandbox deployments (e.g. credentials, configs).
   * Paths are relative to the project root. Read from package.json `viagen.sandboxFiles`.
   * @example ["config.json"]
   */
  sandboxFiles?: string[];
  /**
   * Files and directories editable through the UI file panel.
   * Paths are relative to the project root. Directories include all files within.
   * @example ['src/components', '.env', 'vite.config.ts']
   */
  editable?: string[];
  /** Additional MCP servers to make available to Claude. Merged with built-in viagen tools. */
  mcpServers?: Record<string, McpServerConfig>;
  /** Enable verbose debug logging. Also enabled by VIAGEN_DEBUG=1 in .env. */
  debug?: boolean;
}

export { DEFAULT_SYSTEM_PROMPT } from "./chat";

export { deploySandbox, type GitInfo } from "./sandbox";

export function viagen(options?: ViagenOptions): Plugin {
  const opts = {
    position: options?.position ?? "bottom-right",
    model: options?.model ?? "sonnet",
    panelWidth: options?.panelWidth ?? 375,
    overlay: options?.overlay ?? true,
    ui: options?.ui ?? true,
  };

  let env: Record<string, string>;
  let previewEnabled = false;
  let projectRoot: string;
  let lastError: ViteError | null = null;
  let promptSent = false;
  let branchCheckedOut = false;
  const logBuffer = new LogBuffer();

  return {
    name: "viagen",
    config(_, { mode }) {
      const e = loadEnv(mode, process.cwd(), "");
      const serverConfig: Record<string, unknown> = {};

      if (e["VIAGEN_AUTH_TOKEN"] || e["VIAGEN_USER_TOKEN"] || e["VIAGEN_PROMPT"]) {
        serverConfig.host = true;
        serverConfig.allowedHosts = true as const;
      }

      // When an app command is configured, the child process is the "real" app
      // and gets the natural port. The viagen chat server (this Vite instance)
      // moves to a dedicated internal port so it doesn't collide.
      if (e["VIAGEN_APP_COMMAND"] && !process.env["__VIAGEN_CHILD"]) {
        const viagenPort = parseInt(e["VIAGEN_SERVER_PORT"] || "5199", 10);
        serverConfig.port = viagenPort;
        serverConfig.strictPort = true;
      }

      // When running as the child process, bind to VIAGEN_APP_PORT so the
      // sandbox proxy (or parent iframe) can find us on the expected port.
      if (process.env["__VIAGEN_CHILD"] && e["VIAGEN_APP_PORT"]) {
        serverConfig.port = parseInt(e["VIAGEN_APP_PORT"], 10);
        serverConfig.strictPort = true;
      }

      if (Object.keys(serverConfig).length > 0) {
        return { server: serverConfig };
      }
    },
    configResolved(config) {
      env = loadEnv(config.mode, config.envDir ?? config.root, "");
      previewEnabled = env["VIAGEN_PREVIEW"] === "true";
      projectRoot = config.root;

      // Enable debug logging from option or env var
      const debugEnabled = options?.debug ?? env["VIAGEN_DEBUG"] === "1";
      setDebug(debugEnabled);

      debug("init", "plugin initializing");
      debug("init", `projectRoot: ${projectRoot}`);
      debug("init", `mode: ${config.mode}`);
      debug("init", `server port: ${config.server.port}`);
      debug("init", `VIAGEN_APP_COMMAND: ${env["VIAGEN_APP_COMMAND"] || "(not set)"}`);
      debug("init", `VIAGEN_APP_PORT: ${env["VIAGEN_APP_PORT"] || "(not set)"}`);
      debug("init", `__VIAGEN_CHILD: ${process.env["__VIAGEN_CHILD"] || "no"}`);
      debug("init", `ANTHROPIC_API_KEY: ${env["ANTHROPIC_API_KEY"] ? "set (" + env["ANTHROPIC_API_KEY"].slice(0, 8) + "...)" : "NOT SET"}`);
      debug("init", `CLAUDE_ACCESS_TOKEN: ${env["CLAUDE_ACCESS_TOKEN"] ? "set" : "NOT SET"}`);
      debug("init", `GITHUB_TOKEN: ${env["GITHUB_TOKEN"] ? "set" : "NOT SET"}`);
      debug("init", `VIAGEN_AUTH_TOKEN: ${env["VIAGEN_AUTH_TOKEN"] ? "set" : "NOT SET"}`);
      debug("init", `VIAGEN_USER_TOKEN: ${env["VIAGEN_USER_TOKEN"] ? "set" : "NOT SET"}`);
      debug("init", `VIAGEN_MODEL: ${env["VIAGEN_MODEL"] || "(not set)"}`);
      debug("init", `VIAGEN_PROMPT: ${env["VIAGEN_PROMPT"] ? `"${env["VIAGEN_PROMPT"].slice(0, 80)}..."` : "(not set)"}`);
      debug("init", `VIAGEN_TASK_ID: ${env["VIAGEN_TASK_ID"] || "(not set)"}`);
      debug("init", `model: ${env["VIAGEN_MODEL"] || opts.model}`);
      debug("init", `ui: ${opts.ui}, overlay: ${opts.overlay}, position: ${opts.position}`);

      logBuffer.init(projectRoot);
      wrapLogger(config.logger, logBuffer);

      // Write plugin config so the CLI can read it
      const viagenDir = join(projectRoot, ".viagen");
      mkdirSync(viagenDir, { recursive: true });
      writeFileSync(
        join(viagenDir, "config.json"),
        JSON.stringify({
          sandboxFiles: options?.sandboxFiles ?? [],
          editable: options?.editable ?? [],
        }),
      );
    },
    transformIndexHtml(_html, ctx) {
      const tags: Array<{ tag: string; children: string; injectTo: "body" }> = [];

      if (opts.ui) {
        // In embed mode, only inject if overlay is enabled (for the Fix button)
        const url = new URL(ctx.originalUrl || ctx.path, "http://localhost");
        const isEmbed = url.searchParams.has("_viagen_embed");
        if (!isEmbed || opts.overlay) {
          tags.push({
            tag: "script",
            children: buildClientScript({
              position: opts.position,
              panelWidth: opts.panelWidth,
              overlay: opts.overlay,
            }),
            injectTo: "body" as const,
          });
        }
      }

      if (previewEnabled) {
        tags.push({
          tag: "script",
          children: buildPreviewScript(),
          injectTo: "body" as const,
        });
      }

      return tags;
    },
    configureServer(server) {
      debug("server", "configureServer starting");

      // Intercept HMR error payloads to capture structured build errors
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hmrSender: any = (server as any).hot ?? server.ws;
      if (hmrSender?.send) {
        const origSend = hmrSender.send.bind(hmrSender);
        hmrSender.send = (...args: unknown[]) => {
          const payload = args[0] as
            | { type: string; err?: ViteError }
            | undefined;
          if (payload?.type === "error" && payload.err) {
            lastError = payload.err;
            logBuffer.push(
              "error",
              `[vite:build] ${payload.err.message}\n${payload.err.frame || ""}`,
            );
          } else if (payload?.type === "update") {
            lastError = null;
          }
          return origSend(...args);
        };
      }

      // Checkout GIT_BRANCH if set (sandbox mode, once only)
      const gitBranch = env["GIT_BRANCH"];
      if (gitBranch && !branchCheckedOut) {
        branchCheckedOut = true;
        try {
          execSync(`git checkout ${gitBranch}`, {
            cwd: projectRoot,
            stdio: "pipe",
          });
          logBuffer.push("info", `[viagen] Checked out branch: ${gitBranch}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logBuffer.push("warn", `[viagen] Could not checkout ${gitBranch} (dirty working tree?): ${msg}`);
        }
      }

      // Auth middleware — only when VIAGEN_AUTH_TOKEN is set (sandbox mode)
      const authToken = env["VIAGEN_AUTH_TOKEN"];
      if (authToken) {
        debug("server", "auth middleware enabled (VIAGEN_AUTH_TOKEN set)");
        server.middlewares.use(createAuthMiddleware(authToken));
      } else {
        debug("server", "auth middleware DISABLED (no VIAGEN_AUTH_TOKEN)");
      }

      // Platform SDK client — used for task CRUD and usage reporting
      const platformToken = env["VIAGEN_USER_TOKEN"] || env["VIAGEN_AUTH_TOKEN"];
      const platformUrl = env["VIAGEN_PLATFORM_URL"] || "https://app.viagen.dev";
      const projectId = env["VIAGEN_PROJECT_ID"];
      let viagenClient: ViagenClient | null = null;
      const orgId = env["VIAGEN_ORG_ID"];
      if (platformToken) {
        viagenClient = createViagen({ token: platformToken, baseUrl: platformUrl, orgId });
        debug("server", `platform client created (baseUrl: ${platformUrl}, orgId: ${orgId || "none — will use default org"})`);
      }

      const hasEditor = !!(options?.editable && options.editable.length > 0);

      // Client script — served as a JS file for SSR injection
      const clientJs = buildClientScript({
        position: opts.position,
        panelWidth: opts.panelWidth,
        overlay: opts.overlay,
      });
      server.middlewares.use("/via/client.js", (_req, res) => {
        res.setHeader("Content-Type", "application/javascript");
        res.end(clientJs);
      });

      // Chat UI
      server.middlewares.use("/via/ui", (_req, res) => {
        res.setHeader("Content-Type", "text/html");
        res.end(buildUiHtml({ editable: hasEditor, git: true }));
      });

      // App with chat overlay auto-opened
      server.middlewares.use("/via/pop", (_req, res) => {
        res.writeHead(302, { Location: "/?_viagen_chat" });
        res.end();
      });

      server.middlewares.use("/via/iframe", (req, res) => {
        // When a separate app process is running, the preview is on a
        // different port/domain. Check for ?appUrl= query param first
        // (set by the platform), then fall back to same-origin embed.
        const url = new URL(req.url || "/", "http://localhost");
        const appUrl = url.searchParams.get("appUrl") || undefined;
        res.setHeader("Content-Type", "text/html");
        res.end(buildIframeHtml({ panelWidth: opts.panelWidth, appUrl }));
      });

      // Preview script + feedback task creation — only when VIAGEN_PREVIEW=true
      if (previewEnabled) {
        const previewJs = buildPreviewScript();
        server.middlewares.use("/via/preview.js", (_req, res) => {
          res.setHeader("Content-Type", "application/javascript");
          res.end(previewJs);
        });

        server.middlewares.use("/via/preview/task", (req, res) => {
          if (req.method !== "POST") {
            res.writeHead(405, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Method not allowed" }));
            return;
          }

          if (!viagenClient || !projectId) {
            res.writeHead(503, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Task creation not configured: missing platform credentials or VIAGEN_PROJECT_ID" }));
            return;
          }

          let body = "";
          req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
          req.on("end", async () => {
            try {
              const data = JSON.parse(body) as { prompt?: string; pageUrl?: string; screenshot?: string };
              const { prompt, pageUrl, screenshot } = data;

              if (!prompt || typeof prompt !== "string") {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "prompt is required" }));
                return;
              }

              const parts = [prompt.trim()];
              if (pageUrl) parts.push(`\nPage URL: ${pageUrl}`);
              if (screenshot) parts.push("\n[Screenshot attached]");
              parts.push("\n\n[Submitted via viagen preview feedback]");
              const fullPrompt = parts.join("");

              const task = await viagenClient!.tasks.create(projectId!, { prompt: fullPrompt, type: "task" });

              // Upload screenshot as attachment if provided
              if (screenshot && task.id) {
                try {
                  // Convert data URL to Blob
                  const [header, b64] = screenshot.split(",");
                  const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
                  const binary = Buffer.from(b64, "base64");
                  const blob = new Blob([binary], { type: mime });
                  const ext = mime === "image/png" ? "png" : "jpeg";
                  await viagenClient!.tasks.addAttachment(projectId!, task.id, blob, `screenshot.${ext}`);
                  debug("preview", `screenshot attached to task ${task.id}`);
                } catch (attachErr) {
                  debug("preview", `screenshot attachment failed (non-fatal): ${attachErr}`);
                }
              }

              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ task }));
            } catch (err) {
              const message = err instanceof Error ? err.message : "Internal error";
              debug("preview", `preview/task error: ${message}`);
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: message }));
            }
          });
        });
      }

      // Health + error routes
      registerHealthRoutes(server, env, {
        get: () => lastError,
      });

      // Chat session singleton — shared between routes and auto-prompt
      const resolvedModel = env["VIAGEN_MODEL"] || opts.model;
      debug("server", `creating ChatSession (model: ${resolvedModel})`);

      // Preview process manager — when VIAGEN_APP_COMMAND is set, spawn the
      // app as a separate child process that can be restarted independently.
      let processManager: ProcessManager | undefined;
      const appCommand = env["VIAGEN_APP_COMMAND"];
      const isChildProcess = process.env["__VIAGEN_CHILD"] === "1";
      if (isChildProcess) {
        debug("server", "skipping process manager (running as child process)");
      } else if (appCommand) {
        const appPort = parseInt(env["VIAGEN_APP_PORT"] || "5173", 10);
        debug("server", `preview process manager enabled: "${appCommand}" on port ${appPort}`);
        logBuffer.push("info", `[viagen] Preview process manager: ${appCommand} (port ${appPort})`);
        processManager = new ProcessManager({
          command: appCommand,
          cwd: projectRoot,
          logBuffer,
          appPort,
        });
        processManager.start();

        // Kill the child process when the parent exits (Ctrl+C)
        const cleanup = () => {
          processManager?.stop().finally(() => process.exit());
        };
        process.on("SIGINT", cleanup);
        process.on("SIGTERM", cleanup);
      }

      // MCP tools — created when platform client and environment ID are available
      let mcpServers: Record<string, McpServerConfig> | undefined;
      const hasPlatformContext = !!(viagenClient && projectId);
      if (hasPlatformContext) {
        debug("server", "creating viagen MCP tools (platform connected)");
        const viagenMcp = createViagenTools({
          client: viagenClient!,
          projectId: projectId!,
          processManager,
        });
        mcpServers = { [viagenMcp.name]: viagenMcp };
      }

      // Merge user-provided MCP servers
      if (options?.mcpServers) {
        mcpServers = { ...mcpServers, ...options.mcpServers };
        debug("server", `merged ${Object.keys(options.mcpServers).length} user MCP server(s)`);
      }

      // Plan mode restrictions
      const isPlanMode = env["VIAGEN_TASK_TYPE"] === "plan";
      let systemPrompt = options?.systemPrompt;

      if (isPlanMode) {
        debug("server", "plan mode active — restricting tools");
        systemPrompt = PLAN_SYSTEM_PROMPT;
      } else if (hasPlatformContext) {
        systemPrompt = (systemPrompt || "") + buildTaskToolsPrompt({
          projectId: projectId!,
          taskId: env["VIAGEN_TASK_ID"] || undefined,
          branch: env["VIAGEN_BRANCH"] || undefined,
          hasProcessManager: !!processManager,
        });
      }

      const chatSession = new ChatSession({
        env,
        projectRoot,
        logBuffer,
        model: resolvedModel,
        systemPrompt,
        mcpServers,
        ...(isPlanMode
          ? {
              disallowedTools: PLAN_MODE_DISALLOWED_TOOLS,
              canUseTool: planModeCanUseTool,
            }
          : {}),
      });

      // Chat routes
      debug("server", "registering chat routes");
      registerChatRoutes(server, chatSession, {
        env,
        viagenClient: viagenClient ?? undefined,
        projectId,
      });

      // File editor routes
      if (hasEditor) {
        registerFileRoutes(server, {
          editable: options!.editable!,
          projectRoot,
        });
      }

      // Git routes (status + diff)
      registerGitRoutes(server, { projectRoot, env });

      // Log routes (dev server logs)
      registerLogRoutes(server, { logBuffer });

      // Auto-send initial prompt if VIAGEN_PROMPT is set (headless mode, once only)
      const initialPrompt = env["VIAGEN_PROMPT"];
      if (initialPrompt && !promptSent) {
        promptSent = true;
        debug("server", `auto-sending VIAGEN_PROMPT: "${initialPrompt.slice(0, 100)}"`);
        logBuffer.push("info", `[viagen] Auto-sending prompt: "${initialPrompt}"`);
        chatSession.sendMessage(initialPrompt, (event) => {
          if (event.type === "done") {
            debug("server", "auto-prompt completed");
            logBuffer.push("info", `[viagen] Prompt completed`);
            // Report usage to platform
            const currentTaskId = env["VIAGEN_TASK_ID"];
            if (viagenClient && projectId && currentTaskId && (event.inputTokens || event.outputTokens)) {
              viagenClient.tasks.update(projectId, currentTaskId, {
                ...(event.inputTokens != null && { inputTokens: event.inputTokens }),
                ...(event.outputTokens != null && { outputTokens: event.outputTokens }),
              }).catch((err) => {
                debug("server", `usage report failed: ${err}`);
              });
            }
          }
        });
      }

      // Post-middleware: inject scripts into SSR-rendered HTML
      // Runs after Vite's internal transformIndexHtml middleware
      if (opts.ui || previewEnabled) {
        return () => {
          if (opts.ui) {
            server.middlewares.use(createInjectionMiddleware());
          }
          if (previewEnabled) {
            server.middlewares.use(createPreviewInjectionMiddleware());
          }
        };
      }
    },
  };
}

export default viagen;
