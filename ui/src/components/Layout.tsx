import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'

interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
}

interface LayoutProps {
  user: User | null
  onLogout: () => void
}

export function Layout({ user, onLogout }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      .then(() => {
        onLogout()
        navigate('/')
      })
  }

  if (!user) {
    return <Outlet />
  }

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.headerLeft}>
            <Link to="/" style={styles.logo}>
              viagen
            </Link>
            <nav style={styles.nav}>
              <Link
                to="/"
                style={{
                  ...styles.navLink,
                  ...(location.pathname === '/' ? styles.navLinkActive : {}),
                }}
              >
                Dashboard
              </Link>
              <Link
                to="/projects"
                style={{
                  ...styles.navLink,
                  ...(location.pathname.startsWith('/projects') ? styles.navLinkActive : {}),
                }}
              >
                Projects
              </Link>
              <Link
                to="/settings"
                style={{
                  ...styles.navLink,
                  ...(location.pathname.startsWith('/settings') ? styles.navLinkActive : {}),
                }}
              >
                Settings
              </Link>
            </nav>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.userInfo}>
              {user.avatarUrl && (
                <img
                  src={user.avatarUrl}
                  alt=""
                  style={styles.avatar}
                />
              )}
              <div style={styles.userDetails}>
                <p style={styles.userName}>{user.name}</p>
                <p style={styles.userEmail}>{user.email}</p>
              </div>
            </div>
            <button onClick={handleLogout} style={styles.logoutButton}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    borderBottom: '1px solid var(--ds-gray-200)',
    background: 'var(--ds-background-100)',
  },
  headerContent: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0 1.5rem',
    height: 60,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '2rem',
  },
  logo: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: 'var(--ds-gray-1000)',
    textDecoration: 'none',
  },
  nav: {
    display: 'flex',
    gap: '0.25rem',
  },
  navLink: {
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    color: 'var(--ds-gray-600)',
    textDecoration: 'none',
    borderRadius: 6,
    transition: 'background-color 0.15s ease',
  },
  navLinkActive: {
    color: 'var(--ds-gray-1000)',
    background: 'var(--ds-gray-100)',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
  },
  userDetails: {
    display: 'flex',
    flexDirection: 'column',
  },
  userName: {
    fontSize: '0.875rem',
    fontWeight: 500,
    lineHeight: 1.2,
  },
  userEmail: {
    fontSize: '0.75rem',
    color: 'var(--ds-gray-600)',
    lineHeight: 1.2,
  },
  logoutButton: {
    padding: '0.5rem 1rem',
    background: 'none',
    border: '1px solid var(--ds-gray-200)',
    borderRadius: 6,
    color: 'var(--ds-gray-600)',
    fontSize: '0.75rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'border-color 0.15s ease, color 0.15s ease',
  },
  main: {
    flex: 1,
    maxWidth: 1200,
    width: '100%',
    margin: '0 auto',
    padding: '2rem 1.5rem',
  },
}
