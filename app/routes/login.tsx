import { redirect, useLoaderData } from 'react-router'
import { getSessionUser } from '~/lib/session.server'

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url)
  const returnTo = url.searchParams.get('returnTo')

  const session = await getSessionUser(request)
  if (session && session.memberships.length > 0) {
    return redirect(returnTo ?? '/')
  }
  if (session) {
    return redirect(returnTo ?? '/onboarding')
  }
  return { returnTo }
}

export default function Login() {
  const { returnTo } = useLoaderData<typeof loader>()
  const loginUrl = returnTo
    ? `/api/auth/login/github?returnTo=${encodeURIComponent(returnTo)}`
    : '/api/auth/login/github'

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>viagen</h1>
      <p style={{ ...styles.muted, marginBottom: '1.5rem' }}>Sign in to continue</p>
      <a href={loginUrl} style={styles.button}>
        <GitHubIcon />
        Continue with GitHub
      </a>
    </div>
  )
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
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
  muted: {
    color: 'var(--ds-gray-600)',
    fontSize: '0.8125rem',
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 1.25rem',
    background: 'var(--ds-gray-1000)',
    color: 'var(--ds-background-100)',
    textDecoration: 'none',
    borderRadius: 6,
    fontSize: '0.8125rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
}
