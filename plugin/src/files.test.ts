import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTestServer } from "./test-server";
import { registerFileRoutes } from "./files";
import type { ViteDevServer } from "vite";

describe("file routes", () => {
  let tempDir: string;

  const server = createTestServer((app) => {
    tempDir = mkdtempSync(join(tmpdir(), "viagen-test-"));

    // Create test file structure
    mkdirSync(join(tempDir, "src", "components"), { recursive: true });
    mkdirSync(join(tempDir, "secret"), { recursive: true });
    mkdirSync(join(tempDir, "src", "node_modules", "dep"), { recursive: true });
    writeFileSync(join(tempDir, ".env"), "API_KEY=secret123\nDB_URL=postgres://localhost");
    writeFileSync(join(tempDir, "src", "app.ts"), "export const app = true;");
    writeFileSync(join(tempDir, "src", "components", "Button.tsx"), "<button />");
    writeFileSync(join(tempDir, "secret", "keys.json"), "{}");
    writeFileSync(join(tempDir, "src", "node_modules", "dep", "index.js"), "module.exports = {}");

    const fakeServer = { middlewares: app } as unknown as ViteDevServer;
    registerFileRoutes(fakeServer, {
      editable: ["src", ".env"],
      projectRoot: tempDir,
    });
  });

  beforeAll(() => server.start());
  afterAll(async () => {
    await server.stop();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("GET /via/files", () => {
    it("returns files matching editable directories and files", async () => {
      const res = await fetch(`${server.url}/via/files`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.files).toContain(".env");
      expect(body.files).toContain("src/app.ts");
      expect(body.files).toContain("src/components/Button.tsx");
    });

    it("excludes files outside editable list", async () => {
      const res = await fetch(`${server.url}/via/files`);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.files).not.toContain("secret/keys.json");
    });

    it("excludes node_modules within editable directories", async () => {
      const res = await fetch(`${server.url}/via/files`);
      const body = (await res.json()) as Record<string, unknown>;
      const hasNodeModules = (body.files as string[]).some((f: string) =>
        f.includes("node_modules"),
      );
      expect(hasNodeModules).toBe(false);
    });

    it("returns 405 for non-GET methods", async () => {
      const res = await fetch(`${server.url}/via/files`, { method: "POST" });
      expect(res.status).toBe(405);
    });
  });

  describe("GET /via/file", () => {
    it("reads file content for allowed path", async () => {
      const res = await fetch(
        `${server.url}/via/file?path=${encodeURIComponent("src/app.ts")}`,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.path).toBe("src/app.ts");
      expect(body.content).toBe("export const app = true;");
    });

    it("reads .env file content", async () => {
      const res = await fetch(
        `${server.url}/via/file?path=${encodeURIComponent(".env")}`,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.content).toContain("API_KEY=secret123");
    });

    it("returns 400 for missing path parameter", async () => {
      const res = await fetch(`${server.url}/via/file`);
      expect(res.status).toBe(400);
    });

    it("returns 403 for path outside editable list", async () => {
      const res = await fetch(
        `${server.url}/via/file?path=${encodeURIComponent("secret/keys.json")}`,
      );
      expect(res.status).toBe(403);
    });

    it("returns 403 for directory traversal attempts", async () => {
      const res = await fetch(
        `${server.url}/via/file?path=${encodeURIComponent("../../../etc/passwd")}`,
      );
      expect(res.status).toBe(403);
    });

    it("returns 403 for absolute paths", async () => {
      const res = await fetch(
        `${server.url}/via/file?path=${encodeURIComponent("/etc/passwd")}`,
      );
      expect(res.status).toBe(403);
    });

    it("returns 404 for nonexistent file in editable path", async () => {
      const res = await fetch(
        `${server.url}/via/file?path=${encodeURIComponent("src/missing.ts")}`,
      );
      expect(res.status).toBe(404);
    });
  });

  describe("POST /via/file", () => {
    it("writes file content for allowed path", async () => {
      const res = await fetch(`${server.url}/via/file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "src/app.ts",
          content: "export const app = false;",
        }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.status).toBe("ok");

      // Verify on disk
      const onDisk = readFileSync(join(tempDir, "src", "app.ts"), "utf-8");
      expect(onDisk).toBe("export const app = false;");
    });

    it("returns 403 for path outside editable list", async () => {
      const res = await fetch(`${server.url}/via/file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "secret/keys.json",
          content: "hacked",
        }),
      });
      expect(res.status).toBe(403);
    });

    it("returns 403 for directory traversal in POST", async () => {
      const res = await fetch(`${server.url}/via/file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "../outside.txt",
          content: "escape",
        }),
      });
      expect(res.status).toBe(403);
    });

    it("returns 400 for missing path or content", async () => {
      const res = await fetch(`${server.url}/via/file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "src/app.ts" }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid JSON body", async () => {
      const res = await fetch(`${server.url}/via/file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("method enforcement", () => {
    it("returns 405 for DELETE on /via/file", async () => {
      const res = await fetch(`${server.url}/via/file?path=src/app.ts`, {
        method: "DELETE",
      });
      expect(res.status).toBe(405);
    });
  });
});
