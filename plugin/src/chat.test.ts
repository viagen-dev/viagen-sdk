import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTestServer } from "./test-server";
import { registerChatRoutes, ChatSession } from "./chat";
import { LogBuffer } from "./logger";
import type { ViteDevServer } from "vite";
import type { McpServerConfig, CanUseTool } from "@anthropic-ai/claude-agent-sdk";

/**
 * Tests for chat endpoint validation paths.
 * These don't spawn Claude — they test the guard logic
 * (method, API key, body parsing) that runs before the subprocess.
 */
describe("chat routes — validation", () => {
  const logBuffer = new LogBuffer();
  const env: Record<string, string> = {}; // no API key

  const server = createTestServer((app) => {
    const fakeServer = { middlewares: app } as unknown as ViteDevServer;
    const session = new ChatSession({
      env,
      projectRoot: "/tmp/fake",
      logBuffer,
      model: "sonnet",
    });
    registerChatRoutes(fakeServer, session, { env });
  });

  beforeAll(() => server.start());
  afterAll(() => server.stop());

  it("rejects non-POST to /via/chat", async () => {
    const res = await fetch(`${server.url}/via/chat`);
    expect(res.status).toBe(405);
    expect(await res.json()).toEqual({ error: "Method not allowed" });
  });

  it("returns 500 when no Claude auth is configured", async () => {
    const res = await fetch(`${server.url}/via/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "No Claude auth configured. Run `npx viagen setup`.",
    });
  });

  it("resets session via /via/chat/reset", async () => {
    const res = await fetch(`${server.url}/via/chat/reset`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("chat routes — body validation", () => {
  const logBuffer = new LogBuffer();
  const env: Record<string, string> = { ANTHROPIC_API_KEY: "sk-test-key" };

  const server = createTestServer((app) => {
    const fakeServer = { middlewares: app } as unknown as ViteDevServer;
    const session = new ChatSession({
      env,
      projectRoot: "/tmp/fake",
      logBuffer,
      model: "sonnet",
    });
    registerChatRoutes(fakeServer, session, { env });
  });

  beforeAll(() => server.start());
  afterAll(() => server.stop());

  it("rejects invalid JSON body", async () => {
    const res = await fetch(`${server.url}/via/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON body" });
  });

  it("rejects missing message field", async () => {
    const res = await fetch(`${server.url}/via/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notMessage: "hello" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Missing "message" field' });
  });
});

describe("chat routes — history", () => {
  const logBuffer = new LogBuffer();
  const env: Record<string, string> = {};
  const projectRoot = join(tmpdir(), "viagen-test-" + Date.now());

  const server = createTestServer((app) => {
    const fakeServer = { middlewares: app } as unknown as ViteDevServer;
    const session = new ChatSession({
      env,
      projectRoot,
      logBuffer,
      model: "sonnet",
    });
    registerChatRoutes(fakeServer, session, { env });
  });

  beforeAll(() => {
    mkdirSync(join(projectRoot, ".viagen"), { recursive: true });
    return server.start();
  });

  afterAll(async () => {
    await server.stop();
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("returns empty entries when no chat log exists", async () => {
    const res = await fetch(`${server.url}/via/chat/history`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ entries: [] });
  });

  it("returns parsed entries from chat log", async () => {
    const entries = [
      { role: "user", type: "message", text: "hello", timestamp: 1000 },
      { role: "assistant", type: "text", text: "hi there", timestamp: 1001 },
      { role: "assistant", type: "tool_use", name: "Read", timestamp: 1002 },
    ];
    writeFileSync(
      join(projectRoot, ".viagen", "chat.log"),
      entries.map((e) => JSON.stringify(e)).join("\n") + "\n",
    );

    const res = await fetch(`${server.url}/via/chat/history`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { entries: typeof entries };
    expect(data.entries).toHaveLength(3);
    expect(data.entries[0]).toEqual(entries[0]);
    expect(data.entries[1]).toEqual(entries[1]);
    expect(data.entries[2]).toEqual(entries[2]);
  });
});

describe("ChatSession — MCP options passthrough", () => {
  it("accepts mcpServers option", () => {
    const logBuffer = new LogBuffer();
    const mcpServers: Record<string, McpServerConfig> = {
      test: { type: "sdk", name: "test" } as McpServerConfig,
    };
    const session = new ChatSession({
      env: {},
      projectRoot: "/tmp/fake",
      logBuffer,
      model: "sonnet",
      mcpServers,
    });
    expect(session).toBeDefined();
  });

  it("accepts disallowedTools option", () => {
    const logBuffer = new LogBuffer();
    const session = new ChatSession({
      env: {},
      projectRoot: "/tmp/fake",
      logBuffer,
      model: "sonnet",
      disallowedTools: ["Edit", "NotebookEdit"],
    });
    expect(session).toBeDefined();
  });

  it("accepts canUseTool option", () => {
    const logBuffer = new LogBuffer();
    const canUseTool: CanUseTool = async () => ({
      behavior: "allow" as const,
    });
    const session = new ChatSession({
      env: {},
      projectRoot: "/tmp/fake",
      logBuffer,
      model: "sonnet",
      canUseTool,
    });
    expect(session).toBeDefined();
  });

  it("accepts all MCP options together", () => {
    const logBuffer = new LogBuffer();
    const canUseTool: CanUseTool = async () => ({
      behavior: "allow" as const,
    });
    const session = new ChatSession({
      env: {},
      projectRoot: "/tmp/fake",
      logBuffer,
      model: "sonnet",
      mcpServers: {
        viagen: { type: "sdk", name: "viagen" } as McpServerConfig,
      },
      disallowedTools: ["Edit"],
      canUseTool,
    });
    expect(session).toBeDefined();
  });
});
