import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestServer } from "./test-server";
import { createAuthMiddleware } from "./auth";

const TOKEN = "test-secret-token";

describe("auth middleware", () => {
  const server = createTestServer((app) => {
    app.use(createAuthMiddleware(TOKEN));
    app.use((_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true }));
    });
  });

  beforeAll(() => server.start());
  afterAll(() => server.stop());

  it("rejects requests with no auth", async () => {
    const res = await fetch(server.url);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("accepts valid Bearer token", async () => {
    const res = await fetch(server.url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("rejects invalid Bearer token", async () => {
    const res = await fetch(server.url, {
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(res.status).toBe(401);
  });

  it("accepts valid session cookie", async () => {
    const res = await fetch(server.url, {
      headers: { Cookie: `viagen_session=${TOKEN}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("rejects invalid session cookie", async () => {
    const res = await fetch(server.url, {
      headers: { Cookie: "viagen_session=wrong" },
    });
    expect(res.status).toBe(401);
  });

  it("serves wait page and sets cookie on /t/:token path", async () => {
    const res = await fetch(`${server.url}/t/${TOKEN}`, {
      redirect: "manual",
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");

    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toContain(`viagen_session=${TOKEN}`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");

    const body = await res.text();
    expect(body).toContain("Starting dev server");
    // Wait page should target the clean URL
    expect(body).toContain('"/"');
  });

  it("serves wait page for /via/iframe/t/:token targeting /via/iframe", async () => {
    const res = await fetch(`${server.url}/via/iframe/t/${TOKEN}`, {
      redirect: "manual",
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('"/via/iframe"');
  });

  it("serves wait page for /via/ui/t/:token targeting /via/ui", async () => {
    const res = await fetch(`${server.url}/via/ui/t/${TOKEN}`, {
      redirect: "manual",
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('"/via/ui"');
  });

  it("preserves query params in wait page with /t/:token path", async () => {
    const res = await fetch(`${server.url}/via/iframe/t/${TOKEN}?foo=bar`, {
      redirect: "manual",
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('"/via/iframe?foo=bar"');
  });

  it("rejects invalid /t/:token path", async () => {
    const res = await fetch(`${server.url}/t/wrong-token`);
    expect(res.status).toBe(401);
  });

  it("serves wait page and sets cookie on valid ?token= param", async () => {
    const res = await fetch(`${server.url}/some/path?token=${TOKEN}&other=1`, {
      redirect: "manual",
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");

    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toContain(`viagen_session=${TOKEN}`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");

    const body = await res.text();
    expect(body).toContain('"/some/path?other=1"');
  });

  it("serves wait page targeting clean path when token is the only param", async () => {
    const res = await fetch(`${server.url}/?token=${TOKEN}`, {
      redirect: "manual",
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('"/"');
  });

  it("rejects invalid ?token= param", async () => {
    const res = await fetch(`${server.url}/?token=wrong`);
    expect(res.status).toBe(401);
  });
});
