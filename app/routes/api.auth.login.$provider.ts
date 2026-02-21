import { redirect } from 'react-router'
import { isValidProvider, createAuthUrl } from '~/lib/auth.server'
import { serializeCookie } from '~/lib/session.server'
import { log } from '~/lib/logger.server'

export async function loader({ params, request }: { params: { provider: string }; request: Request }) {
  const provider = params.provider
  if (!isValidProvider(provider)) {
    log.warn({ provider }, 'auth login: unknown provider')
    return Response.json({ error: `Unknown provider: ${provider}` }, { status: 400 })
  }

  const { url, state, codeVerifier } = createAuthUrl(provider)
  const isProd = process.env.NODE_ENV === 'production'

  const headers = new Headers()
  headers.append('Set-Cookie', serializeCookie('oauth-state', state, {
    path: '/',
    httpOnly: true,
    secure: isProd,
    sameSite: 'Lax',
    maxAge: 600,
  }))

  if (codeVerifier) {
    headers.append('Set-Cookie', serializeCookie('oauth-verifier', codeVerifier, {
      path: '/',
      httpOnly: true,
      secure: isProd,
      sameSite: 'Lax',
      maxAge: 600,
    }))
  }

  // Store returnTo so the callback can redirect back after login
  const reqUrl = new URL(request.url)
  const returnTo = reqUrl.searchParams.get('returnTo')
  if (returnTo) {
    headers.append('Set-Cookie', serializeCookie('auth-return-to', returnTo, {
      path: '/',
      httpOnly: true,
      secure: isProd,
      sameSite: 'Lax',
      maxAge: 600,
    }))
  }

  log.info({ provider }, 'auth login: redirecting to OAuth provider')
  return redirect(url.toString(), { headers })
}
