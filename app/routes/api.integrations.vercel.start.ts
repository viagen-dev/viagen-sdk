import { redirect } from 'react-router'
import { generateState } from 'arctic'
import { requireAuth, serializeCookie } from '~/lib/session.server'

export async function loader({ request }: { request: Request }) {
  const clientId = process.env.VERCEL_INTEGRATION_CLIENT_ID
  if (!clientId) {
    return Response.json({ error: 'Vercel integration not configured' }, { status: 500 })
  }

  const { org } = await requireAuth(request)

  const url = new URL(request.url)
  const returnTo = url.searchParams.get('return_to') ?? '/onboarding'
  const state = generateState()
  const isProd = process.env.NODE_ENV === 'production'

  const headers = new Headers()
  headers.append('Set-Cookie', serializeCookie('vercel-connect-return-to', returnTo, {
    path: '/', httpOnly: true, secure: isProd, sameSite: 'Lax', maxAge: 600,
  }))
  headers.append('Set-Cookie', serializeCookie('vercel-connect-org', org.id, {
    path: '/', httpOnly: true, secure: isProd, sameSite: 'Lax', maxAge: 600,
  }))
  headers.append('Set-Cookie', serializeCookie('vercel-oauth-state', state, {
    path: '/', httpOnly: true, secure: isProd, sameSite: 'Lax', maxAge: 600,
  }))

  const slug = process.env.VERCEL_INTEGRATION_SLUG ?? 'viagen-sdk'
  const vercelUrl = new URL(`https://vercel.com/integrations/${slug}/new`)
  vercelUrl.searchParams.set('state', state)

  return redirect(vercelUrl.toString(), { headers })
}
