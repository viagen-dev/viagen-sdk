import { createMiddleware } from 'hono/factory'
import { getCookie, deleteCookie } from 'hono/cookie'
import { validateSession } from '../lib/auth.js'
import { db } from '../db/index.js'
import { orgMembers } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import type { User } from '../db/schema.js'

const SESSION_COOKIE = 'viagen-session'

export type UserEnv = {
  Variables: {
    user: User
  }
}

export type AuthEnv = {
  Variables: {
    user: User
    organizationId: string
    role: string
  }
}

/**
 * Requires an authenticated session. Sets user on context.
 * Does NOT require an organization — for routes like org creation.
 */
export const requireUser = createMiddleware<UserEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE)

  if (!token) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  const result = await validateSession(token)

  if (!result) {
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.json({ error: 'Session expired or invalid' }, 401)
  }

  c.set('user', result.user)
  await next()
})

/**
 * Requires an authenticated session AND an organization.
 * Reads org ID from X-Organization header or defaults to user's first org.
 * Sets user, organizationId, and role on context.
 */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE)

  if (!token) {
    return c.json({ error: 'Authentication required' }, 401)
  }

  const result = await validateSession(token)

  if (!result) {
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.json({ error: 'Session expired or invalid' }, 401)
  }

  // Get org from header or default to first membership
  const orgId = c.req.header('x-organization')

  let membership
  if (orgId) {
    const [m] = await db
      .select()
      .from(orgMembers)
      .where(and(eq(orgMembers.userId, result.user.id), eq(orgMembers.organizationId, orgId)))
    membership = m
  } else {
    const [m] = await db
      .select()
      .from(orgMembers)
      .where(eq(orgMembers.userId, result.user.id))
    membership = m
  }

  if (!membership) {
    return c.json({ error: 'Organization required' }, 403)
  }

  c.set('user', result.user)
  c.set('organizationId', membership.organizationId)
  c.set('role', membership.role)

  await next()
})
