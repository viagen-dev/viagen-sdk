import { requireAuth, isAdminRole } from "~/lib/session.server";
import { db } from "~/lib/db/index.server";
import { users, orgMembers } from "~/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { log } from "~/lib/logger.server";

export async function loader({ request }: { request: Request }) {
  const { org } = await requireAuth(request);

  log.info({ orgId: org.id }, "fetching org members");

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      role: orgMembers.role,
      joinedAt: orgMembers.createdAt,
    })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .where(eq(orgMembers.organizationId, org.id))
    .orderBy(asc(orgMembers.createdAt));

  return Response.json({ members: rows });
}

export async function action({ request }: { request: Request }) {
  const method = request.method;

  if (method === "POST") {
    return handleAddMember(request);
  }
  if (method === "PATCH") {
    return handleRoleChange(request);
  }
  if (method === "DELETE") {
    return handleRemoveMember(request);
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
}

/** POST — Add a new member to the org by email */
async function handleAddMember(request: Request) {
  const { role, org } = await requireAuth(request);
  if (!isAdminRole(role)) {
    log.warn({ orgId: org.id }, "add member denied: not admin/owner");
    return Response.json({ error: "Admin role required" }, { status: 403 });
  }

  const body = await request.json();

  if (!body.email || typeof body.email !== "string") {
    return Response.json({ error: "Email is required" }, { status: 400 });
  }

  const email = body.email.trim();

  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email));

  if (!targetUser) {
    log.info({ orgId: org.id, email }, "add member failed: user not found");
    return Response.json(
      { error: "User not found. They must log in at least once first." },
      { status: 404 },
    );
  }

  const [existing] = await db
    .select()
    .from(orgMembers)
    .where(
      and(
        eq(orgMembers.userId, targetUser.id),
        eq(orgMembers.organizationId, org.id),
      ),
    );

  if (existing) {
    log.info(
      { orgId: org.id, targetUserId: targetUser.id },
      "add member failed: already a member",
    );
    return Response.json(
      { error: "User is already a member of this organization" },
      { status: 409 },
    );
  }

  const assignedRole = body.role === "admin" ? "admin" : "member";
  await db.insert(orgMembers).values({
    userId: targetUser.id,
    organizationId: org.id,
    role: assignedRole,
  });

  log.info(
    { orgId: org.id, targetUserId: targetUser.id, role: assignedRole, email },
    "member added to org",
  );
  return Response.json({ success: true }, { status: 201 });
}

/** PATCH — Change a member's role */
async function handleRoleChange(request: Request) {
  const { role, user, org } = await requireAuth(request);
  if (!isAdminRole(role)) {
    log.warn(
      { orgId: org.id, userId: user.id },
      "role change denied: not admin/owner",
    );
    return Response.json({ error: "Admin role required" }, { status: 403 });
  }

  const body = await request.json();

  if (!body.userId || typeof body.userId !== "string") {
    return Response.json({ error: "userId is required" }, { status: 400 });
  }

  const newRole = body.role === "admin" ? "admin" : "member";

  // Prevent changing own role
  if (body.userId === user.id) {
    log.warn(
      { orgId: org.id, userId: user.id },
      "role change denied: cannot change own role",
    );
    return Response.json(
      { error: "You cannot change your own role" },
      { status: 400 },
    );
  }

  // Verify the target user is actually a member of this org
  const [membership] = await db
    .select()
    .from(orgMembers)
    .where(
      and(
        eq(orgMembers.userId, body.userId),
        eq(orgMembers.organizationId, org.id),
      ),
    );

  if (!membership) {
    log.warn(
      { orgId: org.id, targetUserId: body.userId },
      "role change failed: member not found",
    );
    return Response.json(
      { error: "Member not found in this organization" },
      { status: 404 },
    );
  }

  // Prevent changing the owner's role
  if (membership.role === "owner") {
    log.warn(
      { orgId: org.id, targetUserId: body.userId },
      "role change denied: cannot change owner role",
    );
    return Response.json(
      { error: "The owner's role cannot be changed" },
      { status: 403 },
    );
  }

  await db
    .update(orgMembers)
    .set({ role: newRole })
    .where(
      and(
        eq(orgMembers.userId, body.userId),
        eq(orgMembers.organizationId, org.id),
      ),
    );

  log.info(
    {
      orgId: org.id,
      targetUserId: body.userId,
      oldRole: membership.role,
      newRole,
    },
    "member role updated",
  );
  return Response.json({ success: true });
}

/** DELETE — Remove a member from the org (admin removing others, or self-leave) */
async function handleRemoveMember(request: Request) {
  const { role, user, org } = await requireAuth(request);

  const body = await request.json();

  if (!body.userId || typeof body.userId !== "string") {
    return Response.json({ error: "userId is required" }, { status: 400 });
  }

  const isSelfRemoval = body.userId === user.id;

  // Non-admins can only remove themselves
  if (!isSelfRemoval && !isAdminRole(role)) {
    log.warn(
      { orgId: org.id, userId: user.id },
      "remove member denied: not admin/owner",
    );
    return Response.json({ error: "Admin role required" }, { status: 403 });
  }

  // Verify the target user is actually a member of this org
  const [membership] = await db
    .select()
    .from(orgMembers)
    .where(
      and(
        eq(orgMembers.userId, body.userId),
        eq(orgMembers.organizationId, org.id),
      ),
    );

  if (!membership) {
    log.warn(
      { orgId: org.id, targetUserId: body.userId },
      "remove member failed: member not found",
    );
    return Response.json(
      { error: "Member not found in this organization" },
      { status: 404 },
    );
  }

  // Prevent removing the owner (whether self or by another admin)
  if (membership.role === "owner") {
    log.warn(
      { orgId: org.id, targetUserId: body.userId, isSelfRemoval },
      "remove member denied: cannot remove owner",
    );
    return Response.json(
      {
        error: isSelfRemoval
          ? "The owner cannot leave the organization. Transfer ownership first."
          : "The owner cannot be removed from the organization",
      },
      { status: 403 },
    );
  }

  await db
    .delete(orgMembers)
    .where(
      and(
        eq(orgMembers.userId, body.userId),
        eq(orgMembers.organizationId, org.id),
      ),
    );

  log.info(
    { orgId: org.id, targetUserId: body.userId, isSelfRemoval },
    isSelfRemoval ? "member left org" : "member removed from org",
  );
  return Response.json({ success: true, selfRemoval: isSelfRemoval });
}
