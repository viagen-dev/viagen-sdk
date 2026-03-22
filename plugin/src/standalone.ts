/**
 * Standalone viagen server — runs as its own process, separate from the user's app.
 *
 * Creates a bare Vite dev server (no user framework) that only serves the
 * viagen chat UI and /via/* API routes. The user's app runs as a child
 * process via the process manager on a separate port.
 *
 * Used by: `viagen serve`, sandbox deployments
 */
import { createServer } from "vite";
import { viagen } from "./index";
import { debug } from "./debug";

export interface StandaloneOptions {
  /** Port for the viagen server. Default: VIAGEN_SERVER_PORT or 5199 */
  port?: number;
  /** Command to start the user's app. Default: VIAGEN_APP_COMMAND from .env */
  appCommand?: string;
  /** Port the app listens on. Default: VIAGEN_APP_PORT or 5173 */
  appPort?: number;
  /** Working directory. Default: process.cwd() */
  cwd?: string;
}

export async function startStandaloneServer(opts: StandaloneOptions = {}) {
  const cwd = opts.cwd || process.cwd();
  const port = opts.port || parseInt(process.env["VIAGEN_SERVER_PORT"] || "5199", 10);
  const appPort = opts.appPort || parseInt(process.env["VIAGEN_APP_PORT"] || "5173", 10);
  const appCommand = opts.appCommand || process.env["VIAGEN_APP_COMMAND"];

  // Set env vars so the viagen plugin picks them up via loadEnv
  if (appCommand) process.env["VIAGEN_APP_COMMAND"] = appCommand;
  if (opts.appPort) process.env["VIAGEN_APP_PORT"] = String(appPort);

  debug("standalone", `starting standalone server on port ${port}`);
  debug("standalone", `app command: ${appCommand || "(none)"}`);
  debug("standalone", `app port: ${appPort}`);
  debug("standalone", `cwd: ${cwd}`);

  const server = await createServer({
    // Don't load the user's vite.config — we're a standalone server
    configFile: false,
    root: cwd,
    plugins: [
      viagen({
        standalone: true,
        ui: false,       // no overlay injection
        overlay: false,  // no Fix This Error button
      }),
    ],
    server: {
      port,
      strictPort: true,
      host: true,
    },
    // Minimal config — no framework transforms, no CSS processing
    optimizeDeps: { noDiscovery: true },
    logLevel: "info",
  });

  await server.listen();

  const resolvedPort = server.config.server.port || port;
  console.log("");
  console.log(`  viagen server:  http://localhost:${resolvedPort}/`);
  if (appCommand) {
    console.log(`  app command:    ${appCommand}`);
    console.log(`  app port:       ${appPort}`);
  }
  console.log("");

  return server;
}
