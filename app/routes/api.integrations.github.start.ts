import { redirect } from 'react-router'
import { generateState } from 'arctic'
import { providers } from '~/lib/auth.server'
import { requireAuth, serializeCookie } from '~/lib/session.server'

export async function loader({ request }: { request: Request }) {
  const { org } = await requireAuth(request)

  const url = new URL(request.url)
  const returnTo = url.searchParams.get('return_to') ?? '/onboarding'
  const state = generateState()
  const isProd = process.env.NODE_ENV === 'production'

  const headers = new Headers()
  headers.append('Set-Cookie', serializeCookie('github-connect-org', org.id, {
    path: '/', httpOnly: true, secure: isProd, sameSite: 'Lax', maxAge: 600,
  }))
  headers.append('Set-Cookie', serializeCookie('connect-return-to', returnTo, {
    path: '/', httpOnly: true, secure: isProd, sameSite: 'Lax', maxAge: 600,
  }))
  headers.append('Set-Cookie', serializeCookie('oauth-state', state, {
    path: '/', httpOnly: true, secure: isProd, sameSite: 'Lax', maxAge: 600,
  }))

  const authUrl = providers.github.createAuthorizationURL(state, [
    'user:email',
    'repo',
    'read:org',
  ])

  return redirect(authUrl.toString(), { headers })
}
