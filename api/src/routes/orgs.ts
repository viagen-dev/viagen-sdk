import { Hono } from 'hono'
import { db } from '../db/index.js'
import { organizations, orgMembers, users } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { requireUser, requireAuth, type UserEnv, type AuthEnv } from '../middleware/auth.js'

const orgs = new Hono()

/** GET /orgs — list the current user's organizations. */
orgs.get('/', requireUser, async (c: any) => {
  const user = c.get('user')

  const memberships = await db
    .select({
      organizationId: orgMembers.organizationId,
      role: orgMembers.role,
      organizationName: organizations.name,
    })
    .from(orgMembers)
    .innerJoin(organizations, eq(orgMembers.organizationId, organizations.id))
    .where(eq(orgMembers.userId, user.id))

  return c.json({
    organizations: memberships.map((m) => ({
      id: m.organizationId,
      name: m.organizationName,
      role: m.role,
    })),
  })
})

/** POST /orgs — create a new organization, add current user as admin. */
orgs.post('/', requireUser, async (c: any) => {
  const user = c.get('user')
  const body = await c.req.json<{ name: string }>()

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return c.json({ error: 'Organization name is required' }, 400)
  }

  const [org] = await db
    .insert(organizations)
    .values({ name: body.name.trim() })
    .returning()

  await db.insert(orgMembers).values({
    userId: user.id,
    organizationId: org.id,
    role: 'admin',
  })

  return c.json({
    organization: { id: org.id, name: org.name },
  }, 201)
})

/** POST /orgs/members — add a member to the current org by email. Admin only. */
orgs.post('/members', requireAuth, async (c: any) => {
  const role = c.get('role')
  if (role !== 'admin') {
    return c.json({ error: 'Admin role required' }, 403)
  }

  const organizationId = c.get('organizationId')
  const body = await c.req.json<{ email: string; role?: string }>()

  if (!body.email || typeof body.email !== 'string') {
    return c.json({ error: 'Email is required' }, 400)
  }

  // Find user by email
  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email.trim()))

  if (!targetUser) {
    return c.json({ error: 'User not found. They must log in at least once first.' }, 404)
  }

  // Check if already a member
  const [existing] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, targetUser.id), eq(orgMembers.organizationId, organizationId)))

  if (existing) {
    return c.json({ error: 'User is already a member of this organization' }, 409)
  }

  await db.insert(orgMembers).values({
    userId: targetUser.id,
    organizationId,
    role: body.role === 'admin' ? 'admin' : 'member',
  })

  return c.json({ success: true }, 201)
})

export { orgs }
