import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestServer } from "./test-server";
import { registerHealthRoutes, type ViteError } from "./health";
import type { ViteDevServer } from "vite";

describe("health routes", () => {
  let lastError: ViteError | null = null;

  const server = createTestServer((app) => {
    const fakeServer = { middlewares: app } as unknown as ViteDevServer;
    registerHealthRoutes(
      fakeServer,
      { ANTHROPIC_API_KEY: "sk-test-key" },
      { get: () => lastError },
    );
  });

  beforeAll(() => server.start());
  afterAll(() => server.stop());

  describe("GET /via/health", () => {
    it("returns ok when API key is configured", async () => {
      const res = await fetch(`${server.url}/via/health`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "ok", configured: true, git: false, vercel: false, branch: null, session: null, prompt: null, taskId: null, environmentId: null, projectId: null, missing: ["GITHUB_TOKEN"] });
    });
  });

  describe("GET /via/error", () => {
    it("returns null error when no error exists", async () => {
      lastError = null;
      const res = await fetch(`${server.url}/via/error`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ error: null });
    });

    it("returns structured error when one exists", async () => {
      lastError = {
        message: "Cannot find module './missing'",
        stack: "Error: Cannot find module...",
        frame: "  1 | import './missing'",
        plugin: "vite:esbuild",
        loc: { file: "src/main.ts", line: 1, column: 0 },
      };

      const res = await fetch(`${server.url}/via/error`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { error: ViteError };
      expect(body.error.message).toBe("Cannot find module './missing'");
      expect(body.error.plugin).toBe("vite:esbuild");
      expect(body.error.loc?.file).toBe("src/main.ts");
    });
  });
});

describe("health routes — missing API key", () => {
  const server = createTestServer((app) => {
    const fakeServer = { middlewares: app } as unknown as ViteDevServer;
    registerHealthRoutes(fakeServer, {}, { get: () => null });
  });

  beforeAll(() => server.start());
  afterAll(() => server.stop());

  it("reports missing keys when API key is not set", async () => {
    const res = await fetch(`${server.url}/via/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      status: "error",
      configured: false,
      git: false,
      vercel: false,
      branch: null,
      session: null,
      prompt: null,
      taskId: null,
      environmentId: null,
      projectId: null,
      missing: ["ANTHROPIC_API_KEY", "GITHUB_TOKEN"],
    });
  });
});
