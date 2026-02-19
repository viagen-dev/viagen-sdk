import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { redirect } from 'react-router'
import { requireAuth } from '~/lib/session.server'
import { getSecret } from '~/lib/infisical.server'

export async function loader({ request }: { request: Request }) {
  const auth = await requireAuth(request)

  // Check integration status
  const safeGet = async (key: string): Promise<boolean> => {
    try {
      const val = await getSecret(auth.org.id, key)
      return !!val
    } catch {
      return false
    }
  }
  const [github, vercel] = await Promise.all([
    safeGet('GITHUB_ACCESS_TOKEN'),
    safeGet('VERCEL_ACCESS_TOKEN'),
  ])

  return {
    user: {
      id: auth.user.id,
      email: auth.user.email,
      name: auth.user.name,
      avatarUrl: auth.user.avatarUrl,
    },
    currentOrg: auth.org,
    organizations: auth.memberships.map((m) => ({
      id: m.organizationId,
      name: m.organizationName,
      role: m.role,
    })),
    integrations: { github, vercel },
  }
}

interface LoaderData {
  user: { id: string; email: string; name: string | null; avatarUrl: string | null }
  currentOrg: { id: string; name: string }
  organizations: { id: string; name: string; role: string }[]
  integrations: { github: boolean; vercel: boolean }
}

export default function AuthLayout({ loaderData }: { loaderData: LoaderData }) {
  const { user, currentOrg, organizations, integrations } = loaderData
  const location = useLocation()
  const navigate = useNavigate()

  const handleOrgSwitch = (orgId: string) => {
    // Set org cookie and reload
    document.cookie = `viagen-org=${orgId}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    window.location.reload()
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    navigate('/login')
  }

  const missingIntegrations = !integrations.github || !integrations.vercel

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.headerLeft}>
            <Link to="/" style={styles.logo}>viagen</Link>
            <span style={styles.separator}>/</span>
            {organizations.length > 1 ? (
              <select
                value={currentOrg.id}
                onChange={(e) => handleOrgSwitch(e.target.value)}
                style={styles.orgSelect}
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            ) : (
              <span style={styles.orgName}>{currentOrg.name}</span>
            )}
            <nav style={styles.nav}>
              <Link to="/" style={{ ...styles.navLink, ...(location.pathname === '/' ? styles.navLinkActive : {}) }}>
                Dashboard
              </Link>
              <Link to="/projects" style={{ ...styles.navLink, ...(location.pathname.startsWith('/projects') ? styles.navLinkActive : {}) }}>
                Projects
              </Link>
              <Link to="/settings" style={{ ...styles.navLink, ...(location.pathname.startsWith('/settings') ? styles.navLinkActive : {}) }}>
                Settings
              </Link>
            </nav>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.userInfo}>
              {user.avatarUrl && <img src={user.avatarUrl} alt="" style={styles.avatar} />}
              <div style={styles.userDetails}>
                <p style={styles.userName}>{user.name}</p>
                <p style={styles.userEmail}>{user.email}</p>
              </div>
            </div>
            <button onClick={handleLogout} style={styles.logoutButton}>Sign out</button>
          </div>
        </div>
      </header>

      {missingIntegrations && (
        <div style={styles.banner}>
          <span>
            {!integrations.github && !integrations.vercel
              ? 'Connect your GitHub and Vercel accounts to save sandbox changes.'
              : !integrations.github
                ? 'Connect your GitHub account to save sandbox changes.'
                : 'Connect your Vercel account to deploy projects.'}
          </span>
          <Link to="/settings" style={styles.bannerLink}>Go to Settings</Link>
        </div>
      )}

      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  header: { borderBottom: '1px solid var(--ds-gray-200)', background: 'var(--ds-background-100)' },
  headerContent: { maxWidth: 1200, margin: '0 auto', padding: '0 1.5rem', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  logo: { fontSize: '1.125rem', fontWeight: 600, color: 'var(--ds-gray-1000)', textDecoration: 'none' },
  separator: { color: 'var(--ds-gray-300)', fontSize: '1.125rem', fontWeight: 300 },
  orgName: { fontSize: '0.875rem', fontWeight: 500, color: 'var(--ds-gray-1000)' },
  orgSelect: { fontSize: '0.875rem', fontWeight: 500, color: 'var(--ds-gray-1000)', background: 'none', border: '1px solid var(--ds-gray-200)', borderRadius: 6, padding: '0.25rem 0.5rem', fontFamily: 'inherit', cursor: 'pointer' },
  nav: { display: 'flex', gap: '0.25rem', marginLeft: '1rem' },
  navLink: { padding: '0.5rem 0.75rem', fontSize: '0.875rem', color: 'var(--ds-gray-600)', textDecoration: 'none', borderRadius: 6, transition: 'background-color 0.15s ease' },
  navLinkActive: { color: 'var(--ds-gray-1000)', background: 'var(--ds-gray-100)' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '1rem' },
  userInfo: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  avatar: { width: 32, height: 32, borderRadius: '50%' },
  userDetails: { display: 'flex', flexDirection: 'column' },
  userName: { fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.2 },
  userEmail: { fontSize: '0.75rem', color: 'var(--ds-gray-600)', lineHeight: 1.2 },
  logoutButton: { padding: '0.5rem 1rem', background: 'none', border: '1px solid var(--ds-gray-200)', borderRadius: 6, color: 'var(--ds-gray-600)', fontSize: '0.75rem', fontFamily: 'inherit', cursor: 'pointer', transition: 'border-color 0.15s ease, color 0.15s ease' },
  banner: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '0.625rem 1rem', background: '#fef3c7', borderBottom: '1px solid #fcd34d', fontSize: '0.8125rem', color: '#92400e' },
  bannerLink: { color: '#92400e', fontWeight: 600, textDecoration: 'underline', fontSize: '0.8125rem' },
  main: { flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: '2rem 1.5rem' },
}
