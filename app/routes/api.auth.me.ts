import { getSessionUser, parseCookie, deleteCookieHeader } from '~/lib/session.server'

const SESSION_COOKIE = 'viagen-session'

export async function loader({ request }: { request: Request }) {
  const session = await getSessionUser(request)

  if (!session) {
    const token = parseCookie(request.headers.get('Cookie'), SESSION_COOKIE)
    if (token) {
      // Session was invalid — clear the cookie
      return Response.json({ authenticated: false }, {
        status: 401,
        headers: { 'Set-Cookie': deleteCookieHeader(SESSION_COOKIE) },
      })
    }
    return Response.json({ authenticated: false }, { status: 401 })
  }

  return Response.json({
    authenticated: true,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      avatarUrl: session.user.avatarUrl,
    },
    organizations: session.memberships.map((m) => ({
      id: m.organizationId,
      name: m.organizationName,
      role: m.role,
    })),
  })
}
