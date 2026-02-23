import { requireUser, requireAuth, isAdminRole } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { organizations, orgMembers } from "~/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { log } from "~/lib/logger.server";

export async function loader({ request }: { request: Request }) {
  const session = await requireUser(request);

  return Response.json({
    organizations: session.memberships.map((m) => ({
      id: m.organizationId,
      name: m.organizationName,
      role: m.role,
    })),
  });
}

export async function action({ request }: { request: Request }) {
  const method = request.method;

  if (method === "POST") {
    return handleCreate(request);
  }
  if (method === "PATCH") {
    return handleRename(request);
  }
  if (method === "DELETE") {
    return handleDelete(request);
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}

/** POST — Create a new organization */
async function handleCreate(request: Request) {
  const session = await requireUser(request);
  const body = await request.json();

  if (
    !body.name ||
    typeof body.name !== "string" ||
    body.name.trim().length === 0
  ) {
    return Response.json(
      { error: "Organization name is required" },
      { status: 400 },
    );
  }

  const [org] = await db
    .insert(organizations)
    .values({ name: body.name.trim() })
    .returning();

  await db.insert(orgMembers).values({
    userId: session.user.id,
    organizationId: org.id,
    role: "owner",
  });

  log.info(
    { userId: session.user.id, orgId: org.id, orgName: org.name },
    "organization created",
  );
  return Response.json(
    {
      organization: { id: org.id, name: org.name },
    },
    { status: 201 },
  );
}

/** PATCH — Rename the current organization */
async function handleRename(request: Request) {
  const { role, user, org } = await requireAuth(request);

  if (!isAdminRole(role)) {
    log.warn(
      { userId: user.id, orgId: org.id },
      "org rename denied: not admin/owner",
    );
    return Response.json({ error: "Admin role required" }, { status: 403 });
  }

  const body = await request.json();

  if (
    !body.name ||
    typeof body.name !== "string" ||
    body.name.trim().length === 0
  ) {
    return Response.json(
      { error: "Organization name is required" },
      { status: 400 },
    );
  }

  await db
    .update(organizations)
    .set({ name: body.name.trim() })
    .where(eq(organizations.id, org.id));

  log.info(
    { userId: user.id, orgId: org.id, newName: body.name.trim() },
    "organization renamed",
  );
  return Response.json({ success: true });
}

/** DELETE — Permanently delete the current organization (owner only) */
async function handleDelete(request: Request) {
  const { role, user, org } = await requireAuth(request);

  if (role !== "owner") {
    log.warn(
      { userId: user.id, orgId: org.id, role },
      "org delete denied: not owner",
    );
    return Response.json(
      { error: "Only the owner can delete the organization" },
      { status: 403 },
    );
  }

  // Confirm the org name matches to prevent accidental deletion
  let body: { confirmName?: string } = {};
  try {
    body = await request.json();
  } catch {
    // no body is fine, we'll just skip name confirmation
  }

  if (body.confirmName && body.confirmName !== org.name) {
    log.warn(
      { userId: user.id, orgId: org.id },
      "org delete denied: confirmation name mismatch",
    );
    return Response.json(
      { error: "Organization name does not match" },
      { status: 400 },
    );
  }

  // Delete the organization — all child rows (members, projects, workspaces, databases)
  // are removed automatically via ON DELETE CASCADE
  await db.delete(organizations).where(eq(organizations.id, org.id));

  log.info(
    { userId: user.id, orgId: org.id, orgName: org.name },
    "organization deleted",
  );
  return Response.json({ success: true });
}
