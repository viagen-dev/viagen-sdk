import { redirect } from 'react-router'
import { setSecret } from '~/lib/infisical.server'
import { validateSession } from '~/lib/auth.server'
import { parseCookie, deleteCookieHeader } from '~/lib/session.server'

const VERCEL_TOKEN_KEY = 'VERCEL_ACCESS_TOKEN'
const SESSION_COOKIE = 'viagen-session'
const redirectBase = process.env.AUTH_REDIRECT_BASE ?? 'http://localhost:5173'

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookieHeader = request.headers.get('Cookie')
  const storedState = parseCookie(cookieHeader, 'vercel-oauth-state')
  const returnTo = parseCookie(cookieHeader, 'vercel-connect-return-to') ?? '/onboarding'

  const headers = new Headers()
  headers.append('Set-Cookie', deleteCookieHeader('vercel-oauth-state'))
  headers.append('Set-Cookie', deleteCookieHeader('vercel-connect-org'))
  headers.append('Set-Cookie', deleteCookieHeader('vercel-connect-return-to'))

  if (!code || !state || state !== storedState) {
    return redirect(`${returnTo}?error=vercel`, { headers })
  }

  // Validate session to get user ID for user-scoped token storage
  const sessionToken = parseCookie(cookieHeader, SESSION_COOKIE)
  if (!sessionToken) {
    return redirect(`${returnTo}?error=vercel`, { headers })
  }
  const session = await validateSession(sessionToken)
  if (!session) {
    return redirect(`${returnTo}?error=vercel`, { headers })
  }

  try {
    const callbackUrl = `${redirectBase}/api/integrations/vercel/callback`

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

    if (!res.ok) {
      return redirect(`${returnTo}?error=vercel`, { headers })
    }

    const data = await res.json()
    await setSecret(`user/${session.user.id}`, VERCEL_TOKEN_KEY, data.access_token)

    return redirect(`${returnTo}?connected=vercel`, { headers })
  } catch {
    return redirect(`${returnTo}?error=vercel`, { headers })
  }
}
