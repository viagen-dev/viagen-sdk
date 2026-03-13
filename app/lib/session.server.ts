import { createHash } from "crypto";
import { redirect } from "react-router";
import { validateSession, validateApiToken } from "./auth.server";
import { db } from "./db/index.server";
import { orgMembers, organizations, tasks, projects, users } from "./db/schema";
import { eq } from "drizzle-orm";
import type { User } from "./db/schema";
import { log } from "./logger.server";

const SESSION_COOKIE = "viagen-session";
const ORG_COOKIE = "viagen-org";

/** Parse a specific cookie value from a Cookie header string. */
export function parseCookie(
  cookieHeader: string | null,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

/** Create a Set-Cookie header value. */
export function serializeCookie(
  name: string,
  value: string,
  options?: {
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Lax" | "Strict" | "None";
    maxAge?: number;
    expires?: Date;
  },
): string {
  let cookie = `${name}=${encodeURIComponent(value)}`;
  if (options?.path) cookie += `; Path=${options.path}`;
  if (options?.httpOnly) cookie += "; HttpOnly";
  if (options?.secure) cookie += "; Secure";
  if (options?.sameSite) cookie += `; SameSite=${options.sameSite}`;
  if (options?.maxAge !== undefined) cookie += `; Max-Age=${options.maxAge}`;
  if (options?.expires) cookie += `; Expires=${options.expires.toUTCString()}`;
  return cookie;
}

/** Delete a cookie by setting Max-Age=0. */
export function deleteCookieHeader(name: string, path = "/"): string {
  return `${name}=; Path=${path}; Max-Age=0`;
}

/** Fetch org memberships for a user. */
async function fetchMemberships(userId: string) {
  return db
    .select({
      organizationId: orgMembers.organizationId,
      role: orgMembers.role,
      organizationName: organizations.name,
    })
    .from(orgMembers)
    .innerJoin(organizations, eq(orgMembers.organizationId, organizations.id))
    .where(eq(orgMembers.userId, userId));
}

/** Check if this request comes from an API client (Bearer token or JSON accept). */
function isApiRequest(request: Request): boolean {
  return (
    request.headers.has("Authorization") ||
    request.headers.get("Accept")?.includes("application/json") === true
  );
}

/** Get the session user from cookie or Bearer token. Returns null if not authenticated. */
export async function getSessionUser(
  request: Request,
): Promise<{
  user: User;
  memberships: {
    organizationId: string;
    role: string;
    organizationName: string;
  }[];
} | null> {
  // 1. Try Bearer token (API token from CLI/SDK)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const result = await validateApiToken(token);
    if (result) {
      const memberships = await fetchMemberships(result.user.id);
      return { user: result.user, memberships };
    }

    // 1b. Try as sandbox callback token (hashed against tasks.callbackTokenHash)
    const sandboxResult = await validateSandboxToken(token);
    if (sandboxResult) {
      const memberships = await fetchMemberships(sandboxResult.user.id);
      return { user: sandboxResult.user, memberships };
    }
  }

  // 2. Fall back to session cookie (web)
  const cookieHeader = request.headers.get("Cookie");
  const sessionToken = parseCookie(cookieHeader, SESSION_COOKIE);

  if (sessionToken) {
    const result = await validateSession(sessionToken);
    if (result) {
      const memberships = await fetchMemberships(result.user.id);
      return { user: result.user, memberships };
    }
  }

  // 3. Sandbox env bypass — auto-auth when running inside a Vercel sandbox
  const sandboxEmail = process.env.VIAGEN_AUTH_EMAIL;
  if (sandboxEmail) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, sandboxEmail))
      .limit(1);
    if (user) {
      log.info({ email: sandboxEmail }, "sandbox auth bypass: auto-authenticated via VIAGEN_AUTH_EMAIL");
      const memberships = await fetchMemberships(user.id);
      return { user, memberships };
    }
    log.warn({ email: sandboxEmail }, "sandbox auth bypass: VIAGEN_AUTH_EMAIL set but user not found");
  }

  return null;
}

/** Require an authenticated user. Throws redirect to /login (web) or 401 JSON (API). */
export async function requireUser(request: Request) {
  const session = await getSessionUser(request);
  if (!session) {
    if (isApiRequest(request)) {
      throw Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw redirect("/login");
  }
  return session;
}

/** Require auth + org membership. Returns { user, org: { id, name }, role }. */
export async function requireAuth(request: Request) {
  const session = await requireUser(request);

  if (session.memberships.length === 0) {
    if (isApiRequest(request)) {
      throw Response.json(
        { error: "No organization membership" },
        { status: 403 },
      );
    }
    throw redirect("/onboarding");
  }

  // Resolve org: check cookie first, then X-Organization header, then first membership
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
    memberships: session.memberships,
  };
}

/**
 * Validate a sandbox callback token by hashing it and looking up a task
 * with a matching callbackTokenHash. Returns the task creator's user record.
 * This allows sandbox tokens to authenticate against regular API endpoints.
 */
async function validateSandboxToken(
  token: string,
): Promise<{ user: User } | null> {
  const tokenHash = createHash("sha256").update(token).digest("hex");

  // Find any task with this callback token hash
  const [task] = await db
    .select({ createdBy: tasks.createdBy })
    .from(tasks)
    .where(eq(tasks.callbackTokenHash, tokenHash))
    .limit(1);

  if (!task) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, task.createdBy))
    .limit(1);

  if (!user) return null;

  log.info(
    { userId: user.id },
    "sandbox token auth: authenticated via callbackTokenHash",
  );
  return { user };
}

/** Check if a role has admin-level privileges (admin or owner). */
export function isAdminRole(role: string): boolean {
  return role === "admin" || role === "owner";
}
