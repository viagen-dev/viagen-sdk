import type { IncomingMessage, ServerResponse } from "node:http";
import { debug } from "./debug";

type NextFn = (err?: unknown) => void;

function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    cookies[key] = val;
  }
  return cookies;
}

/**
 * Returns a small HTML page that polls the target URL until Vite is ready,
 * then navigates. This avoids the white-screen race condition where a 302
 * redirect lands before Vite finishes its first compile.
 */
function buildWaitPage(targetUrl: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Loading…</title>
<style>
  body { margin: 0; display: flex; align-items: center; justify-content: center;
         height: 100vh; background: #0a0a0a; color: #888; font-family: system-ui; }
  .spinner { width: 20px; height: 20px; border: 2px solid #333; border-top-color: #f97316;
             border-radius: 50%; animation: spin .6s linear infinite; margin-right: 12px; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style></head>
<body><div class="spinner"></div><span>Starting dev server…</span>
<script>
(async () => {
  const target = ${JSON.stringify(targetUrl)};
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(target, { credentials: 'same-origin' });
      const text = await r.text();
      // Vite is ready when we get a non-empty HTML response
      if (r.ok && text.length > 0) { window.location.replace(target); return; }
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  // After 30s, navigate anyway — let the user see whatever error there is
  window.location.replace(target);
})();
</script></body></html>`;
}

export function createAuthMiddleware(token: string) {
  return function authMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: NextFn,
  ) {
    // 1. Strip /t/:token or ?token= from URL first — set cookie and serve
    //    a wait page that polls until Vite is ready before navigating.
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    const pathMatch = url.pathname.match(/^(.*)\/t\/([^/]+)$/);
    if (pathMatch && pathMatch[2] === token) {
      const cleanPath = pathMatch[1] || "/";
      const cleanUrl = cleanPath + (url.search || "");
      debug("auth", `token URL match (/t/:token) → wait-page redirect to ${cleanUrl}`);
      res.setHeader(
        "Set-Cookie",
        `viagen_session=${token}; HttpOnly; SameSite=Lax; Path=/`,
      );
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(buildWaitPage(cleanUrl));
      return;
    }

    const queryToken = url.searchParams.get("token");
    if (queryToken === token) {
      url.searchParams.delete("token");
      const cleanUrl = url.pathname + (url.search || "");
      debug("auth", `query token match (?token=) → wait-page redirect to ${cleanUrl}`);
      res.setHeader(
        "Set-Cookie",
        `viagen_session=${token}; HttpOnly; SameSite=Lax; Path=/`,
      );
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(buildWaitPage(cleanUrl));
      return;
    }

    // 2. Check session cookie
    if (req.headers.cookie) {
      const cookies = parseCookies(req.headers.cookie);
      if (cookies["viagen_session"] === token) {
        debug("auth", `cookie auth OK for ${url.pathname}`);
        next();
        return;
      }
      debug("auth", `cookie present but no match for ${url.pathname}`);
    }

    // 3. Check Authorization header
    const auth = req.headers.authorization;
    if (auth && auth === `Bearer ${token}`) {
      debug("auth", `bearer auth OK for ${url.pathname}`);
      next();
      return;
    }

    // 5. Unauthorized
    debug("auth", `REJECTED 401 for ${url.pathname} (no cookie, no bearer, no token URL)`);
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Unauthorized" }));
  };
}
