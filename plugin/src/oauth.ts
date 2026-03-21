import { randomBytes, createHash } from "node:crypto";
import { createServer } from "node:http";
import { execSync } from "node:child_process";

const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const TOKEN_ENDPOINT = "https://platform.claude.com/v1/oauth/token";
const CREATE_KEY_ENDPOINT =
  "https://api.anthropic.com/api/oauth/claude_cli/create_api_key";
const SCOPES = "org:create_api_key user:profile user:inference";

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function openBrowser(url: string) {
  try {
    const platform = process.platform;
    if (platform === "darwin") execSync(`open "${url}"`);
    else if (platform === "linux") execSync(`xdg-open "${url}"`);
    else if (platform === "win32") execSync(`start "${url}"`);
  } catch {
    // User can open manually
  }
}

function startCallbackServer(expectedState: string): Promise<{
  port: number;
  waitForCode: () => Promise<string>;
  close: () => void;
}> {
  return new Promise((resolve) => {
    let resolveCode: (code: string) => void;
    const codePromise = new Promise<string>((r) => {
      resolveCode = r;
    });

    const server = createServer((req, res) => {
      const url = new URL(req.url || "/", `http://localhost`);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");

      if (code && state === expectedState) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<html><body style='font-family:system-ui;background:#09090b;color:#e4e4e7;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;'><div style='text-align:center'><h2>Authenticated</h2><p style='color:#a1a1aa'>You can close this tab.</p></div></body></html>",
        );
        resolveCode(code);
      } else if (code) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Invalid state parameter");
      } else {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Missing authorization code");
      }
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        port,
        waitForCode: () => codePromise,
        close: () => server.close(),
      });
    });
  });
}

async function exchangeCode(
  code: string,
  redirectUri: string,
  verifier: string,
  state: string,
): Promise<OAuthTokens> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      state,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  return (await res.json()) as OAuthTokens;
}

/**
 * OAuth PKCE flow for Claude Max/Pro subscriptions.
 * Returns access + refresh tokens for direct API use.
 */
export async function oauthMaxFlow(): Promise<OAuthTokens> {
  const { verifier, challenge } = generatePKCE();
  const state = randomBytes(16).toString("hex");
  const { port, waitForCode, close } = await startCallbackServer(state);
  const redirectUri = `http://localhost:${port}/callback`;

  const authorizeUrl = new URL("https://claude.ai/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", CLIENT_ID);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", SCOPES);
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("state", state);

  console.log("Opening browser for Claude Max/Pro login...");
  openBrowser(authorizeUrl.toString());
  console.log("Waiting for authorization...");

  const code = await waitForCode();
  close();

  return exchangeCode(code, redirectUri, verifier, state);
}

/**
 * OAuth PKCE flow for Anthropic Console.
 * Creates a permanent API key and returns it.
 */
export async function oauthConsoleFlow(): Promise<string> {
  const { verifier, challenge } = generatePKCE();
  const state = randomBytes(16).toString("hex");
  const { port, waitForCode, close } = await startCallbackServer(state);
  const redirectUri = `http://localhost:${port}/callback`;

  const authorizeUrl = new URL(
    "https://platform.claude.com/oauth/authorize",
  );
  authorizeUrl.searchParams.set("client_id", CLIENT_ID);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", SCOPES);
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("state", state);

  console.log("Opening browser for Anthropic Console login...");
  openBrowser(authorizeUrl.toString());
  console.log("Waiting for authorization...");

  const code = await waitForCode();
  close();

  const tokens = await exchangeCode(code, redirectUri, verifier, state);

  // Use temporary token to create a permanent API key
  const keyRes = await fetch(CREATE_KEY_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "viagen" }),
  });

  if (!keyRes.ok) {
    const text = await keyRes.text();
    throw new Error(`API key creation failed (${keyRes.status}): ${text}`);
  }

  const keyData = (await keyRes.json()) as { raw_key: string };
  return keyData.raw_key;
}

/**
 * Refresh an expired access token.
 */
export async function refreshAccessToken(
  refresh: string,
): Promise<OAuthTokens> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: refresh,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }

  return (await res.json()) as OAuthTokens;
}
