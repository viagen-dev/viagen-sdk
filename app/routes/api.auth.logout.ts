import { deleteSession } from '~/lib/auth.server'
import { parseCookie, deleteCookieHeader } from '~/lib/session.server'
import { log } from '~/lib/logger.server'

const SESSION_COOKIE = 'viagen-session'

export async function action({ request }: { request: Request }) {
  const token = parseCookie(request.headers.get('Cookie'), SESSION_COOKIE)
  if (token) {
    await deleteSession(token)
    log.info('user logged out')
  }
  return Response.json({ success: true }, {
    headers: { 'Set-Cookie': deleteCookieHeader(SESSION_COOKIE) },
  })
}
