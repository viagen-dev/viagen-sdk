import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { WorkOS } from '@workos-inc/node'

const auth = new Hono()

const workos = new WorkOS(process.env.WORKOS_API_KEY, {
  clientId: process.env.WORKOS_CLIENT_ID,
})

const clientId = process.env.WORKOS_CLIENT_ID!
const cookiePassword = process.env.WORKOS_COOKIE_PASSWORD!
const redirectUri = process.env.WORKOS_REDIRECT_URI ?? 'http://localhost:3000/auth/callback'
const afterLoginUrl = process.env.WORKOS_AFTER_LOGIN_URL ?? '/'

auth.get('/login', (c) => {
  const authorizationUrl = workos.userManagement.getAuthorizationUrl({
    provider: 'authkit',
    redirectUri,
    clientId,
  })

  return c.redirect(authorizationUrl)
})

auth.get('/callback', async (c) => {
  const code = c.req.query('code')
  if (!code) {
    return c.json({ error: 'Missing code parameter' }, 400)
  }

  const { user, sealedSession } = await workos.userManagement.authenticateWithCode({
    clientId,
    code,
    session: {
      sealSession: true,
      cookiePassword,
    },
  })

  setCookie(c, 'wos-session', sealedSession!, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
  })

  return c.redirect(afterLoginUrl)
})

auth.get('/me', async (c) => {
  const sessionData = getCookie(c, 'wos-session')
  if (!sessionData) {
    return c.json({ authenticated: false }, 401)
  }

  const session = workos.userManagement.loadSealedSession({
    sessionData,
    cookiePassword,
  })

  const authResult = await session.authenticate()

  if (authResult.authenticated) {
    return c.json(authResult)
  }

  if (authResult.reason === 'no_session_cookie_provided') {
    return c.json({ authenticated: false }, 401)
  }

  // Session expired or invalid — clear it
  deleteCookie(c, 'wos-session', { path: '/' })
  return c.json({ authenticated: false }, 401)
})

auth.post('/logout', async (c) => {
  const sessionData = getCookie(c, 'wos-session')
  if (!sessionData) {
    return c.json({ success: true })
  }

  const session = workos.userManagement.loadSealedSession({
    sessionData,
    cookiePassword,
  })

  const url = await session.getLogoutUrl()
  deleteCookie(c, 'wos-session', { path: '/' })

  return c.json({ success: true, url })
})

export { auth }
