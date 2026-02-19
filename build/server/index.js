import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { PassThrough } from "node:stream";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter, UNSAFE_withComponentProps, Outlet, UNSAFE_withErrorBoundaryProps, isRouteErrorResponse, Meta, Links, ScrollRestoration, Scripts, redirect, useLoaderData, useNavigate, useSearchParams, useLocation, Link, useRouteLoaderData } from "react-router";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import "dotenv/config";
import { MicrosoftEntraId, GitHub, Google, generateState, generateCodeVerifier } from "arctic";
import { randomBytes, createHash } from "crypto";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { pgTable, timestamp, varchar, uuid, primaryKey } from "drizzle-orm/pg-core";
import { and, eq } from "drizzle-orm";
import { useState, useEffect } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
const streamTimeout = 5e3;
function handleRequest(request, responseStatusCode, responseHeaders, routerContext, loadContext) {
  if (request.method.toUpperCase() === "HEAD") {
    return new Response(null, {
      status: responseStatusCode,
      headers: responseHeaders
    });
  }
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    let userAgent = request.headers.get("user-agent");
    let readyOption = userAgent && isbot(userAgent) || routerContext.isSpaMode ? "onAllReady" : "onShellReady";
    let timeoutId = setTimeout(
      () => abort(),
      streamTimeout + 1e3
    );
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(ServerRouter, { context: routerContext, url: request.url }),
      {
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough({
            final(callback) {
              clearTimeout(timeoutId);
              timeoutId = void 0;
              callback();
            }
          });
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          pipe(body);
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode
            })
          );
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          if (shellRendered) {
            console.error(error);
          }
        }
      }
    );
  });
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest,
  streamTimeout
}, Symbol.toStringTag, { value: "Module" }));
function Layout({
  children
}) {
  return /* @__PURE__ */ jsxs("html", {
    lang: "en",
    suppressHydrationWarning: true,
    children: [/* @__PURE__ */ jsxs("head", {
      children: [/* @__PURE__ */ jsx("meta", {
        charSet: "utf-8"
      }), /* @__PURE__ */ jsx("meta", {
        name: "viewport",
        content: "width=device-width, initial-scale=1"
      }), /* @__PURE__ */ jsx("title", {
        children: "viagen"
      }), /* @__PURE__ */ jsx(Meta, {}), /* @__PURE__ */ jsx(Links, {})]
    }), /* @__PURE__ */ jsxs("body", {
      children: [children, /* @__PURE__ */ jsx(ScrollRestoration, {}), /* @__PURE__ */ jsx(Scripts, {})]
    })]
  });
}
const root = UNSAFE_withComponentProps(function App() {
  return /* @__PURE__ */ jsx(Outlet, {});
});
const ErrorBoundary = UNSAFE_withErrorBoundaryProps(function ErrorBoundary2({
  error
}) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack;
  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details = error.status === 404 ? "The requested page could not be found." : error.statusText || details;
  }
  return /* @__PURE__ */ jsxs("main", {
    className: "mx-auto max-w-xl px-4 py-16 text-center",
    children: [/* @__PURE__ */ jsx("h1", {
      className: "text-2xl font-bold tracking-tight",
      children: message
    }), /* @__PURE__ */ jsx("p", {
      className: "mt-2 text-muted-foreground",
      children: details
    }), stack]
  });
});
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary,
  Layout,
  default: root
}, Symbol.toStringTag, { value: "Module" }));
const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  avatarUrl: varchar("avatar_url", { length: 1024 }),
  provider: varchar("provider", { length: 32 }).notNull(),
  providerUserId: varchar("provider_user_id", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
const sessions = pgTable("sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
const orgMembers = pgTable("org_members", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 32 }).notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (t) => [
  primaryKey({ columns: [t.userId, t.organizationId] })
]);
const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  vercelProjectId: varchar("vercel_project_id", { length: 255 }),
  githubRepo: varchar("github_repo", { length: 255 }),
  templateId: varchar("template_id", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => /* @__PURE__ */ new Date())
});
const apiTokens = pgTable("api_tokens", {
  id: varchar("id", { length: 64 }).primaryKey(),
  // SHA-256 hash of plaintext token
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  tokenPrefix: varchar("token_prefix", { length: 8 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
const schema = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  apiTokens,
  orgMembers,
  organizations,
  projects,
  sessions,
  users
}, Symbol.toStringTag, { value: "Module" }));
const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql, { schema });
const redirectBase$1 = process.env.AUTH_REDIRECT_BASE ?? "http://localhost:5173";
const providers = {
  google: new Google(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${redirectBase$1}/api/auth/callback/google`
  ),
  github: new GitHub(
    process.env.GITHUB_CLIENT_ID,
    process.env.GITHUB_CLIENT_SECRET,
    `${redirectBase$1}/api/auth/callback/github`
  ),
  microsoft: new MicrosoftEntraId(
    process.env.MICROSOFT_TENANT_ID ?? "common",
    process.env.MICROSOFT_CLIENT_ID,
    process.env.MICROSOFT_CLIENT_SECRET,
    `${redirectBase$1}/api/auth/callback/microsoft`
  )
};
function isValidProvider(name) {
  return name in providers;
}
function createAuthUrl(provider) {
  const state = generateState();
  if (provider === "github") {
    const url2 = providers.github.createAuthorizationURL(state, ["user:email"]);
    return { url: url2, state };
  }
  const codeVerifier = generateCodeVerifier();
  if (provider === "google") {
    const url2 = providers.google.createAuthorizationURL(state, codeVerifier, ["openid", "email", "profile"]);
    return { url: url2, state, codeVerifier };
  }
  const url = providers.microsoft.createAuthorizationURL(state, codeVerifier, ["openid", "email", "profile"]);
  return { url, state, codeVerifier };
}
async function exchangeCode(provider, code, codeVerifier) {
  if (provider === "github") {
    return providers.github.validateAuthorizationCode(code);
  }
  if (provider === "google") {
    return providers.google.validateAuthorizationCode(code, codeVerifier);
  }
  return providers.microsoft.validateAuthorizationCode(code, codeVerifier);
}
async function fetchProviderUser(provider, accessToken) {
  if (provider === "google") {
    const res2 = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data2 = await res2.json();
    return {
      email: data2.email,
      name: data2.name ?? null,
      avatarUrl: data2.picture ?? null,
      providerUserId: data2.id
    };
  }
  if (provider === "github") {
    const [userRes, emailRes] = await Promise.all([
      fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
      }),
      fetch("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
      })
    ]);
    const userData = await userRes.json();
    const emails = await emailRes.json();
    const primary = emails.find((e) => e.primary) ?? emails[0];
    return {
      email: primary.email,
      name: userData.name ?? userData.login,
      avatarUrl: userData.avatar_url ?? null,
      providerUserId: String(userData.id)
    };
  }
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await res.json();
  return {
    email: data.mail ?? data.userPrincipalName,
    name: data.displayName ?? null,
    avatarUrl: null,
    providerUserId: data.id
  };
}
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1e3;
function generateSessionToken() {
  return randomBytes(32).toString("hex");
}
async function createSession(userId) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(sessions).values({
    id: token,
    userId,
    expiresAt
  });
  return { token, expiresAt };
}
async function validateSession(token) {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, token));
  if (!session || session.expiresAt < /* @__PURE__ */ new Date()) {
    if (session) await db.delete(sessions).where(eq(sessions.id, token));
    return null;
  }
  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  if (!user) return null;
  return { session, user };
}
async function deleteSession(token) {
  await db.delete(sessions).where(eq(sessions.id, token));
}
const API_TOKEN_DURATION_MS = 90 * 24 * 60 * 60 * 1e3;
function hashToken(plaintext) {
  return createHash("sha256").update(plaintext).digest("hex");
}
async function createApiToken(userId, name) {
  const plaintext = randomBytes(32).toString("hex");
  const hashed = hashToken(plaintext);
  const prefix = plaintext.slice(0, 8);
  const expiresAt = new Date(Date.now() + API_TOKEN_DURATION_MS);
  await db.insert(apiTokens).values({
    id: hashed,
    userId,
    name,
    tokenPrefix: prefix,
    expiresAt
  });
  return { token: plaintext, expiresAt };
}
async function validateApiToken(plaintext) {
  const hashed = hashToken(plaintext);
  const [row] = await db.select().from(apiTokens).where(eq(apiTokens.id, hashed));
  if (!row || row.expiresAt < /* @__PURE__ */ new Date()) {
    if (row) await db.delete(apiTokens).where(eq(apiTokens.id, hashed));
    return null;
  }
  db.update(apiTokens).set({ lastUsedAt: /* @__PURE__ */ new Date() }).where(eq(apiTokens.id, hashed)).then(() => {
  });
  const [user] = await db.select().from(users).where(eq(users.id, row.userId));
  if (!user) return null;
  return { apiToken: row, user };
}
async function listApiTokens(userId) {
  return db.select({
    id: apiTokens.id,
    name: apiTokens.name,
    tokenPrefix: apiTokens.tokenPrefix,
    expiresAt: apiTokens.expiresAt,
    lastUsedAt: apiTokens.lastUsedAt,
    createdAt: apiTokens.createdAt
  }).from(apiTokens).where(eq(apiTokens.userId, userId)).orderBy(apiTokens.createdAt);
}
async function revokeApiToken(hashedId, userId) {
  await db.delete(apiTokens).where(and(eq(apiTokens.id, hashedId), eq(apiTokens.userId, userId)));
}
async function upsertUser(provider, providerUser) {
  const existing = await db.select().from(users).where(eq(users.email, providerUser.email));
  if (existing.length > 0) {
    const [updated] = await db.update(users).set({
      name: providerUser.name,
      avatarUrl: providerUser.avatarUrl,
      provider,
      providerUserId: providerUser.providerUserId
    }).where(eq(users.email, providerUser.email)).returning();
    return updated;
  }
  const [created] = await db.insert(users).values({
    email: providerUser.email,
    name: providerUser.name,
    avatarUrl: providerUser.avatarUrl,
    provider,
    providerUserId: providerUser.providerUserId
  }).returning();
  return created;
}
const SESSION_COOKIE$3 = "viagen-session";
const ORG_COOKIE = "viagen-org";
function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return void 0;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : void 0;
}
function serializeCookie(name, value, options) {
  let cookie = `${name}=${encodeURIComponent(value)}`;
  if (options?.path) cookie += `; Path=${options.path}`;
  if (options?.httpOnly) cookie += "; HttpOnly";
  if (options?.secure) cookie += "; Secure";
  if (options?.sameSite) cookie += `; SameSite=${options.sameSite}`;
  if (options?.maxAge !== void 0) cookie += `; Max-Age=${options.maxAge}`;
  if (options?.expires) cookie += `; Expires=${options.expires.toUTCString()}`;
  return cookie;
}
function deleteCookieHeader(name, path = "/") {
  return `${name}=; Path=${path}; Max-Age=0`;
}
async function fetchMemberships(userId) {
  return db.select({
    organizationId: orgMembers.organizationId,
    role: orgMembers.role,
    organizationName: organizations.name
  }).from(orgMembers).innerJoin(organizations, eq(orgMembers.organizationId, organizations.id)).where(eq(orgMembers.userId, userId));
}
function isApiRequest(request) {
  return request.headers.has("Authorization") || request.headers.get("Accept")?.includes("application/json") === true;
}
async function getSessionUser(request) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const result2 = await validateApiToken(token);
    if (result2) {
      const memberships2 = await fetchMemberships(result2.user.id);
      return { user: result2.user, memberships: memberships2 };
    }
  }
  const cookieHeader = request.headers.get("Cookie");
  const sessionToken = parseCookie(cookieHeader, SESSION_COOKIE$3);
  if (!sessionToken) return null;
  const result = await validateSession(sessionToken);
  if (!result) return null;
  const memberships = await fetchMemberships(result.user.id);
  return { user: result.user, memberships };
}
async function requireUser(request) {
  const session = await getSessionUser(request);
  if (!session) {
    if (isApiRequest(request)) {
      throw Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw redirect("/login");
  }
  return session;
}
async function requireAuth(request) {
  const session = await requireUser(request);
  if (session.memberships.length === 0) {
    if (isApiRequest(request)) {
      throw Response.json({ error: "No organization membership" }, { status: 403 });
    }
    throw redirect("/onboarding");
  }
  const cookieHeader = request.headers.get("Cookie");
  const orgFromCookie = parseCookie(cookieHeader, ORG_COOKIE);
  const orgFromHeader = request.headers.get("X-Organization");
  const orgId = orgFromCookie ?? orgFromHeader;
  let membership;
  if (orgId) {
    membership = session.memberships.find((m) => m.organizationId === orgId);
  }
  if (!membership) {
    membership = session.memberships[0];
  }
  return {
    user: session.user,
    org: { id: membership.organizationId, name: membership.organizationName },
    role: membership.role,
    memberships: session.memberships
  };
}
async function loader$h({
  request
}) {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo");
  const session = await getSessionUser(request);
  if (session && session.memberships.length > 0) {
    return redirect(returnTo ?? "/");
  }
  if (session) {
    return redirect(returnTo ?? "/onboarding");
  }
  return {
    returnTo
  };
}
const login = UNSAFE_withComponentProps(function Login() {
  const {
    returnTo
  } = useLoaderData();
  const loginUrl = returnTo ? `/api/auth/login/github?returnTo=${encodeURIComponent(returnTo)}` : "/api/auth/login/github";
  return /* @__PURE__ */ jsxs("div", {
    className: "flex min-h-svh flex-col items-center justify-center",
    children: [/* @__PURE__ */ jsx("h1", {
      className: "text-2xl font-medium",
      children: "viagen"
    }), /* @__PURE__ */ jsx("p", {
      className: "mb-6 mt-2 text-sm text-muted-foreground",
      children: "Sign in to continue"
    }), /* @__PURE__ */ jsxs("a", {
      href: loginUrl,
      className: "inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
      children: [/* @__PURE__ */ jsx(GitHubIcon$2, {}), "Continue with GitHub"]
    })]
  });
});
function GitHubIcon$2() {
  return /* @__PURE__ */ jsx("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 16 16",
    fill: "currentColor",
    children: /* @__PURE__ */ jsx("path", {
      d: "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"
    })
  });
}
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: login,
  loader: loader$h
}, Symbol.toStringTag, { value: "Module" }));
function cn(...inputs) {
  return twMerge(clsx(inputs));
}
async function loader$g({
  request
}) {
  const session = await getSessionUser(request);
  if (!session) return redirect("/login");
  return {
    hasOrg: session.memberships.length > 0,
    orgId: session.memberships[0]?.organizationId ?? null
  };
}
const STEP_KEY = "viagen-onboarding-step";
const onboarding = UNSAFE_withComponentProps(function Onboarding({
  loaderData
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    hasOrg,
    orgId
  } = loaderData;
  const getInitialStep = () => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "vercel") return "done";
    if (error === "vercel") return "vercel";
    if (connected === "github") return "vercel";
    if (error === "github") return "github";
    if (hasOrg) {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(STEP_KEY);
        if (saved === "github" || saved === "vercel") return saved;
      }
      return "github";
    }
    return "team";
  };
  const [step, setStep] = useState(getInitialStep);
  useEffect(() => {
    if (searchParams.has("connected") || searchParams.has("error")) {
      setSearchParams({}, {
        replace: true
      });
    }
  }, [searchParams, setSearchParams]);
  useEffect(() => {
    if (step !== "team") localStorage.setItem(STEP_KEY, step);
  }, [step]);
  const finish = () => {
    localStorage.removeItem(STEP_KEY);
    navigate("/", {
      replace: true
    });
  };
  useEffect(() => {
    if (step === "done") finish();
  }, [step]);
  const handleOrgCreated = async () => {
    setStep("github");
  };
  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include"
    });
    navigate("/login", {
      replace: true
    });
  };
  return /* @__PURE__ */ jsx("div", {
    className: "flex min-h-svh flex-col items-center justify-center",
    children: /* @__PURE__ */ jsxs("div", {
      className: "w-full max-w-[400px] p-8",
      children: [/* @__PURE__ */ jsxs("div", {
        className: "mb-8 flex items-center justify-center gap-2",
        children: [/* @__PURE__ */ jsx(StepDot, {
          active: step === "team",
          done: step !== "team",
          label: "1"
        }), /* @__PURE__ */ jsx("div", {
          className: "h-px w-10 bg-border"
        }), /* @__PURE__ */ jsx(StepDot, {
          active: step === "github",
          done: step === "vercel",
          label: "2"
        }), /* @__PURE__ */ jsx("div", {
          className: "h-px w-10 bg-border"
        }), /* @__PURE__ */ jsx(StepDot, {
          active: step === "vercel",
          done: false,
          label: "3"
        })]
      }), step === "team" && /* @__PURE__ */ jsx(TeamStep, {
        onNext: handleOrgCreated
      }), step === "github" && /* @__PURE__ */ jsx(GitHubStep, {
        githubError: searchParams.get("error") === "github",
        onSkip: () => setStep("vercel")
      }), step === "vercel" && /* @__PURE__ */ jsx(VercelStep, {
        vercelError: searchParams.get("error") === "vercel",
        onSkip: finish
      }), /* @__PURE__ */ jsx("button", {
        onClick: handleLogout,
        className: "mt-8 block w-full cursor-pointer border-none bg-transparent p-2 text-center text-xs text-muted-foreground hover:text-foreground",
        children: "Sign out"
      })]
    })
  });
});
function TeamStep({
  onNext
}) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/orgs", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: name.trim()
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to create team");
        return;
      }
      await onNext();
    } catch {
      setError("Something went wrong");
    } finally {
      setCreating(false);
    }
  };
  return /* @__PURE__ */ jsxs(Fragment, {
    children: [/* @__PURE__ */ jsx("h1", {
      className: "mb-2 text-center text-2xl font-semibold",
      children: "Create your team"
    }), /* @__PURE__ */ jsx("p", {
      className: "mb-8 text-center text-sm leading-relaxed text-muted-foreground",
      children: "Teams let you organize projects and collaborate with others."
    }), /* @__PURE__ */ jsxs("div", {
      className: "mb-6",
      children: [/* @__PURE__ */ jsx("label", {
        className: "mb-2 block text-sm font-medium text-foreground/70",
        children: "Team name"
      }), /* @__PURE__ */ jsx("input", {
        type: "text",
        placeholder: "Acme Inc.",
        value: name,
        onChange: (e) => setName(e.target.value),
        onKeyDown: (e) => e.key === "Enter" && handleCreate(),
        className: "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
        autoFocus: true
      })]
    }), error && /* @__PURE__ */ jsx("p", {
      className: "mb-4 text-center text-[0.8125rem] text-destructive",
      children: error
    }), /* @__PURE__ */ jsx("button", {
      onClick: handleCreate,
      disabled: creating || !name.trim(),
      className: cn("w-full cursor-pointer rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:bg-primary/90", (creating || !name.trim()) && "cursor-not-allowed opacity-50"),
      children: creating ? "Creating..." : "Continue"
    })]
  });
}
function GitHubStep({
  githubError,
  onSkip
}) {
  return /* @__PURE__ */ jsxs(Fragment, {
    children: [/* @__PURE__ */ jsx("h1", {
      className: "mb-2 text-center text-2xl font-semibold",
      children: "Connect GitHub"
    }), /* @__PURE__ */ jsx("p", {
      className: "mb-8 text-center text-sm leading-relaxed text-muted-foreground",
      children: "Link your GitHub account so viagen can access your repositories and save sandbox changes."
    }), githubError && /* @__PURE__ */ jsx("p", {
      className: "mb-4 text-center text-[0.8125rem] text-destructive",
      children: "Failed to connect GitHub. Please try again."
    }), /* @__PURE__ */ jsx("a", {
      href: "/api/integrations/github/start",
      className: "flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground no-underline transition-opacity hover:bg-primary/90",
      children: "Connect GitHub"
    }), /* @__PURE__ */ jsx("button", {
      onClick: onSkip,
      className: "mt-4 block w-full cursor-pointer border-none bg-transparent p-2 text-center text-[0.8125rem] text-muted-foreground underline hover:text-foreground",
      children: "Skip for now"
    })]
  });
}
function VercelStep({
  vercelError,
  onSkip
}) {
  return /* @__PURE__ */ jsxs(Fragment, {
    children: [/* @__PURE__ */ jsx("h1", {
      className: "mb-2 text-center text-2xl font-semibold",
      children: "Connect Vercel"
    }), /* @__PURE__ */ jsx("p", {
      className: "mb-8 text-center text-sm leading-relaxed text-muted-foreground",
      children: "Link your Vercel account to deploy projects and manage environments."
    }), vercelError && /* @__PURE__ */ jsx("p", {
      className: "mb-4 text-center text-[0.8125rem] text-destructive",
      children: "Failed to connect Vercel. Please try again."
    }), /* @__PURE__ */ jsx("a", {
      href: "/api/integrations/vercel/start",
      className: "flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground no-underline transition-opacity hover:bg-primary/90",
      children: "Connect Vercel"
    }), /* @__PURE__ */ jsx("button", {
      onClick: onSkip,
      className: "mt-4 block w-full cursor-pointer border-none bg-transparent p-2 text-center text-[0.8125rem] text-muted-foreground underline hover:text-foreground",
      children: "Skip for now"
    })]
  });
}
function StepDot({
  active,
  done,
  label
}) {
  return /* @__PURE__ */ jsx("div", {
    className: cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all", active || done ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"),
    children: done ? "✓" : label
  });
}
const route2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: onboarding,
  loader: loader$g
}, Symbol.toStringTag, { value: "Module" }));
async function loader$f({
  request
}) {
  const url = new URL(request.url);
  const portStr = url.searchParams.get("port");
  const port = portStr ? parseInt(portStr, 10) : NaN;
  if (isNaN(port) || port < 1024 || port > 65535) {
    return Response.json({
      error: "Invalid port"
    }, {
      status: 400
    });
  }
  const session = await getSessionUser(request);
  if (!session) {
    const returnTo = encodeURIComponent(`/cli/authorize?port=${port}`);
    throw redirect(`/login?returnTo=${returnTo}`);
  }
  return {
    user: {
      name: session.user.name,
      email: session.user.email
    },
    port
  };
}
async function action$8({
  request
}) {
  const {
    user
  } = await requireUser(request);
  const formData = await request.formData();
  const portStr = formData.get("port");
  const port = portStr ? parseInt(String(portStr), 10) : NaN;
  if (isNaN(port) || port < 1024 || port > 65535) {
    return Response.json({
      error: "Invalid port"
    }, {
      status: 400
    });
  }
  const {
    token
  } = await createApiToken(user.id, `cli-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`);
  return redirect(`http://127.0.0.1:${port}/callback?token=${token}`);
}
const cli_authorize = UNSAFE_withComponentProps(function CliAuthorize() {
  const {
    user,
    port
  } = useLoaderData();
  return /* @__PURE__ */ jsxs("div", {
    className: "flex min-h-svh flex-col items-center justify-center",
    children: [/* @__PURE__ */ jsx("h1", {
      className: "text-2xl font-medium",
      children: "viagen"
    }), /* @__PURE__ */ jsx("p", {
      className: "mb-6 mt-2 text-base font-medium",
      children: "Authorize CLI access?"
    }), /* @__PURE__ */ jsxs("div", {
      className: "mb-6 w-full max-w-[360px] rounded-lg border border-border p-5 text-center",
      children: [/* @__PURE__ */ jsxs("p", {
        className: "text-sm",
        children: ["Signed in as ", /* @__PURE__ */ jsx("strong", {
          children: user.name ?? user.email
        })]
      }), user.name && /* @__PURE__ */ jsx("p", {
        className: "mt-1 text-[0.8125rem] text-muted-foreground",
        children: user.email
      }), /* @__PURE__ */ jsx("p", {
        className: "mt-4 text-[0.8125rem] text-muted-foreground",
        children: "This will create an API token for the viagen CLI on your machine."
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "flex flex-col items-center gap-3",
      children: [/* @__PURE__ */ jsxs("form", {
        method: "post",
        children: [/* @__PURE__ */ jsx("input", {
          type: "hidden",
          name: "port",
          value: port
        }), /* @__PURE__ */ jsx("button", {
          type: "submit",
          className: "inline-flex items-center rounded-md bg-primary px-8 py-2.5 text-[0.8125rem] font-medium text-primary-foreground transition-colors hover:bg-primary/90",
          children: "Authorize"
        })]
      }), /* @__PURE__ */ jsx("a", {
        href: `http://127.0.0.1:${port}/callback?error=denied`,
        className: "text-[0.8125rem] text-muted-foreground no-underline hover:text-foreground",
        children: "Cancel"
      })]
    })]
  });
});
const route3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$8,
  default: cli_authorize,
  loader: loader$f
}, Symbol.toStringTag, { value: "Module" }));
const INFISICAL_API = "https://app.infisical.com";
let cachedToken = null;
async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 6e4) {
    return cachedToken.accessToken;
  }
  const res = await fetch(`${INFISICAL_API}/api/v1/auth/universal-auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      clientId: process.env.INFISICAL_CLIENT_ID,
      clientSecret: process.env.INFISICAL_CLIENT_SECRET
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Infisical auth failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  cachedToken = {
    accessToken: data.accessToken,
    expiresAt: Date.now() + data.expiresIn * 1e3
  };
  return cachedToken.accessToken;
}
const projectId = () => process.env.INFISICAL_PROJECT_ID;
const environment = "dev";
async function getSecret(orgId, key) {
  const token = await getAccessToken();
  const url = new URL(`${INFISICAL_API}/api/v3/secrets/raw/${key}`);
  url.searchParams.set("workspaceId", projectId());
  url.searchParams.set("environment", environment);
  url.searchParams.set("secretPath", `/${orgId}`);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Infisical get failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data.secret?.secretValue ?? null;
}
async function ensureFolder(orgId) {
  const token = await getAccessToken();
  const res = await fetch(`${INFISICAL_API}/api/v1/folders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      workspaceId: projectId(),
      environment,
      name: orgId,
      path: "/"
    })
  });
  if (!res.ok && res.status !== 400) {
    const body = await res.text();
    throw new Error(`Infisical folder create failed (${res.status}): ${body}`);
  }
}
async function setSecret(orgId, key, value) {
  const token = await getAccessToken();
  await ensureFolder(orgId);
  const existing = await getSecret(orgId, key);
  if (existing !== null) {
    const res = await fetch(`${INFISICAL_API}/api/v3/secrets/raw/${key}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        workspaceId: projectId(),
        environment,
        secretPath: `/${orgId}`,
        secretValue: value
      })
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Infisical update failed (${res.status}): ${body}`);
    }
  } else {
    const res = await fetch(`${INFISICAL_API}/api/v3/secrets/raw/${key}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        workspaceId: projectId(),
        environment,
        secretPath: `/${orgId}`,
        secretValue: value,
        type: "shared"
      })
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Infisical create failed (${res.status}): ${body}`);
    }
  }
}
async function deleteSecret(orgId, key) {
  const token = await getAccessToken();
  const res = await fetch(`${INFISICAL_API}/api/v3/secrets/raw/${key}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      workspaceId: projectId(),
      environment,
      secretPath: `/${orgId}`
    })
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.text();
    throw new Error(`Infisical delete failed (${res.status}): ${body}`);
  }
}
async function loader$e({
  request
}) {
  const auth = await requireAuth(request);
  const safeGet = async (key) => {
    try {
      const val = await getSecret(auth.org.id, key);
      return !!val;
    } catch {
      return false;
    }
  };
  const [github, vercel] = await Promise.all([safeGet("GITHUB_ACCESS_TOKEN"), safeGet("VERCEL_ACCESS_TOKEN")]);
  return {
    user: {
      id: auth.user.id,
      email: auth.user.email,
      name: auth.user.name,
      avatarUrl: auth.user.avatarUrl
    },
    currentOrg: auth.org,
    organizations: auth.memberships.map((m) => ({
      id: m.organizationId,
      name: m.organizationName,
      role: m.role
    })),
    integrations: {
      github,
      vercel
    }
  };
}
const _auth = UNSAFE_withComponentProps(function AuthLayout({
  loaderData
}) {
  const {
    user,
    currentOrg,
    organizations: organizations2,
    integrations
  } = loaderData;
  const location = useLocation();
  const navigate = useNavigate();
  const handleOrgSwitch = (orgId) => {
    document.cookie = `viagen-org=${orgId}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    window.location.reload();
  };
  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include"
    });
    navigate("/login");
  };
  const missingIntegrations = !integrations.github || !integrations.vercel;
  return /* @__PURE__ */ jsxs("div", {
    className: "flex min-h-svh flex-col",
    children: [/* @__PURE__ */ jsx("header", {
      className: "border-b border-border bg-background",
      children: /* @__PURE__ */ jsxs("div", {
        className: "mx-auto flex h-[60px] max-w-[1200px] items-center justify-between px-6",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "flex items-center gap-3",
          children: [/* @__PURE__ */ jsx(Link, {
            to: "/",
            className: "text-lg font-semibold text-foreground no-underline",
            children: "viagen"
          }), /* @__PURE__ */ jsx("span", {
            className: "text-lg font-light text-border",
            children: "/"
          }), organizations2.length > 1 ? /* @__PURE__ */ jsx("select", {
            value: currentOrg.id,
            onChange: (e) => handleOrgSwitch(e.target.value),
            className: "cursor-pointer rounded-md border border-border bg-transparent px-2 py-1 text-sm font-medium text-foreground",
            children: organizations2.map((org) => /* @__PURE__ */ jsx("option", {
              value: org.id,
              children: org.name
            }, org.id))
          }) : /* @__PURE__ */ jsx("span", {
            className: "text-sm font-medium text-foreground",
            children: currentOrg.name
          }), /* @__PURE__ */ jsxs("nav", {
            className: "ml-4 flex gap-1",
            children: [/* @__PURE__ */ jsx(Link, {
              to: "/",
              className: cn("rounded-md px-3 py-2 text-sm no-underline transition-colors", location.pathname === "/" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"),
              children: "Dashboard"
            }), /* @__PURE__ */ jsx(Link, {
              to: "/projects",
              className: cn("rounded-md px-3 py-2 text-sm no-underline transition-colors", location.pathname.startsWith("/projects") ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"),
              children: "Projects"
            }), /* @__PURE__ */ jsx(Link, {
              to: "/settings",
              className: cn("rounded-md px-3 py-2 text-sm no-underline transition-colors", location.pathname.startsWith("/settings") ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"),
              children: "Settings"
            })]
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "flex items-center gap-4",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "flex items-center gap-3",
            children: [user.avatarUrl && /* @__PURE__ */ jsx("img", {
              src: user.avatarUrl,
              alt: "",
              className: "h-8 w-8 rounded-full"
            }), /* @__PURE__ */ jsxs("div", {
              className: "flex flex-col",
              children: [/* @__PURE__ */ jsx("p", {
                className: "text-sm font-medium leading-tight",
                children: user.name
              }), /* @__PURE__ */ jsx("p", {
                className: "text-xs leading-tight text-muted-foreground",
                children: user.email
              })]
            })]
          }), /* @__PURE__ */ jsx("button", {
            onClick: handleLogout,
            className: "cursor-pointer rounded-md border border-border bg-transparent px-4 py-2 text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground",
            children: "Sign out"
          })]
        })]
      })
    }), missingIntegrations && /* @__PURE__ */ jsxs("div", {
      className: "flex items-center justify-center gap-3 border-b border-yellow-400 bg-amber-50 px-4 py-2.5 text-[0.8125rem] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200",
      children: [/* @__PURE__ */ jsx("span", {
        children: !integrations.github && !integrations.vercel ? "Connect your GitHub and Vercel accounts to save sandbox changes." : !integrations.github ? "Connect your GitHub account to save sandbox changes." : "Connect your Vercel account to deploy projects."
      }), /* @__PURE__ */ jsx(Link, {
        to: "/settings",
        className: "text-[0.8125rem] font-semibold text-amber-800 underline dark:text-amber-200",
        children: "Go to Settings"
      })]
    }), /* @__PURE__ */ jsx("main", {
      className: "mx-auto w-full max-w-[1200px] flex-1 px-6 py-8",
      children: /* @__PURE__ */ jsx(Outlet, {})
    })]
  });
});
const route4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: _auth,
  loader: loader$e
}, Symbol.toStringTag, { value: "Module" }));
const _auth_dashboard = UNSAFE_withComponentProps(function Dashboard() {
  const parentData = useRouteLoaderData("routes/_auth");
  const orgName = parentData?.currentOrg?.name ?? "";
  return /* @__PURE__ */ jsxs("div", {
    children: [/* @__PURE__ */ jsx("h1", {
      className: "text-3xl font-semibold mb-2",
      children: "Dashboard"
    }), /* @__PURE__ */ jsxs("p", {
      className: "text-[0.9375rem] text-muted-foreground mb-8",
      children: ["Welcome to ", orgName]
    }), /* @__PURE__ */ jsxs("div", {
      className: "grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4",
      children: [/* @__PURE__ */ jsxs("div", {
        className: "rounded-lg border border-border bg-card p-6",
        children: [/* @__PURE__ */ jsx("h3", {
          className: "text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3",
          children: "Projects"
        }), /* @__PURE__ */ jsx("p", {
          className: "text-3xl font-semibold mb-1 text-card-foreground",
          children: "0"
        }), /* @__PURE__ */ jsx("p", {
          className: "text-[0.8125rem] text-muted-foreground",
          children: "Active projects"
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "rounded-lg border border-border bg-card p-6",
        children: [/* @__PURE__ */ jsx("h3", {
          className: "text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3",
          children: "API Calls"
        }), /* @__PURE__ */ jsx("p", {
          className: "text-3xl font-semibold mb-1 text-card-foreground",
          children: "0"
        }), /* @__PURE__ */ jsx("p", {
          className: "text-[0.8125rem] text-muted-foreground",
          children: "This month"
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "rounded-lg border border-border bg-card p-6",
        children: [/* @__PURE__ */ jsx("h3", {
          className: "text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3",
          children: "Usage"
        }), /* @__PURE__ */ jsx("p", {
          className: "text-3xl font-semibold mb-1 text-card-foreground",
          children: "0%"
        }), /* @__PURE__ */ jsx("p", {
          className: "text-[0.8125rem] text-muted-foreground",
          children: "Of quota used"
        })]
      }), /* @__PURE__ */ jsxs("div", {
        className: "rounded-lg border border-border bg-card p-6",
        children: [/* @__PURE__ */ jsx("h3", {
          className: "text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3",
          children: "Status"
        }), /* @__PURE__ */ jsx("p", {
          className: "text-3xl font-semibold mb-1 text-green-500",
          children: "●"
        }), /* @__PURE__ */ jsx("p", {
          className: "text-[0.8125rem] text-muted-foreground",
          children: "All systems operational"
        })]
      })]
    })]
  });
});
const route5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: _auth_dashboard
}, Symbol.toStringTag, { value: "Module" }));
async function loader$d({
  request
}) {
  const {
    org
  } = await requireAuth(request);
  const rows = await db.select().from(projects).where(eq(projects.organizationId, org.id));
  return {
    projects: rows
  };
}
const _auth_projects = UNSAFE_withComponentProps(function Projects({
  loaderData
}) {
  const {
    projects: projects2
  } = loaderData;
  return /* @__PURE__ */ jsxs("div", {
    children: [/* @__PURE__ */ jsxs("div", {
      className: "mb-8 flex items-start justify-between",
      children: [/* @__PURE__ */ jsxs("div", {
        children: [/* @__PURE__ */ jsx("h1", {
          className: "mb-2 text-3xl font-semibold",
          children: "Projects"
        }), /* @__PURE__ */ jsx("p", {
          className: "text-[0.9375rem] text-muted-foreground",
          children: "Manage your viagen projects"
        })]
      }), /* @__PURE__ */ jsx(Link, {
        to: "/projects/new",
        className: "inline-flex items-center whitespace-nowrap rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground no-underline transition-colors hover:bg-primary/90",
        children: "New Project"
      })]
    }), projects2.length === 0 ? /* @__PURE__ */ jsxs("div", {
      className: "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/50 px-8 py-16",
      children: [/* @__PURE__ */ jsx("h3", {
        className: "mb-2 text-lg font-semibold",
        children: "No projects yet"
      }), /* @__PURE__ */ jsx("p", {
        className: "text-center text-sm text-muted-foreground",
        children: "Create your first project to get started"
      }), /* @__PURE__ */ jsx(Link, {
        to: "/projects/new",
        className: "mt-4 inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground no-underline transition-colors hover:bg-primary/90",
        children: "New Project"
      })]
    }) : /* @__PURE__ */ jsx("div", {
      className: "grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4",
      children: projects2.map((project) => /* @__PURE__ */ jsxs("div", {
        className: "rounded-lg border border-border bg-card p-6",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "mb-4",
          children: [/* @__PURE__ */ jsx("h3", {
            className: "mb-1 text-base font-semibold",
            children: project.name
          }), /* @__PURE__ */ jsxs("p", {
            className: "text-[0.8125rem] text-muted-foreground",
            children: ["Created ", new Date(project.createdAt).toLocaleDateString()]
          })]
        }), project.templateId && /* @__PURE__ */ jsx("div", {
          className: "mb-2 flex items-center gap-2",
          children: /* @__PURE__ */ jsx("span", {
            className: "inline-block rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground",
            children: project.templateId
          })
        }), project.vercelProjectId && /* @__PURE__ */ jsxs("div", {
          className: `flex items-center gap-2 ${project.githubRepo ? "mb-2" : ""}`,
          children: [/* @__PURE__ */ jsx(VercelIcon$1, {}), /* @__PURE__ */ jsx("span", {
            className: "text-[0.8125rem] text-muted-foreground",
            children: project.vercelProjectId
          })]
        }), project.githubRepo && /* @__PURE__ */ jsxs("div", {
          className: "flex items-center gap-2",
          children: [/* @__PURE__ */ jsx(GitHubIcon$1, {}), /* @__PURE__ */ jsx("span", {
            className: "text-[0.8125rem] text-muted-foreground",
            children: project.githubRepo
          })]
        })]
      }, project.id))
    })]
  });
});
function VercelIcon$1() {
  return /* @__PURE__ */ jsx("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 76 65",
    fill: "currentColor",
    className: "shrink-0",
    children: /* @__PURE__ */ jsx("path", {
      d: "M37.5274 0L75.0548 65H0L37.5274 0Z"
    })
  });
}
function GitHubIcon$1() {
  return /* @__PURE__ */ jsx("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 16 16",
    fill: "currentColor",
    className: "shrink-0",
    children: /* @__PURE__ */ jsx("path", {
      d: "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"
    })
  });
}
const route6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: _auth_projects,
  loader: loader$d
}, Symbol.toStringTag, { value: "Module" }));
const TEMPLATES = [{
  id: "react-router",
  name: "React Router",
  description: "Full-stack React with SSR, loaders, and actions",
  framework: "React"
}];
const _auth_projects_new = UNSAFE_withComponentProps(function NewProject() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [mode, setMode] = useState("template");
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [vercelProjects, setVercelProjects] = useState([]);
  const [vercelLoading, setVercelLoading] = useState(false);
  const [vercelError, setVercelError] = useState(null);
  const [selectedVercel, setSelectedVercel] = useState(null);
  useEffect(() => {
    if (mode === "import" && vercelProjects.length === 0 && !vercelLoading) {
      loadVercelProjects();
    }
  }, [mode]);
  const loadVercelProjects = async () => {
    setVercelLoading(true);
    setVercelError(null);
    try {
      const res = await fetch("/api/vercel/projects?limit=50", {
        credentials: "include"
      });
      if (res.status === 400) {
        setVercelError("not_connected");
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setVercelProjects(data.projects);
    } catch {
      setVercelError("failed");
    } finally {
      setVercelLoading(false);
    }
  };
  const selectVercelProject = (vp) => {
    setSelectedVercel(vp);
    if (!name) setName(vp.name);
  };
  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const body = {
        name: name.trim()
      };
      if (mode === "template") {
        body.templateId = selectedTemplate;
      } else if (selectedVercel) {
        body.vercelProjectId = selectedVercel.id;
        if (selectedVercel.link?.org && selectedVercel.link?.repo) {
          body.githubRepo = `${selectedVercel.link.org}/${selectedVercel.link.repo}`;
        }
      }
      const res = await fetch("/api/projects", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to create project");
        return;
      }
      navigate("/projects");
    } catch {
      setError("Something went wrong");
    } finally {
      setCreating(false);
    }
  };
  const canCreate = name.trim().length > 0 && (mode === "template" || selectedVercel !== null);
  return /* @__PURE__ */ jsxs("div", {
    children: [/* @__PURE__ */ jsxs("div", {
      className: "mb-8",
      children: [/* @__PURE__ */ jsx(Link, {
        to: "/projects",
        className: "mb-2 inline-block text-[0.8125rem] text-muted-foreground no-underline hover:text-foreground",
        children: "← Projects"
      }), /* @__PURE__ */ jsx("h1", {
        className: "text-3xl font-semibold",
        children: "New Project"
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "mb-6",
      children: [/* @__PURE__ */ jsx("label", {
        className: "mb-2 block text-sm font-medium text-foreground/70",
        children: "Project Name"
      }), /* @__PURE__ */ jsx("input", {
        type: "text",
        value: name,
        onChange: (e) => setName(e.target.value),
        onKeyDown: (e) => e.key === "Enter" && canCreate && handleCreate(),
        placeholder: "my-app",
        className: "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
        autoFocus: true
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "mb-6 flex gap-1 border-b border-border",
      children: [/* @__PURE__ */ jsx("button", {
        onClick: () => setMode("template"),
        className: cn("-mb-px cursor-pointer border-b-2 border-transparent bg-transparent px-4 py-2.5 text-sm font-medium transition-colors", mode === "template" ? "border-foreground text-foreground" : "text-muted-foreground hover:text-foreground"),
        children: "Start from Template"
      }), /* @__PURE__ */ jsx("button", {
        onClick: () => setMode("import"),
        className: cn("-mb-px cursor-pointer border-b-2 border-transparent bg-transparent px-4 py-2.5 text-sm font-medium transition-colors", mode === "import" ? "border-foreground text-foreground" : "text-muted-foreground hover:text-foreground"),
        children: "Import Existing"
      })]
    }), mode === "template" && /* @__PURE__ */ jsxs("div", {
      className: "mb-8",
      children: [/* @__PURE__ */ jsx("p", {
        className: "mb-4 text-[0.8125rem] text-muted-foreground",
        children: "Start with a pre-configured template. More coming soon."
      }), /* @__PURE__ */ jsx("div", {
        className: "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3",
        children: TEMPLATES.map((t) => /* @__PURE__ */ jsxs("button", {
          onClick: () => setSelectedTemplate(t.id),
          className: cn("cursor-pointer rounded-lg border-2 bg-card p-5 text-left transition-colors", selectedTemplate === t.id ? "border-foreground" : "border-border hover:border-foreground/30"),
          children: [/* @__PURE__ */ jsxs("div", {
            className: "mb-2 flex items-center gap-2",
            children: [/* @__PURE__ */ jsx(ReactRouterIcon, {}), /* @__PURE__ */ jsx("span", {
              className: "text-[0.9375rem] font-semibold",
              children: t.name
            }), selectedTemplate === t.id && /* @__PURE__ */ jsx("span", {
              className: "ml-auto text-sm font-bold text-foreground",
              children: "✓"
            })]
          }), /* @__PURE__ */ jsx("p", {
            className: "text-[0.8125rem] leading-relaxed text-muted-foreground",
            children: t.description
          })]
        }, t.id))
      })]
    }), mode === "import" && /* @__PURE__ */ jsxs("div", {
      className: "mb-8",
      children: [/* @__PURE__ */ jsx("p", {
        className: "mb-4 text-[0.8125rem] text-muted-foreground",
        children: "Import an existing project from Vercel."
      }), vercelLoading && /* @__PURE__ */ jsx("p", {
        className: "py-4 text-sm text-muted-foreground",
        children: "Loading Vercel projects..."
      }), vercelError === "not_connected" && /* @__PURE__ */ jsxs("div", {
        className: "rounded-lg border border-border p-6 text-center",
        children: [/* @__PURE__ */ jsx("p", {
          className: "mb-3 text-sm text-muted-foreground",
          children: "Connect your Vercel account to import projects."
        }), /* @__PURE__ */ jsx(Link, {
          to: "/settings",
          className: "inline-flex items-center rounded-md border border-input px-4 py-2 text-[0.8125rem] font-medium text-foreground/70 no-underline transition-colors hover:bg-accent",
          children: "Go to Settings"
        })]
      }), vercelError === "failed" && /* @__PURE__ */ jsx("p", {
        className: "py-4 text-sm text-destructive",
        children: "Failed to load Vercel projects."
      }), !vercelLoading && !vercelError && vercelProjects.length === 0 && /* @__PURE__ */ jsx("p", {
        className: "py-4 text-sm text-muted-foreground",
        children: "No Vercel projects found."
      }), !vercelLoading && !vercelError && vercelProjects.length > 0 && /* @__PURE__ */ jsx("div", {
        className: "max-h-[360px] overflow-auto",
        children: vercelProjects.map((vp) => /* @__PURE__ */ jsx("button", {
          onClick: () => selectVercelProject(vp),
          className: cn("mb-2 block w-full cursor-pointer rounded-md border-2 bg-transparent p-3 text-left transition-colors", selectedVercel?.id === vp.id ? "border-foreground" : "border-border hover:border-foreground/30"),
          children: /* @__PURE__ */ jsxs("div", {
            className: "flex items-center justify-between",
            children: [/* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("p", {
                className: "text-sm font-medium",
                children: vp.name
              }), /* @__PURE__ */ jsxs("p", {
                className: "text-xs text-muted-foreground",
                children: [vp.framework ?? "No framework", vp.link ? ` · ${vp.link.org}/${vp.link.repo}` : ""]
              })]
            }), selectedVercel?.id === vp.id && /* @__PURE__ */ jsx("span", {
              className: "ml-auto text-sm font-bold text-foreground",
              children: "✓"
            })]
          })
        }, vp.id))
      })]
    }), error && /* @__PURE__ */ jsx("p", {
      className: "mb-4 text-[0.8125rem] text-destructive",
      children: error
    }), /* @__PURE__ */ jsx("button", {
      onClick: handleCreate,
      disabled: !canCreate || creating,
      className: cn("w-full cursor-pointer rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:bg-primary/90", (!canCreate || creating) && "cursor-not-allowed opacity-50"),
      children: creating ? "Creating..." : mode === "template" ? "Create Project" : "Import Project"
    })]
  });
});
function ReactRouterIcon() {
  return /* @__PURE__ */ jsxs("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    className: "shrink-0",
    children: [/* @__PURE__ */ jsx("circle", {
      cx: "6",
      cy: "18",
      r: "3",
      fill: "currentColor"
    }), /* @__PURE__ */ jsx("circle", {
      cx: "18",
      cy: "18",
      r: "3",
      fill: "currentColor"
    }), /* @__PURE__ */ jsx("circle", {
      cx: "12",
      cy: "6",
      r: "3",
      fill: "currentColor"
    }), /* @__PURE__ */ jsx("path", {
      d: "M12 9v3M9 16.5L7.5 15M15 16.5l1.5-1.5",
      stroke: "currentColor",
      strokeWidth: "1.5"
    })]
  });
}
const route7 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: _auth_projects_new
}, Symbol.toStringTag, { value: "Module" }));
const _auth_settings = UNSAFE_withComponentProps(function Settings() {
  const parentData = useRouteLoaderData("routes/_auth");
  const {
    user,
    integrations
  } = parentData;
  const [searchParams, setSearchParams] = useSearchParams();
  const [githubConnected, setGithubConnected] = useState(integrations.github);
  const [vercelConnected, setVercelConnected] = useState(integrations.vercel);
  useEffect(() => {
    if (searchParams.has("connected") || searchParams.has("error")) {
      setSearchParams({}, {
        replace: true
      });
    }
  }, [searchParams, setSearchParams]);
  const disconnectGithub = async () => {
    await fetch("/api/integrations/github", {
      method: "DELETE",
      credentials: "include"
    });
    setGithubConnected(false);
  };
  const disconnectVercel = async () => {
    await fetch("/api/integrations/vercel", {
      method: "DELETE",
      credentials: "include"
    });
    setVercelConnected(false);
  };
  return /* @__PURE__ */ jsxs("div", {
    children: [/* @__PURE__ */ jsx("h1", {
      className: "mb-2 text-3xl font-semibold",
      children: "Settings"
    }), /* @__PURE__ */ jsx("p", {
      className: "mb-8 text-[0.9375rem] text-muted-foreground",
      children: "Manage your account and preferences"
    }), /* @__PURE__ */ jsxs("div", {
      className: "mb-8",
      children: [/* @__PURE__ */ jsx("h2", {
        className: "mb-4 text-lg font-semibold",
        children: "Profile"
      }), /* @__PURE__ */ jsxs("div", {
        className: "rounded-lg border border-border bg-card p-6",
        children: [/* @__PURE__ */ jsxs("div", {
          className: "mb-5",
          children: [/* @__PURE__ */ jsx("label", {
            className: "mb-2 block text-sm font-medium text-foreground/70",
            children: "Name"
          }), /* @__PURE__ */ jsx("input", {
            type: "text",
            defaultValue: user.name ?? "",
            placeholder: "Your name",
            className: "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          })]
        }), /* @__PURE__ */ jsxs("div", {
          className: "mb-5",
          children: [/* @__PURE__ */ jsx("label", {
            className: "mb-2 block text-sm font-medium text-foreground/70",
            children: "Email"
          }), /* @__PURE__ */ jsx("input", {
            type: "email",
            defaultValue: user.email,
            placeholder: "your@email.com",
            className: "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          })]
        }), /* @__PURE__ */ jsx("button", {
          className: "cursor-pointer rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:bg-primary/90",
          children: "Save Changes"
        })]
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "mb-8",
      children: [/* @__PURE__ */ jsx("h2", {
        className: "mb-4 text-lg font-semibold",
        children: "Integrations"
      }), /* @__PURE__ */ jsx("div", {
        className: "mb-4 rounded-lg border border-border bg-card p-6",
        children: /* @__PURE__ */ jsxs("div", {
          className: "flex items-center justify-between",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "flex items-center gap-3",
            children: [/* @__PURE__ */ jsx(GitHubIcon, {}), /* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("p", {
                className: "text-[0.9375rem] font-medium",
                children: "GitHub"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-[0.8125rem] text-muted-foreground",
                children: "Access repositories and save sandbox changes"
              })]
            })]
          }), githubConnected ? /* @__PURE__ */ jsxs("div", {
            className: "flex items-center gap-3",
            children: [/* @__PURE__ */ jsx("span", {
              className: "inline-block rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300",
              children: "Connected"
            }), /* @__PURE__ */ jsx("button", {
              onClick: disconnectGithub,
              className: "cursor-pointer rounded-md border border-input bg-transparent px-4 py-2 text-sm font-medium text-foreground/70 transition-colors hover:border-foreground/20 hover:bg-accent",
              children: "Disconnect"
            })]
          }) : /* @__PURE__ */ jsx("a", {
            href: "/api/integrations/github/start?return_to=/settings",
            className: "inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground no-underline transition-opacity hover:bg-primary/90",
            children: "Connect"
          })]
        })
      }), /* @__PURE__ */ jsx("div", {
        className: "rounded-lg border border-border bg-card p-6",
        children: /* @__PURE__ */ jsxs("div", {
          className: "flex items-center justify-between",
          children: [/* @__PURE__ */ jsxs("div", {
            className: "flex items-center gap-3",
            children: [/* @__PURE__ */ jsx(VercelIcon, {}), /* @__PURE__ */ jsxs("div", {
              children: [/* @__PURE__ */ jsx("p", {
                className: "text-[0.9375rem] font-medium",
                children: "Vercel"
              }), /* @__PURE__ */ jsx("p", {
                className: "text-[0.8125rem] text-muted-foreground",
                children: "Deploy projects and manage environments"
              })]
            })]
          }), vercelConnected ? /* @__PURE__ */ jsxs("div", {
            className: "flex items-center gap-3",
            children: [/* @__PURE__ */ jsx("span", {
              className: "inline-block rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300",
              children: "Connected"
            }), /* @__PURE__ */ jsx("button", {
              onClick: disconnectVercel,
              className: "cursor-pointer rounded-md border border-input bg-transparent px-4 py-2 text-sm font-medium text-foreground/70 transition-colors hover:border-foreground/20 hover:bg-accent",
              children: "Disconnect"
            })]
          }) : /* @__PURE__ */ jsx("a", {
            href: "/api/integrations/vercel/start?return_to=/settings",
            className: "inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground no-underline transition-opacity hover:bg-primary/90",
            children: "Connect"
          })]
        })
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "mb-8",
      children: [/* @__PURE__ */ jsx("h2", {
        className: "mb-4 text-lg font-semibold",
        children: "API Keys"
      }), /* @__PURE__ */ jsxs("div", {
        className: "rounded-lg border border-border bg-card p-6",
        children: [/* @__PURE__ */ jsx("p", {
          className: "mb-4 text-sm text-muted-foreground",
          children: "Manage your API keys for authentication"
        }), /* @__PURE__ */ jsx("button", {
          className: "cursor-pointer rounded-md border border-input bg-transparent px-4 py-2 text-sm font-medium text-foreground/70 transition-colors hover:border-foreground/20 hover:bg-accent",
          children: "Generate New Key"
        })]
      })]
    }), /* @__PURE__ */ jsxs("div", {
      className: "mb-8",
      children: [/* @__PURE__ */ jsx("h2", {
        className: "mb-4 text-lg font-semibold",
        children: "Danger Zone"
      }), /* @__PURE__ */ jsxs("div", {
        className: "flex items-center justify-between rounded-lg border border-destructive bg-destructive/5 p-6",
        children: [/* @__PURE__ */ jsxs("div", {
          children: [/* @__PURE__ */ jsx("h3", {
            className: "mb-1 text-[0.9375rem] font-semibold text-destructive",
            children: "Delete Account"
          }), /* @__PURE__ */ jsx("p", {
            className: "text-[0.8125rem] text-destructive/80",
            children: "Permanently delete your account and all associated data"
          })]
        }), /* @__PURE__ */ jsx("button", {
          className: "cursor-pointer rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-opacity hover:bg-destructive/90",
          children: "Delete Account"
        })]
      })]
    })]
  });
});
function GitHubIcon() {
  return /* @__PURE__ */ jsx("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 16 16",
    fill: "currentColor",
    children: /* @__PURE__ */ jsx("path", {
      d: "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"
    })
  });
}
function VercelIcon() {
  return /* @__PURE__ */ jsx("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 76 65",
    fill: "currentColor",
    children: /* @__PURE__ */ jsx("path", {
      d: "M37.5274 0L75.0548 65H0L37.5274 0Z"
    })
  });
}
const route8 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: _auth_settings
}, Symbol.toStringTag, { value: "Module" }));
async function loader$c({
  params,
  request
}) {
  const provider = params.provider;
  if (!isValidProvider(provider)) {
    return Response.json({
      error: `Unknown provider: ${provider}`
    }, {
      status: 400
    });
  }
  const {
    url,
    state,
    codeVerifier
  } = createAuthUrl(provider);
  const isProd = process.env.NODE_ENV === "production";
  const headers = new Headers();
  headers.append("Set-Cookie", serializeCookie("oauth-state", state, {
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: "Lax",
    maxAge: 600
  }));
  if (codeVerifier) {
    headers.append("Set-Cookie", serializeCookie("oauth-verifier", codeVerifier, {
      path: "/",
      httpOnly: true,
      secure: isProd,
      sameSite: "Lax",
      maxAge: 600
    }));
  }
  const reqUrl = new URL(request.url);
  const returnTo = reqUrl.searchParams.get("returnTo");
  if (returnTo) {
    headers.append("Set-Cookie", serializeCookie("auth-return-to", returnTo, {
      path: "/",
      httpOnly: true,
      secure: isProd,
      sameSite: "Lax",
      maxAge: 600
    }));
  }
  return redirect(url.toString(), {
    headers
  });
}
const route9 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$c
}, Symbol.toStringTag, { value: "Module" }));
const SESSION_COOKIE$2 = "viagen-session";
async function loader$b({
  params,
  request
}) {
  const provider = params.provider;
  if (!isValidProvider(provider)) {
    return Response.json({
      error: `Unknown provider: ${provider}`
    }, {
      status: 400
    });
  }
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieHeader = request.headers.get("Cookie");
  const storedState = parseCookie(cookieHeader, "oauth-state");
  const codeVerifier = parseCookie(cookieHeader, "oauth-verifier");
  const cleanupHeaders = new Headers();
  cleanupHeaders.append("Set-Cookie", deleteCookieHeader("oauth-state"));
  cleanupHeaders.append("Set-Cookie", deleteCookieHeader("oauth-verifier"));
  if (!code || !state || state !== storedState) {
    return Response.json({
      error: "Invalid OAuth callback"
    }, {
      status: 400
    });
  }
  const tokens = await exchangeCode(provider, code, codeVerifier);
  const connectOrgId = parseCookie(cookieHeader, "github-connect-org");
  if (connectOrgId && provider === "github") {
    const returnTo2 = parseCookie(cookieHeader, "connect-return-to") ?? "/onboarding";
    cleanupHeaders.append("Set-Cookie", deleteCookieHeader("github-connect-org"));
    cleanupHeaders.append("Set-Cookie", deleteCookieHeader("connect-return-to"));
    const sessionToken = parseCookie(cookieHeader, SESSION_COOKIE$2);
    if (sessionToken) {
      const result = await validateSession(sessionToken);
      if (result) {
        const [membership] = await db.select().from(orgMembers).where(and(eq(orgMembers.userId, result.user.id), eq(orgMembers.organizationId, connectOrgId)));
        if (membership) {
          await setSecret(connectOrgId, "GITHUB_ACCESS_TOKEN", tokens.accessToken());
          return redirect(`${returnTo2}?connected=github`, {
            headers: cleanupHeaders
          });
        }
      }
    }
    return redirect(`${returnTo2}?error=github`, {
      headers: cleanupHeaders
    });
  }
  const providerUser = await fetchProviderUser(provider, tokens.accessToken());
  const user = await upsertUser(provider, providerUser);
  const {
    token,
    expiresAt
  } = await createSession(user.id);
  const isProd = process.env.NODE_ENV === "production";
  cleanupHeaders.append("Set-Cookie", serializeCookie(SESSION_COOKIE$2, token, {
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: "Lax",
    expires: expiresAt
  }));
  const returnTo = parseCookie(cookieHeader, "auth-return-to");
  if (returnTo) {
    cleanupHeaders.append("Set-Cookie", deleteCookieHeader("auth-return-to"));
    return redirect(returnTo, {
      headers: cleanupHeaders
    });
  }
  return redirect("/", {
    headers: cleanupHeaders
  });
}
const route10 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$b
}, Symbol.toStringTag, { value: "Module" }));
const SESSION_COOKIE$1 = "viagen-session";
async function loader$a({
  request
}) {
  const session = await getSessionUser(request);
  if (!session) {
    const token = parseCookie(request.headers.get("Cookie"), SESSION_COOKIE$1);
    if (token) {
      return Response.json({
        authenticated: false
      }, {
        status: 401,
        headers: {
          "Set-Cookie": deleteCookieHeader(SESSION_COOKIE$1)
        }
      });
    }
    return Response.json({
      authenticated: false
    }, {
      status: 401
    });
  }
  return Response.json({
    authenticated: true,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      avatarUrl: session.user.avatarUrl
    },
    organizations: session.memberships.map((m) => ({
      id: m.organizationId,
      name: m.organizationName,
      role: m.role
    }))
  });
}
const route11 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$a
}, Symbol.toStringTag, { value: "Module" }));
const SESSION_COOKIE = "viagen-session";
async function action$7({
  request
}) {
  const token = parseCookie(request.headers.get("Cookie"), SESSION_COOKIE);
  if (token) {
    await deleteSession(token);
  }
  return Response.json({
    success: true
  }, {
    headers: {
      "Set-Cookie": deleteCookieHeader(SESSION_COOKIE)
    }
  });
}
const route12 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$7
}, Symbol.toStringTag, { value: "Module" }));
async function loader$9({
  request
}) {
  const {
    user
  } = await requireUser(request);
  const tokens = await listApiTokens(user.id);
  return Response.json({
    tokens: tokens.map((t) => ({
      id: t.id,
      name: t.name,
      prefix: t.tokenPrefix,
      expiresAt: t.expiresAt,
      lastUsedAt: t.lastUsedAt,
      createdAt: t.createdAt
    }))
  });
}
async function action$6({
  request
}) {
  if (request.method !== "DELETE") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  const {
    user
  } = await requireUser(request);
  const {
    tokenId
  } = await request.json();
  if (!tokenId) {
    return Response.json({
      error: "tokenId required"
    }, {
      status: 400
    });
  }
  await revokeApiToken(tokenId, user.id);
  return Response.json({
    success: true
  });
}
const route13 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$6,
  loader: loader$9
}, Symbol.toStringTag, { value: "Module" }));
async function loader$8({
  request
}) {
  const session = await requireUser(request);
  return Response.json({
    organizations: session.memberships.map((m) => ({
      id: m.organizationId,
      name: m.organizationName,
      role: m.role
    }))
  });
}
async function action$5({
  request
}) {
  if (request.method !== "POST") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  const session = await requireUser(request);
  const body = await request.json();
  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    return Response.json({
      error: "Organization name is required"
    }, {
      status: 400
    });
  }
  const [org] = await db.insert(organizations).values({
    name: body.name.trim()
  }).returning();
  await db.insert(orgMembers).values({
    userId: session.user.id,
    organizationId: org.id,
    role: "admin"
  });
  return Response.json({
    organization: {
      id: org.id,
      name: org.name
    }
  }, {
    status: 201
  });
}
const route14 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$5,
  loader: loader$8
}, Symbol.toStringTag, { value: "Module" }));
async function action$4({
  request
}) {
  if (request.method !== "POST") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  const {
    role,
    org
  } = await requireAuth(request);
  if (role !== "admin") {
    return Response.json({
      error: "Admin role required"
    }, {
      status: 403
    });
  }
  const body = await request.json();
  if (!body.email || typeof body.email !== "string") {
    return Response.json({
      error: "Email is required"
    }, {
      status: 400
    });
  }
  const [targetUser] = await db.select().from(users).where(eq(users.email, body.email.trim()));
  if (!targetUser) {
    return Response.json({
      error: "User not found. They must log in at least once first."
    }, {
      status: 404
    });
  }
  const [existing] = await db.select().from(orgMembers).where(and(eq(orgMembers.userId, targetUser.id), eq(orgMembers.organizationId, org.id)));
  if (existing) {
    return Response.json({
      error: "User is already a member of this organization"
    }, {
      status: 409
    });
  }
  await db.insert(orgMembers).values({
    userId: targetUser.id,
    organizationId: org.id,
    role: body.role === "admin" ? "admin" : "member"
  });
  return Response.json({
    success: true
  }, {
    status: 201
  });
}
const route15 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$4
}, Symbol.toStringTag, { value: "Module" }));
async function loader$7({
  request
}) {
  const {
    org
  } = await requireAuth(request);
  const result = await db.select().from(projects).where(eq(projects.organizationId, org.id)).orderBy(projects.createdAt);
  return Response.json({
    projects: result
  });
}
async function action$3({
  request
}) {
  if (request.method !== "POST") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  const {
    role,
    org
  } = await requireAuth(request);
  if (role !== "admin") {
    return Response.json({
      error: "Admin role required to create projects"
    }, {
      status: 403
    });
  }
  const body = await request.json();
  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    return Response.json({
      error: "Project name is required"
    }, {
      status: 400
    });
  }
  const [project] = await db.insert(projects).values({
    organizationId: org.id,
    name: body.name.trim(),
    vercelProjectId: body.vercelProjectId ?? null,
    githubRepo: body.githubRepo ?? null,
    templateId: body.templateId ?? null
  }).returning();
  return Response.json({
    project
  }, {
    status: 201
  });
}
const route16 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$3,
  loader: loader$7
}, Symbol.toStringTag, { value: "Module" }));
async function loader$6({
  request,
  params
}) {
  const {
    org
  } = await requireAuth(request);
  const id = params.id;
  const [project] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.organizationId, org.id)));
  if (!project) {
    return Response.json({
      error: "Project not found"
    }, {
      status: 404
    });
  }
  return Response.json({
    project
  });
}
async function action$2({
  request,
  params
}) {
  const {
    role,
    org
  } = await requireAuth(request);
  const id = params.id;
  if (request.method === "PATCH") {
    if (role !== "admin") {
      return Response.json({
        error: "Admin role required to update projects"
      }, {
        status: 403
      });
    }
    const body = await request.json();
    const updates = {};
    if ("name" in body) updates.name = body.name;
    if ("vercelProjectId" in body) updates.vercelProjectId = body.vercelProjectId ?? null;
    if ("githubRepo" in body) updates.githubRepo = body.githubRepo ?? null;
    if (Object.keys(updates).length === 0) {
      return Response.json({
        error: "No updates provided"
      }, {
        status: 400
      });
    }
    const [project] = await db.update(projects).set(updates).where(and(eq(projects.id, id), eq(projects.organizationId, org.id))).returning();
    if (!project) {
      return Response.json({
        error: "Project not found"
      }, {
        status: 404
      });
    }
    return Response.json({
      project
    });
  }
  if (request.method === "DELETE") {
    if (role !== "admin") {
      return Response.json({
        error: "Admin role required to delete projects"
      }, {
        status: 403
      });
    }
    const [deleted] = await db.delete(projects).where(and(eq(projects.id, id), eq(projects.organizationId, org.id))).returning();
    if (!deleted) {
      return Response.json({
        error: "Project not found"
      }, {
        status: 404
      });
    }
    return Response.json({
      success: true
    });
  }
  return Response.json({
    error: "Method not allowed"
  }, {
    status: 405
  });
}
const route17 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$2,
  loader: loader$6
}, Symbol.toStringTag, { value: "Module" }));
const VERCEL_API = "https://api.vercel.com";
class VercelApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "VercelApiError";
  }
}
async function listVercelProjects(token, params) {
  const url = new URL(`${VERCEL_API}/v10/projects`);
  if (params?.teamId) url.searchParams.set("teamId", params.teamId);
  if (params?.search) url.searchParams.set("search", params.search);
  url.searchParams.set("limit", String(params.limit));
  if (params?.from) url.searchParams.set("from", params.from);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new VercelApiError(res.status, body.error?.message ?? "Vercel API error");
  }
  return res.json();
}
async function loader$5({
  request
}) {
  const {
    org
  } = await requireAuth(request);
  const token = await getSecret(org.id, "VERCEL_ACCESS_TOKEN").catch(() => null);
  if (!token) {
    return Response.json({
      error: "Vercel not connected"
    }, {
      status: 400
    });
  }
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit")) || 20;
  const search = url.searchParams.get("search") ?? void 0;
  const data = await listVercelProjects(token, {
    limit,
    search
  });
  return Response.json({
    projects: data.projects
  });
}
const route18 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$5
}, Symbol.toStringTag, { value: "Module" }));
const GITHUB_TOKEN_KEY$2 = "GITHUB_ACCESS_TOKEN";
async function loader$4({
  request
}) {
  const {
    org
  } = await requireAuth(request);
  const token = await getSecret(org.id, GITHUB_TOKEN_KEY$2);
  if (!token) {
    return Response.json({
      error: "GitHub access token not configured"
    }, {
      status: 400
    });
  }
  const url = new URL(request.url);
  const page = url.searchParams.get("page") ?? "1";
  const perPage = url.searchParams.get("per_page") ?? "30";
  const ghUrl = new URL("https://api.github.com/user/repos");
  ghUrl.searchParams.set("sort", "updated");
  ghUrl.searchParams.set("direction", "desc");
  ghUrl.searchParams.set("per_page", perPage);
  ghUrl.searchParams.set("page", page);
  const res = await fetch(ghUrl.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "viagen-sdk"
    }
  });
  if (!res.ok) {
    if (res.status === 401) {
      return Response.json({
        error: "GitHub token is invalid or expired"
      }, {
        status: 401
      });
    }
    return Response.json({
      error: "Failed to fetch GitHub repos"
    }, {
      status: 502
    });
  }
  const repos = await res.json();
  return Response.json({
    repos: repos.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      name: r.name,
      owner: r.owner.login,
      private: r.private,
      defaultBranch: r.default_branch,
      url: r.html_url
    }))
  });
}
const route19 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$4
}, Symbol.toStringTag, { value: "Module" }));
async function loader$3({
  request
}) {
  const {
    org
  } = await requireAuth(request);
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("return_to") ?? "/onboarding";
  const state = generateState();
  const isProd = process.env.NODE_ENV === "production";
  const headers = new Headers();
  headers.append("Set-Cookie", serializeCookie("github-connect-org", org.id, {
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: "Lax",
    maxAge: 600
  }));
  headers.append("Set-Cookie", serializeCookie("connect-return-to", returnTo, {
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: "Lax",
    maxAge: 600
  }));
  headers.append("Set-Cookie", serializeCookie("oauth-state", state, {
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: "Lax",
    maxAge: 600
  }));
  const authUrl = providers.github.createAuthorizationURL(state, ["user:email", "repo", "read:org"]);
  return redirect(authUrl.toString(), {
    headers
  });
}
const route20 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$3
}, Symbol.toStringTag, { value: "Module" }));
const GITHUB_TOKEN_KEY$1 = "GITHUB_ACCESS_TOKEN";
async function action$1({
  request
}) {
  if (request.method !== "DELETE") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  const {
    role,
    org
  } = await requireAuth(request);
  if (role !== "admin") {
    return Response.json({
      error: "Admin role required"
    }, {
      status: 403
    });
  }
  await deleteSecret(org.id, GITHUB_TOKEN_KEY$1);
  return Response.json({
    success: true
  });
}
const route21 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$1
}, Symbol.toStringTag, { value: "Module" }));
async function loader$2({
  request
}) {
  const clientId = process.env.VERCEL_INTEGRATION_CLIENT_ID;
  if (!clientId) {
    return Response.json({
      error: "Vercel integration not configured"
    }, {
      status: 500
    });
  }
  const {
    org
  } = await requireAuth(request);
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("return_to") ?? "/onboarding";
  const state = generateState();
  const isProd = process.env.NODE_ENV === "production";
  const headers = new Headers();
  headers.append("Set-Cookie", serializeCookie("vercel-connect-return-to", returnTo, {
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: "Lax",
    maxAge: 600
  }));
  headers.append("Set-Cookie", serializeCookie("vercel-connect-org", org.id, {
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: "Lax",
    maxAge: 600
  }));
  headers.append("Set-Cookie", serializeCookie("vercel-oauth-state", state, {
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: "Lax",
    maxAge: 600
  }));
  const slug = process.env.VERCEL_INTEGRATION_SLUG ?? "viagen-sdk";
  const vercelUrl = new URL(`https://vercel.com/integrations/${slug}/new`);
  vercelUrl.searchParams.set("state", state);
  return redirect(vercelUrl.toString(), {
    headers
  });
}
const route22 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$2
}, Symbol.toStringTag, { value: "Module" }));
const VERCEL_TOKEN_KEY$2 = "VERCEL_ACCESS_TOKEN";
const redirectBase = process.env.AUTH_REDIRECT_BASE ?? "http://localhost:5173";
async function loader$1({
  request
}) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieHeader = request.headers.get("Cookie");
  const storedState = parseCookie(cookieHeader, "vercel-oauth-state");
  const connectOrgId = parseCookie(cookieHeader, "vercel-connect-org");
  const returnTo = parseCookie(cookieHeader, "vercel-connect-return-to") ?? "/onboarding";
  const headers = new Headers();
  headers.append("Set-Cookie", deleteCookieHeader("vercel-oauth-state"));
  headers.append("Set-Cookie", deleteCookieHeader("vercel-connect-org"));
  headers.append("Set-Cookie", deleteCookieHeader("vercel-connect-return-to"));
  if (!code || !state || state !== storedState || !connectOrgId) {
    return redirect(`${returnTo}?error=vercel`, {
      headers
    });
  }
  try {
    const callbackUrl = `${redirectBase}/api/integrations/vercel/callback`;
    const res = await fetch("https://api.vercel.com/v2/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: process.env.VERCEL_INTEGRATION_CLIENT_ID,
        client_secret: process.env.VERCEL_INTEGRATION_CLIENT_SECRET,
        code,
        redirect_uri: callbackUrl
      })
    });
    if (!res.ok) {
      return redirect(`${returnTo}?error=vercel`, {
        headers
      });
    }
    const data = await res.json();
    await setSecret(connectOrgId, VERCEL_TOKEN_KEY$2, data.access_token);
    return redirect(`${returnTo}?connected=vercel`, {
      headers
    });
  } catch {
    return redirect(`${returnTo}?error=vercel`, {
      headers
    });
  }
}
const route23 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$1
}, Symbol.toStringTag, { value: "Module" }));
const VERCEL_TOKEN_KEY$1 = "VERCEL_ACCESS_TOKEN";
async function action({
  request
}) {
  if (request.method !== "DELETE") {
    return Response.json({
      error: "Method not allowed"
    }, {
      status: 405
    });
  }
  const {
    role,
    org
  } = await requireAuth(request);
  if (role !== "admin") {
    return Response.json({
      error: "Admin role required"
    }, {
      status: 403
    });
  }
  await deleteSecret(org.id, VERCEL_TOKEN_KEY$1);
  return Response.json({
    success: true
  });
}
const route24 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action
}, Symbol.toStringTag, { value: "Module" }));
const GITHUB_TOKEN_KEY = "GITHUB_ACCESS_TOKEN";
const VERCEL_TOKEN_KEY = "VERCEL_ACCESS_TOKEN";
async function loader({
  request
}) {
  const {
    org
  } = await requireAuth(request);
  const safeGet = async (key) => {
    try {
      const val = await getSecret(org.id, key);
      return !!val;
    } catch {
      return false;
    }
  };
  const [github, vercel] = await Promise.all([safeGet(GITHUB_TOKEN_KEY), safeGet(VERCEL_TOKEN_KEY)]);
  return Response.json({
    github,
    vercel
  });
}
const route25 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-79l2AIFJ.js", "imports": ["/assets/chunk-JZWAC4HX-IldEFHxZ.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": true, "module": "/assets/root-CiiWXgz1.js", "imports": ["/assets/chunk-JZWAC4HX-IldEFHxZ.js"], "css": ["/assets/root-VZWhyRbM.css"], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/login": { "id": "routes/login", "parentId": "root", "path": "login", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/login-BuAc4L4u.js", "imports": ["/assets/chunk-JZWAC4HX-IldEFHxZ.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/onboarding": { "id": "routes/onboarding", "parentId": "root", "path": "onboarding", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/onboarding-BWcv9LVj.js", "imports": ["/assets/chunk-JZWAC4HX-IldEFHxZ.js", "/assets/utils-C8nBGPD0.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/cli.authorize": { "id": "routes/cli.authorize", "parentId": "root", "path": "cli/authorize", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/cli.authorize-DC5OyfPh.js", "imports": ["/assets/chunk-JZWAC4HX-IldEFHxZ.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/_auth": { "id": "routes/_auth", "parentId": "root", "path": void 0, "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/_auth-CeTGMNiK.js", "imports": ["/assets/chunk-JZWAC4HX-IldEFHxZ.js", "/assets/utils-C8nBGPD0.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/_auth.dashboard": { "id": "routes/_auth.dashboard", "parentId": "routes/_auth", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/_auth.dashboard-Cw38BLb6.js", "imports": ["/assets/chunk-JZWAC4HX-IldEFHxZ.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/_auth.projects": { "id": "routes/_auth.projects", "parentId": "routes/_auth", "path": "projects", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/_auth.projects-B-zdRFQt.js", "imports": ["/assets/chunk-JZWAC4HX-IldEFHxZ.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/_auth.projects.new": { "id": "routes/_auth.projects.new", "parentId": "routes/_auth", "path": "projects/new", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/_auth.projects.new-DTcMIVgd.js", "imports": ["/assets/chunk-JZWAC4HX-IldEFHxZ.js", "/assets/utils-C8nBGPD0.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/_auth.settings": { "id": "routes/_auth.settings", "parentId": "routes/_auth", "path": "settings", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/_auth.settings-D1sJU66G.js", "imports": ["/assets/chunk-JZWAC4HX-IldEFHxZ.js"], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.auth.login.$provider": { "id": "routes/api.auth.login.$provider", "parentId": "root", "path": "api/auth/login/:provider", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.auth.login._provider-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.auth.callback.$provider": { "id": "routes/api.auth.callback.$provider", "parentId": "root", "path": "api/auth/callback/:provider", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.auth.callback._provider-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.auth.me": { "id": "routes/api.auth.me", "parentId": "root", "path": "api/auth/me", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.auth.me-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.auth.logout": { "id": "routes/api.auth.logout", "parentId": "root", "path": "api/auth/logout", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.auth.logout-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.auth.tokens": { "id": "routes/api.auth.tokens", "parentId": "root", "path": "api/auth/tokens", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.auth.tokens-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.orgs": { "id": "routes/api.orgs", "parentId": "root", "path": "api/orgs", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.orgs-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.orgs.members": { "id": "routes/api.orgs.members", "parentId": "root", "path": "api/orgs/members", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.orgs.members-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.projects": { "id": "routes/api.projects", "parentId": "root", "path": "api/projects", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.projects-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.projects.$id": { "id": "routes/api.projects.$id", "parentId": "root", "path": "api/projects/:id", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.projects._id-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.vercel.projects": { "id": "routes/api.vercel.projects", "parentId": "root", "path": "api/vercel/projects", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.vercel.projects-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.github.repos": { "id": "routes/api.github.repos", "parentId": "root", "path": "api/github/repos", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.github.repos-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.integrations.github.start": { "id": "routes/api.integrations.github.start", "parentId": "root", "path": "api/integrations/github/start", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.integrations.github.start-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.integrations.github": { "id": "routes/api.integrations.github", "parentId": "root", "path": "api/integrations/github", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.integrations.github-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.integrations.vercel.start": { "id": "routes/api.integrations.vercel.start", "parentId": "root", "path": "api/integrations/vercel/start", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.integrations.vercel.start-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.integrations.vercel.callback": { "id": "routes/api.integrations.vercel.callback", "parentId": "root", "path": "api/integrations/vercel/callback", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.integrations.vercel.callback-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.integrations.vercel": { "id": "routes/api.integrations.vercel", "parentId": "root", "path": "api/integrations/vercel", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.integrations.vercel-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 }, "routes/api.integrations.status": { "id": "routes/api.integrations.status", "parentId": "root", "path": "api/integrations/status", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasClientMiddleware": false, "hasErrorBoundary": false, "module": "/assets/api.integrations.status-l0sNRNKZ.js", "imports": [], "css": [], "clientActionModule": void 0, "clientLoaderModule": void 0, "clientMiddlewareModule": void 0, "hydrateFallbackModule": void 0 } }, "url": "/assets/manifest-efc71048.js", "version": "efc71048", "sri": void 0 };
const assetsBuildDirectory = "build/client";
const basename = "/";
const future = { "unstable_optimizeDeps": false, "unstable_subResourceIntegrity": false, "unstable_trailingSlashAwareDataRequests": false, "v8_middleware": false, "v8_splitRouteModules": false, "v8_viteEnvironmentApi": false };
const ssr = true;
const isSpaMode = false;
const prerender = [];
const routeDiscovery = { "mode": "lazy", "manifestPath": "/__manifest" };
const publicPath = "/";
const entry = { module: entryServer };
const routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: route0
  },
  "routes/login": {
    id: "routes/login",
    parentId: "root",
    path: "login",
    index: void 0,
    caseSensitive: void 0,
    module: route1
  },
  "routes/onboarding": {
    id: "routes/onboarding",
    parentId: "root",
    path: "onboarding",
    index: void 0,
    caseSensitive: void 0,
    module: route2
  },
  "routes/cli.authorize": {
    id: "routes/cli.authorize",
    parentId: "root",
    path: "cli/authorize",
    index: void 0,
    caseSensitive: void 0,
    module: route3
  },
  "routes/_auth": {
    id: "routes/_auth",
    parentId: "root",
    path: void 0,
    index: void 0,
    caseSensitive: void 0,
    module: route4
  },
  "routes/_auth.dashboard": {
    id: "routes/_auth.dashboard",
    parentId: "routes/_auth",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route5
  },
  "routes/_auth.projects": {
    id: "routes/_auth.projects",
    parentId: "routes/_auth",
    path: "projects",
    index: void 0,
    caseSensitive: void 0,
    module: route6
  },
  "routes/_auth.projects.new": {
    id: "routes/_auth.projects.new",
    parentId: "routes/_auth",
    path: "projects/new",
    index: void 0,
    caseSensitive: void 0,
    module: route7
  },
  "routes/_auth.settings": {
    id: "routes/_auth.settings",
    parentId: "routes/_auth",
    path: "settings",
    index: void 0,
    caseSensitive: void 0,
    module: route8
  },
  "routes/api.auth.login.$provider": {
    id: "routes/api.auth.login.$provider",
    parentId: "root",
    path: "api/auth/login/:provider",
    index: void 0,
    caseSensitive: void 0,
    module: route9
  },
  "routes/api.auth.callback.$provider": {
    id: "routes/api.auth.callback.$provider",
    parentId: "root",
    path: "api/auth/callback/:provider",
    index: void 0,
    caseSensitive: void 0,
    module: route10
  },
  "routes/api.auth.me": {
    id: "routes/api.auth.me",
    parentId: "root",
    path: "api/auth/me",
    index: void 0,
    caseSensitive: void 0,
    module: route11
  },
  "routes/api.auth.logout": {
    id: "routes/api.auth.logout",
    parentId: "root",
    path: "api/auth/logout",
    index: void 0,
    caseSensitive: void 0,
    module: route12
  },
  "routes/api.auth.tokens": {
    id: "routes/api.auth.tokens",
    parentId: "root",
    path: "api/auth/tokens",
    index: void 0,
    caseSensitive: void 0,
    module: route13
  },
  "routes/api.orgs": {
    id: "routes/api.orgs",
    parentId: "root",
    path: "api/orgs",
    index: void 0,
    caseSensitive: void 0,
    module: route14
  },
  "routes/api.orgs.members": {
    id: "routes/api.orgs.members",
    parentId: "root",
    path: "api/orgs/members",
    index: void 0,
    caseSensitive: void 0,
    module: route15
  },
  "routes/api.projects": {
    id: "routes/api.projects",
    parentId: "root",
    path: "api/projects",
    index: void 0,
    caseSensitive: void 0,
    module: route16
  },
  "routes/api.projects.$id": {
    id: "routes/api.projects.$id",
    parentId: "root",
    path: "api/projects/:id",
    index: void 0,
    caseSensitive: void 0,
    module: route17
  },
  "routes/api.vercel.projects": {
    id: "routes/api.vercel.projects",
    parentId: "root",
    path: "api/vercel/projects",
    index: void 0,
    caseSensitive: void 0,
    module: route18
  },
  "routes/api.github.repos": {
    id: "routes/api.github.repos",
    parentId: "root",
    path: "api/github/repos",
    index: void 0,
    caseSensitive: void 0,
    module: route19
  },
  "routes/api.integrations.github.start": {
    id: "routes/api.integrations.github.start",
    parentId: "root",
    path: "api/integrations/github/start",
    index: void 0,
    caseSensitive: void 0,
    module: route20
  },
  "routes/api.integrations.github": {
    id: "routes/api.integrations.github",
    parentId: "root",
    path: "api/integrations/github",
    index: void 0,
    caseSensitive: void 0,
    module: route21
  },
  "routes/api.integrations.vercel.start": {
    id: "routes/api.integrations.vercel.start",
    parentId: "root",
    path: "api/integrations/vercel/start",
    index: void 0,
    caseSensitive: void 0,
    module: route22
  },
  "routes/api.integrations.vercel.callback": {
    id: "routes/api.integrations.vercel.callback",
    parentId: "root",
    path: "api/integrations/vercel/callback",
    index: void 0,
    caseSensitive: void 0,
    module: route23
  },
  "routes/api.integrations.vercel": {
    id: "routes/api.integrations.vercel",
    parentId: "root",
    path: "api/integrations/vercel",
    index: void 0,
    caseSensitive: void 0,
    module: route24
  },
  "routes/api.integrations.status": {
    id: "routes/api.integrations.status",
    parentId: "root",
    path: "api/integrations/status",
    index: void 0,
    caseSensitive: void 0,
    module: route25
  }
};
const allowedActionOrigins = false;
export {
  allowedActionOrigins,
  serverManifest as assets,
  assetsBuildDirectory,
  basename,
  entry,
  future,
  isSpaMode,
  prerender,
  publicPath,
  routeDiscovery,
  routes,
  ssr
};
