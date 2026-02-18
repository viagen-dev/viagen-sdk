import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import {
  isValidProvider,
  createAuthUrl,
  exchangeCode,
  fetchProviderUser,
  upsertUser,
  createSession,
  validateSession,
  deleteSession,
  type ProviderName,
} from '../lib/auth.js'
import { setSecret } from '../lib/infisical.js'
import { db } from '../db/index.js'
import { orgMembers, organizations } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'

const auth = new Hono()

const SESSION_COOKIE = 'viagen-session'
const afterLoginUrl = process.env.AFTER_LOGIN_URL ?? '/'

auth.get('/login/:provider', (c) => {
  const provider = c.req.param('provider')
  if (!isValidProvider(provider)) {
    return c.json({ error: `Unknown provider: ${provider}` }, 400)
  }

  const { url, state, codeVerifier } = createAuthUrl(provider)

  // Store state + verifier in short-lived cookies for CSRF + PKCE validation
  setCookie(c, 'oauth-state', state, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 600, // 10 minutes
  })

  if (codeVerifier) {
    setCookie(c, 'oauth-verifier', codeVerifier, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 600,
    })
  }

  return c.redirect(url.toString())
})

auth.get('/callback/:provider', async (c) => {
  const provider = c.req.param('provider')
  if (!isValidProvider(provider)) {
    return c.json({ error: `Unknown provider: ${provider}` }, 400)
  }

  const code = c.req.query('code')
  const state = c.req.query('state')
  const storedState = getCookie(c, 'oauth-state')
  const codeVerifier = getCookie(c, 'oauth-verifier')

  // Clean up OAuth cookies
  deleteCookie(c, 'oauth-state', { path: '/' })
  deleteCookie(c, 'oauth-verifier', { path: '/' })

  if (!code || !state || state !== storedState) {
    return c.json({ error: 'Invalid OAuth callback' }, 400)
  }

  const tokens = await exchangeCode(provider, code, codeVerifier)

  // Check if this is a GitHub connect flow (not a login)
  const connectOrgId = getCookie(c, 'github-connect-org')
  if (connectOrgId && provider === 'github') {
    const returnTo = getCookie(c, 'connect-return-to') ?? '/onboarding'
    deleteCookie(c, 'github-connect-org', { path: '/' })
    deleteCookie(c, 'connect-return-to', { path: '/' })

    // Validate the user has an active session and belongs to this org
    const sessionToken = getCookie(c, SESSION_COOKIE)
    if (sessionToken) {
      const result = await validateSession(sessionToken)
      if (result) {
        const [membership] = await db
          .select()
          .from(orgMembers)
          .where(and(eq(orgMembers.userId, result.user.id), eq(orgMembers.organizationId, connectOrgId)))

        if (membership) {
          await setSecret(connectOrgId, 'GITHUB_ACCESS_TOKEN', tokens.accessToken())
          return c.redirect(`${afterLoginUrl}${returnTo}?connected=github`)
        }
      }
    }

    // Fallback: if session/membership validation failed, redirect with error
    return c.redirect(`${afterLoginUrl}${returnTo}?error=github`)
  }

  // Normal login flow
  const providerUser = await fetchProviderUser(provider, tokens.accessToken())
  const user = await upsertUser(provider, providerUser)
  const { token, expiresAt } = await createSession(user.id)

  setCookie(c, SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    expires: expiresAt,
  })

  return c.redirect(afterLoginUrl)
})

auth.get('/me', async (c) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) {
    return c.json({ authenticated: false }, 401)
  }

  const result = await validateSession(token)
  if (!result) {
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.json({ authenticated: false }, 401)
  }

  // Check org membership
  const memberships = await db
    .select({
      organizationId: orgMembers.organizationId,
      role: orgMembers.role,
      organizationName: organizations.name,
    })
    .from(orgMembers)
    .innerJoin(organizations, eq(orgMembers.organizationId, organizations.id))
    .where(eq(orgMembers.userId, result.user.id))

  return c.json({
    authenticated: true,
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      avatarUrl: result.user.avatarUrl,
    },
    organizations: memberships.map((m) => ({
      id: m.organizationId,
      name: m.organizationName,
      role: m.role,
    })),
  })
})

auth.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) {
    await deleteSession(token)
  }
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
  return c.json({ success: true })
})

export { auth }
