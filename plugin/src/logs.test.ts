import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTestServer } from "./test-server";
import { registerLogRoutes } from "./logs";
import { LogBuffer } from "./logger";

describe("log routes", () => {
  let logBuffer: LogBuffer;
  let server: ReturnType<typeof createTestServer>;

  beforeAll(async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "viagen-logs-test-"));
    logBuffer = new LogBuffer();
    logBuffer.init(tempDir);

    server = createTestServer((app) => {
      registerLogRoutes(
        { middlewares: app } as import("vite").ViteDevServer,
        { logBuffer },
      );
    });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("returns empty entries for fresh buffer", async () => {
    const res = await fetch(server.url + "/via/logs");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: unknown[]; count: number };
    expect(body.entries).toEqual([]);
    expect(body.count).toBe(0);
  });

  it("returns log entries after push", async () => {
    logBuffer.push("info", "Server started");
    logBuffer.push("warn", "Deprecation warning");
    logBuffer.push("error", "Build failed");

    const res = await fetch(server.url + "/via/logs");
    const body = (await res.json()) as {
      entries: { level: string; text: string; timestamp: number }[];
      count: number;
    };
    expect(body.count).toBe(3);
    expect(body.entries[0].level).toBe("info");
    expect(body.entries[0].text).toBe("Server started");
    expect(body.entries[1].level).toBe("warn");
    expect(body.entries[2].level).toBe("error");
    expect(body.entries[2].text).toBe("Build failed");
  });

  it("filters entries with ?since=", async () => {
    // All existing entries have timestamps <= now
    const now = Date.now();

    // Small delay to ensure new entry has a later timestamp
    await new Promise((r) => setTimeout(r, 10));
    logBuffer.push("info", "New entry");

    const res = await fetch(server.url + "/via/logs?since=" + now);
    const body = (await res.json()) as {
      entries: { level: string; text: string; timestamp: number }[];
      count: number;
    };
    expect(body.count).toBe(1);
    expect(body.entries[0].text).toBe("New entry");
  });

  it("rejects non-GET", async () => {
    const res = await fetch(server.url + "/via/logs", { method: "POST" });
    expect(res.status).toBe(405);
  });
});
