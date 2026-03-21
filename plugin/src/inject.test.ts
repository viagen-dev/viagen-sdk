import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestServer } from "./test-server";
import { createInjectionMiddleware } from "./inject";

const HTML_PAGE =
  "<!DOCTYPE html><html><head><title>Test</title></head><body><p>Hello</p></body></html>";
const HTML_NO_HEAD =
  "<!DOCTYPE html><html><body><p>Hello</p></body></html>";
const HTML_WITH_MARKER =
  '<!DOCTYPE html><html><head></head><body><button id="viagen-toggle"></button></body></html>';

describe("injection middleware", () => {
  // Server with injection middleware followed by a handler that serves
  // different content based on the request path.
  const server = createTestServer((app) => {
    app.use(createInjectionMiddleware());

    app.use("/html", (_req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end(HTML_PAGE);
    });

    app.use("/html-no-head", (_req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end(HTML_NO_HEAD);
    });

    app.use("/html-with-marker", (_req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end(HTML_WITH_MARKER);
    });

    app.use("/json", (_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true }));
    });

    app.use("/via/ui", (_req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end("<html><body>Chat UI</body></html>");
    });

    app.use("/html-with-length", (_req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.setHeader("Content-Length", String(Buffer.byteLength(HTML_PAGE)));
      res.end(HTML_PAGE);
    });
  });

  beforeAll(() => server.start());
  afterAll(() => server.stop());

  it("injects script into HTML response before </head>", async () => {
    const res = await fetch(server.url + "/html", {
      headers: { Accept: "text/html" },
    });
    const body = await res.text();
    expect(body).toContain('<script src="/via/client.js" defer></script>');
    expect(body).toContain("</head>");
    // Script should be before </head>
    const scriptIdx = body.indexOf("/via/client.js");
    const headIdx = body.indexOf("</head>");
    expect(scriptIdx).toBeLessThan(headIdx);
  });

  it("falls back to </body> when no </head>", async () => {
    const res = await fetch(server.url + "/html-no-head", {
      headers: { Accept: "text/html" },
    });
    const body = await res.text();
    expect(body).toContain('<script src="/via/client.js" defer></script>');
    const scriptIdx = body.indexOf("/via/client.js");
    const bodyIdx = body.indexOf("</body>");
    expect(scriptIdx).toBeLessThan(bodyIdx);
  });

  it("skips injection when marker already present", async () => {
    const res = await fetch(server.url + "/html-with-marker", {
      headers: { Accept: "text/html" },
    });
    const body = await res.text();
    expect(body).not.toContain("/via/client.js");
    expect(body).toBe(HTML_WITH_MARKER);
  });

  it("skips non-HTML content types", async () => {
    const res = await fetch(server.url + "/json", {
      headers: { Accept: "text/html" },
    });
    const body = await res.text();
    expect(body).not.toContain("/via/client.js");
    expect(JSON.parse(body)).toEqual({ ok: true });
  });

  it("skips requests that don't accept HTML", async () => {
    const res = await fetch(server.url + "/html", {
      headers: { Accept: "application/json" },
    });
    const body = await res.text();
    expect(body).not.toContain("/via/client.js");
  });

  it("skips /via/* routes", async () => {
    const res = await fetch(server.url + "/via/ui", {
      headers: { Accept: "text/html" },
    });
    const body = await res.text();
    expect(body).not.toContain("/via/client.js");
  });

  it("skips POST requests", async () => {
    const res = await fetch(server.url + "/html", {
      method: "POST",
      headers: { Accept: "text/html" },
    });
    // POST will likely 404 or pass through, but should not have injection
    const body = await res.text();
    // The handler still responds to POST (connect doesn't filter methods),
    // but the injection middleware should not wrap it
    expect(body).not.toContain("/via/client.js");
  });

  it("strips Content-Length when injecting", async () => {
    const res = await fetch(server.url + "/html-with-length", {
      headers: { Accept: "text/html" },
    });
    const body = await res.text();
    expect(body).toContain("/via/client.js");
    // Content-Length should have been removed (body is longer than original)
    const cl = res.headers.get("content-length");
    expect(cl).toBeNull();
  });
});
