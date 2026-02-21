import { redirect } from "react-router";
import { validateSession, validateApiToken } from "./auth.server";
import { db } from "./db/index.server";
import { orgMembers, organizations } from "./db/schema";
import { eq } from "drizzle-orm";
import type { User } from "./db/schema";

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
  }

  // 2. Fall back to session cookie (web)
  const cookieHeader = request.headers.get("Cookie");
  const sessionToken = parseCookie(cookieHeader, SESSION_COOKIE);

  if (!sessionToken) return null;

  const result = await validateSession(sessionToken);
  if (!result) return null;

  const memberships = await fetchMemberships(result.user.id);
  return { user: result.user, memberships };
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

/** Check if a role has admin-level privileges (admin or owner). */
export function isAdminRole(role: string): boolean {
  return role === "admin" || role === "owner";
}
