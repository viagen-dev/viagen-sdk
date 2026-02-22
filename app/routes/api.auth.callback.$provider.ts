import { redirect } from 'react-router'
import {
  isValidProvider,
  exchangeCode,
  fetchProviderUser,
  upsertUser,
  createSession,
  validateSession,
} from '~/lib/auth.server'
import { setSecret } from '~/lib/infisical.server'
import { db } from '~/lib/db/index.server'
import { orgMembers } from '~/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { parseCookie, serializeCookie, deleteCookieHeader } from '~/lib/session.server'
import { log } from '~/lib/logger.server'

const SESSION_COOKIE = 'viagen-session'

export async function loader({ params, request }: { params: { provider: string }; request: Request }) {
  const provider = params.provider
  if (!isValidProvider(provider)) {
    return Response.json({ error: `Unknown provider: ${provider}` }, { status: 400 })
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookieHeader = request.headers.get('Cookie')
  const storedState = parseCookie(cookieHeader, 'oauth-state')
  const codeVerifier = parseCookie(cookieHeader, 'oauth-verifier')

  const cleanupHeaders = new Headers()
  cleanupHeaders.append('Set-Cookie', deleteCookieHeader('oauth-state'))
  cleanupHeaders.append('Set-Cookie', deleteCookieHeader('oauth-verifier'))

  if (!code || !state || state !== storedState) {
    log.warn({ provider }, 'auth callback: invalid state or missing code')
    return Response.json({ error: 'Invalid OAuth callback' }, { status: 400 })
  }

  const tokens = await exchangeCode(provider, code, codeVerifier)

  // Check if this is a GitHub connect flow (not a login)
  const connectOrgId = parseCookie(cookieHeader, 'github-connect-org')
  if (connectOrgId && provider === 'github') {
    const returnTo = parseCookie(cookieHeader, 'connect-return-to') ?? '/onboarding'
    cleanupHeaders.append('Set-Cookie', deleteCookieHeader('github-connect-org'))
    cleanupHeaders.append('Set-Cookie', deleteCookieHeader('connect-return-to'))

    let connected = false
    const sessionToken = parseCookie(cookieHeader, SESSION_COOKIE)
    if (!sessionToken) {
      log.warn('github connect: no session cookie')
    } else {
      const result = await validateSession(sessionToken)
      if (!result) {
        log.warn('github connect: invalid or expired session')
      } else {
        const [membership] = await db
          .select()
          .from(orgMembers)
          .where(and(eq(orgMembers.userId, result.user.id), eq(orgMembers.organizationId, connectOrgId)))

        if (!membership) {
          log.warn({ userId: result.user.id, orgId: connectOrgId }, 'github connect: user not a member of org')
        } else {
          await setSecret(connectOrgId, 'GITHUB_TOKEN', tokens.accessToken())
          log.info({ userId: result.user.id, orgId: connectOrgId }, 'github integration connected')
          connected = true
        }
      }
    }

    const param = connected ? 'connected=github' : 'error=github'
    return redirect(`${returnTo}?${param}`, { headers: cleanupHeaders })
  }

  // Normal login flow
  const providerUser = await fetchProviderUser(provider, tokens.accessToken())
  const user = await upsertUser(provider, providerUser)
  const { token, expiresAt } = await createSession(user.id)
  log.info({ userId: user.id, provider }, 'user logged in')
  const isProd = process.env.NODE_ENV === 'production'

  cleanupHeaders.append('Set-Cookie', serializeCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    expires: expiresAt,
  }))

  // Check for returnTo cookie (e.g., CLI authorize flow)
  const returnTo = parseCookie(cookieHeader, 'auth-return-to')
  if (returnTo) {
    cleanupHeaders.append('Set-Cookie', deleteCookieHeader('auth-return-to'))
    return redirect(returnTo, { headers: cleanupHeaders })
  }

  return redirect('/', { headers: cleanupHeaders })
}
