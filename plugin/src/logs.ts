import type { ViteDevServer } from "vite";
import type { LogBuffer } from "./logger";

export function registerLogRoutes(
  server: ViteDevServer,
  opts: { logBuffer: LogBuffer },
) {
  server.middlewares.use("/via/logs", (req, res) => {
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    res.setHeader("Content-Type", "application/json");

    const url = new URL(req.url ?? "/", "http://localhost");
    const sinceParam = url.searchParams.get("since");
    const since = sinceParam ? Number(sinceParam) : 0;

    let entries = opts.logBuffer.getEntries();
    if (since > 0) {
      entries = entries.filter((e) => e.timestamp > since);
    }

    res.end(JSON.stringify({ entries, count: entries.length }));
  });
}
