import { requireAuth } from '~/lib/session.server'
import { db } from '~/lib/db/index.server'
import { users, orgMembers } from '~/lib/db/schema'
import { eq, and } from 'drizzle-orm'

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

  await db.insert(orgMembers).values({
    userId: targetUser.id,
    organizationId: org.id,
    role: body.role === 'admin' ? 'admin' : 'member',
  })

  return Response.json({ success: true }, { status: 201 })
}
