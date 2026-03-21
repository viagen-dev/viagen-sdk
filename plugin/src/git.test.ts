import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { createTestServer } from "./test-server";
import { registerGitRoutes } from "./git";

function gitInit(cwd: string) {
  execSync("git init", { cwd, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd, stdio: "pipe" });
}

describe("git routes", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), "viagen-git-test-"));
    gitInit(tempDir);

    // Create initial commit
    writeFileSync(join(tempDir, "existing.txt"), "hello\n");
    execSync("git add existing.txt", { cwd: tempDir, stdio: "pipe" });
    execSync('git commit -m "initial"', { cwd: tempDir, stdio: "pipe" });

    // Create modifications for testing
    writeFileSync(join(tempDir, "existing.txt"), "hello\nworld\n");
    writeFileSync(join(tempDir, "new-file.txt"), "brand new\n");
    mkdirSync(join(tempDir, "subdir"), { recursive: true });
    writeFileSync(join(tempDir, "subdir", "nested.txt"), "nested\n");
  });

  let gitServer: ReturnType<typeof createTestServer>;
  let noGitServer: ReturnType<typeof createTestServer>;

  beforeAll(async () => {
    gitServer = createTestServer((app) => {
      registerGitRoutes(
        { middlewares: app } as import("vite").ViteDevServer,
        { projectRoot: tempDir, env: {} },
      );
    });
    await gitServer.start();

    const noGitDir = mkdtempSync(join(tmpdir(), "viagen-nogit-test-"));
    noGitServer = createTestServer((app) => {
      registerGitRoutes(
        { middlewares: app } as import("vite").ViteDevServer,
        { projectRoot: noGitDir, env: {} },
      );
    });
    await noGitServer.start();
  });

  afterAll(async () => {
    await gitServer.stop();
    await noGitServer.stop();
  });

  // --- status ---

  it("returns changed files from git status", async () => {
    const res = await fetch(gitServer.url + "/via/git/status");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      files: {
        path: string;
        status: string;
        insertions: number;
        deletions: number;
      }[];
      git: boolean;
      insertions: number;
      deletions: number;
    };
    expect(body.git).toBe(true);
    expect(body.files.length).toBeGreaterThanOrEqual(2);

    const paths = body.files.map((f) => f.path);
    expect(paths).toContain("existing.txt");
    expect(paths).toContain("new-file.txt");

    const existing = body.files.find((f) => f.path === "existing.txt");
    expect(existing?.status).toBe("M");
    expect(existing?.insertions).toBeGreaterThanOrEqual(1);

    const newFile = body.files.find((f) => f.path === "new-file.txt");
    expect(newFile?.status).toBe("?");

    // Totals
    expect(body.insertions).toBeGreaterThanOrEqual(1);
    expect(typeof body.deletions).toBe("number");
  });

  it("returns git: false for non-git directory", async () => {
    const res = await fetch(noGitServer.url + "/via/git/status");
    const body = (await res.json()) as { files: unknown[]; git: boolean };
    expect(body.git).toBe(false);
    expect(body.files).toEqual([]);
  });

  it("rejects non-GET on status", async () => {
    const res = await fetch(gitServer.url + "/via/git/status", {
      method: "POST",
    });
    expect(res.status).toBe(405);
  });

  // --- diff ---

  it("returns diff for a modified file", async () => {
    const res = await fetch(
      gitServer.url + "/via/git/diff?path=existing.txt",
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { diff: string; path: string };
    expect(body.path).toBe("existing.txt");
    expect(body.diff).toContain("+world");
  });

  it("returns diff for an untracked file", async () => {
    const res = await fetch(
      gitServer.url + "/via/git/diff?path=new-file.txt",
    );
    const body = (await res.json()) as { diff: string; path: string };
    expect(body.diff).toContain("+brand new");
    expect(body.diff).toContain("--- /dev/null");
  });

  it("returns full diff without path param", async () => {
    const res = await fetch(gitServer.url + "/via/git/diff");
    const body = (await res.json()) as { diff: string };
    // Should include the modified file diff
    expect(body.diff).toContain("+world");
  });

  it("rejects absolute paths", async () => {
    const res = await fetch(gitServer.url + "/via/git/diff?path=/etc/passwd");
    expect(res.status).toBe(400);
  });

  it("rejects non-GET on diff", async () => {
    const res = await fetch(gitServer.url + "/via/git/diff", {
      method: "POST",
    });
    expect(res.status).toBe(405);
  });

  it("returns empty diff for non-git directory", async () => {
    const res = await fetch(noGitServer.url + "/via/git/diff");
    const body = (await res.json()) as { diff: string; git: boolean };
    expect(body.git).toBe(false);
    expect(body.diff).toBe("");
  });
});
