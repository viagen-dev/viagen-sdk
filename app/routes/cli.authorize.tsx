import { redirect, useLoaderData } from 'react-router'
import { getSessionUser, requireUser } from '~/lib/session.server'
import { createApiToken } from '~/lib/auth.server'

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url)
  const portStr = url.searchParams.get('port')
  const port = portStr ? parseInt(portStr, 10) : NaN

  if (isNaN(port) || port < 1024 || port > 65535) {
    return Response.json({ error: 'Invalid port' }, { status: 400 })
  }

  const session = await getSessionUser(request)
  if (!session) {
    const returnTo = encodeURIComponent(`/cli/authorize?port=${port}`)
    throw redirect(`/login?returnTo=${returnTo}`)
  }

  return { user: { name: session.user.name, email: session.user.email }, port }
}

export async function action({ request }: { request: Request }) {
  const { user } = await requireUser(request)
  const formData = await request.formData()
  const portStr = formData.get('port')
  const port = portStr ? parseInt(String(portStr), 10) : NaN

  if (isNaN(port) || port < 1024 || port > 65535) {
    return Response.json({ error: 'Invalid port' }, { status: 400 })
  }

  const { token } = await createApiToken(user.id, `cli-${new Date().toISOString().slice(0, 10)}`)

  return redirect(`http://127.0.0.1:${port}/callback?token=${token}`)
}

export default function CliAuthorize() {
  const { user, port } = useLoaderData<typeof loader>()

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>viagen</h1>
      <p style={styles.heading}>Authorize CLI access?</p>
      <div style={styles.card}>
        <p style={styles.userInfo}>
          Signed in as <strong>{user.name ?? user.email}</strong>
        </p>
        {user.name && <p style={styles.email}>{user.email}</p>}
        <p style={styles.description}>
          This will create an API token for the viagen CLI on your machine.
        </p>
      </div>
      <div style={styles.actions}>
        <form method="post">
          <input type="hidden" name="port" value={port} />
          <button type="submit" style={styles.authorizeButton}>
            Authorize
          </button>
        </form>
        <a
          href={`http://127.0.0.1:${port}/callback?error=denied`}
          style={styles.cancelLink}
        >
          Cancel
        </a>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 500,
    marginBottom: '0.5rem',
  },
  heading: {
    fontSize: '1rem',
    fontWeight: 500,
    marginBottom: '1.5rem',
  },
  card: {
    border: '1px solid var(--ds-gray-200)',
    borderRadius: 8,
    padding: '1.25rem',
    marginBottom: '1.5rem',
    maxWidth: 360,
    width: '100%',
    textAlign: 'center' as const,
  },
  userInfo: {
    fontSize: '0.875rem',
    margin: 0,
  },
  email: {
    fontSize: '0.8125rem',
    color: 'var(--ds-gray-600)',
    margin: '0.25rem 0 0',
  },
  description: {
    fontSize: '0.8125rem',
    color: 'var(--ds-gray-600)',
    marginTop: '1rem',
    marginBottom: 0,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
  },
  authorizeButton: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.625rem 2rem',
    background: 'var(--ds-gray-1000)',
    color: 'var(--ds-background-100)',
    border: 'none',
    borderRadius: 6,
    fontSize: '0.8125rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  cancelLink: {
    fontSize: '0.8125rem',
    color: 'var(--ds-gray-600)',
    textDecoration: 'none',
  },
}
