import { requireAuth } from '~/lib/session.server'
import { db } from '~/lib/db/index.server'
import { users, orgMembers } from '~/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { log } from '~/lib/logger.server'

export async function loader({ request }: { request: Request }) {
  const { org } = await requireAuth(request)

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

  return Response.json({ members: rows })
}

export async function action({ request }: { request: Request }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const { role, org } = await requireAuth(request)
  if (role !== 'admin') {
    return Response.json({ error: 'Admin role required' }, { status: 403 })
  }

  const body = await request.json()

  if (!body.email || typeof body.email !== 'string') {
    return Response.json({ error: 'Email is required' }, { status: 400 })
  }

  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email.trim()))

  if (!targetUser) {
    return Response.json({ error: 'User not found. They must log in at least once first.' }, { status: 404 })
  }

  const [existing] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, targetUser.id), eq(orgMembers.organizationId, org.id)))

  if (existing) {
    return Response.json({ error: 'User is already a member of this organization' }, { status: 409 })
  }

  const assignedRole = body.role === 'admin' ? 'admin' : 'member'
  await db.insert(orgMembers).values({
    userId: targetUser.id,
    organizationId: org.id,
    role: assignedRole,
  })

  log.info({ orgId: org.id, targetUserId: targetUser.id, role: assignedRole, email: body.email.trim() }, 'member added to org')
  return Response.json({ success: true }, { status: 201 })
}
