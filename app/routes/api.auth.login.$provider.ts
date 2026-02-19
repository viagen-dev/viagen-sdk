import { redirect } from 'react-router'
import { isValidProvider, createAuthUrl } from '~/lib/auth.server'
import { serializeCookie } from '~/lib/session.server'

export async function loader({ params }: { params: { provider: string } }) {
  const provider = params.provider
  if (!isValidProvider(provider)) {
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

  return redirect(url.toString(), { headers })
}
