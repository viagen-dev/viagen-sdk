import { Hono } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { requireAuth, type AuthEnv } from '../middleware/auth.js'
import { providers } from '../lib/auth.js'
import { getSecret, setSecret, deleteSecret } from '../lib/infisical.js'
import { generateState } from 'arctic'

const GITHUB_TOKEN_KEY = 'GITHUB_ACCESS_TOKEN'
const VERCEL_TOKEN_KEY = 'VERCEL_ACCESS_TOKEN'

const redirectBase = process.env.AUTH_REDIRECT_BASE ?? 'http://localhost:3000'
const afterLoginUrl = process.env.AFTER_LOGIN_URL ?? '/'

const integrationRoutes = new Hono<AuthEnv>()

integrationRoutes.use('*', requireAuth)

// ── GitHub ───────────────────────────────────────────────────────────

/**
 * GET /integrations/github/start — initiate GitHub OAuth connect flow.
 * Sets a connect cookie so the auth callback knows to store the token
 * in Infisical instead of creating a login session.
 */
integrationRoutes.get('/github/start', async (c) => {
  const orgId = c.get('organizationId')
  const state = generateState()
  const returnTo = c.req.query('return_to') ?? '/onboarding'

  setCookie(c, 'github-connect-org', orgId, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 600,
  })

  setCookie(c, 'connect-return-to', returnTo, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 600,
  })

  setCookie(c, 'oauth-state', state, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 600,
  })

  const url = providers.github.createAuthorizationURL(state, [
    'user:email',
    'repo',
    'read:org',
  ])

  return c.redirect(url.toString())
})

/** DELETE /integrations/github — remove GitHub token. Admin only. */
integrationRoutes.delete('/github', async (c) => {
  if (c.get('role') !== 'admin') {
    return c.json({ error: 'Admin role required' }, 403)
  }
  await deleteSecret(c.get('organizationId'), GITHUB_TOKEN_KEY)
  return c.json({ success: true })
})

// ── Vercel ───────────────────────────────────────────────────────────

/**
 * GET /integrations/vercel/start — initiate Vercel OAuth connect flow.
 * Requires VERCEL_INTEGRATION_CLIENT_ID and VERCEL_INTEGRATION_CLIENT_SECRET in env.
 */
integrationRoutes.get('/vercel/start', async (c) => {
  const clientId = process.env.VERCEL_INTEGRATION_CLIENT_ID
  if (!clientId) {
    return c.json({ error: 'Vercel integration not configured' }, 500)
  }

  const orgId = c.get('organizationId')
  const state = generateState()
  const returnTo = c.req.query('return_to') ?? '/onboarding'

  setCookie(c, 'vercel-connect-return-to', returnTo, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 600,
  })

  setCookie(c, 'vercel-connect-org', orgId, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 600,
  })

  setCookie(c, 'vercel-oauth-state', state, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 600,
  })

  const slug = process.env.VERCEL_INTEGRATION_SLUG ?? 'viagen-sdk'
  const url = new URL(`https://vercel.com/integrations/${slug}/new`)
  url.searchParams.set('state', state)

  return c.redirect(url.toString())
})

/**
 * GET /integrations/vercel/callback — Vercel OAuth callback.
 * Exchanges the code for an access token and stores it in Infisical.
 */
integrationRoutes.get('/vercel/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const configurationId = c.req.query('configurationId')
  const storedState = getCookie(c, 'vercel-oauth-state')
  const connectOrgId = getCookie(c, 'vercel-connect-org')
  const returnTo = getCookie(c, 'vercel-connect-return-to') ?? '/onboarding'

  console.log('[vercel-callback] params:', { code: !!code, state, configurationId, storedState, connectOrgId, returnTo })

  // Clean up cookies
  deleteCookie(c, 'vercel-oauth-state', { path: '/' })
  deleteCookie(c, 'vercel-connect-org', { path: '/' })
  deleteCookie(c, 'vercel-connect-return-to', { path: '/' })

  if (!code || !state || state !== storedState || !connectOrgId) {
    console.error('[vercel-callback] validation failed:', {
      hasCode: !!code,
      stateMatch: state === storedState,
      hasOrgId: !!connectOrgId,
    })
    return c.redirect(`${afterLoginUrl}${returnTo}?error=vercel`)
  }

  try {
    const callbackUrl = `${redirectBase}/api/integrations/vercel/callback`
    console.log('[vercel-callback] exchanging code, redirect_uri:', callbackUrl)

    const res = await fetch('https://api.vercel.com/v2/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.VERCEL_INTEGRATION_CLIENT_ID!,
        client_secret: process.env.VERCEL_INTEGRATION_CLIENT_SECRET!,
        code,
        redirect_uri: callbackUrl,
      }),
    })

    const responseText = await res.text()
    console.log('[vercel-callback] token exchange response:', res.status, responseText)

    if (!res.ok) {
      return c.redirect(`${afterLoginUrl}${returnTo}?error=vercel`)
    }

    const data = JSON.parse(responseText)
    console.log('[vercel-callback] token received, keys:', Object.keys(data))

    await setSecret(connectOrgId, VERCEL_TOKEN_KEY, data.access_token)
    console.log('[vercel-callback] token stored in Infisical for org:', connectOrgId)

    return c.redirect(`${afterLoginUrl}${returnTo}?connected=vercel`)
  } catch (err) {
    console.error('[vercel-callback] error:', err)
    return c.redirect(`${afterLoginUrl}${returnTo}?error=vercel`)
  }
})

/** DELETE /integrations/vercel — remove Vercel token. Admin only. */
integrationRoutes.delete('/vercel', async (c) => {
  if (c.get('role') !== 'admin') {
    return c.json({ error: 'Admin role required' }, 403)
  }
  await deleteSecret(c.get('organizationId'), VERCEL_TOKEN_KEY)
  return c.json({ success: true })
})

// ── Status ───────────────────────────────────────────────────────────

/** GET /integrations/status — check which integrations are connected for the current org. */
integrationRoutes.get('/status', async (c) => {
  const orgId = c.get('organizationId')

  const safeGet = async (key: string): Promise<boolean> => {
    try {
      const val = await getSecret(orgId, key)
      return !!val
    } catch {
      return false
    }
  }

  const [github, vercel] = await Promise.all([
    safeGet(GITHUB_TOKEN_KEY),
    safeGet(VERCEL_TOKEN_KEY),
  ])

  return c.json({ github, vercel })
})

export { integrationRoutes }
