import { useState, useEffect } from 'react'
import { useRouteLoaderData, useSearchParams } from 'react-router'

interface ParentData {
  user: { id: string; email: string; name: string | null; avatarUrl: string | null }
  currentOrg: { id: string; name: string }
  organizations: { id: string; name: string; role: string }[]
  integrations: { github: boolean; vercel: boolean }
}

interface KeyStatus {
  connected: boolean
  scope: string
  keyPrefix?: string
}

export default function Settings() {
  const parentData = useRouteLoaderData('routes/_auth') as ParentData
  const { user, currentOrg, organizations, integrations } = parentData
  const [searchParams, setSearchParams] = useSearchParams()

  const currentRole = organizations.find(o => o.id === currentOrg.id)?.role ?? 'member'
  const isAdmin = currentRole === 'admin'

  const [githubConnected, setGithubConnected] = useState(integrations.github)
  const [vercelConnected, setVercelConnected] = useState(integrations.vercel)

  // Claude key state
  const [userKey, setUserKey] = useState<KeyStatus | null>(null)
  const [orgKey, setOrgKey] = useState<KeyStatus | null>(null)
  const [userKeyInput, setUserKeyInput] = useState('')
  const [orgKeyInput, setOrgKeyInput] = useState('')
  const [savingUserKey, setSavingUserKey] = useState(false)
  const [savingOrgKey, setSavingOrgKey] = useState(false)

  // Clean up OAuth redirect params from URL
  useEffect(() => {
    if (searchParams.has('connected') || searchParams.has('error')) {
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Fetch Claude key status
  useEffect(() => {
    fetch('/api/claude-key?scope=user', { credentials: 'include' })
      .then(r => r.json()).then(setUserKey).catch(() => {})
    fetch('/api/claude-key?scope=org', { credentials: 'include' })
      .then(r => r.json()).then(setOrgKey).catch(() => {})
  }, [])

  const disconnectGithub = async () => {
    await fetch('/api/integrations/github', { method: 'DELETE', credentials: 'include' })
    setGithubConnected(false)
  }

  const disconnectVercel = async () => {
    await fetch('/api/integrations/vercel', { method: 'DELETE', credentials: 'include' })
    setVercelConnected(false)
  }

  const saveUserKey = async () => {
    if (!userKeyInput.trim()) return
    setSavingUserKey(true)
    await fetch('/api/claude-key', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: userKeyInput.trim(), scope: 'user' }),
    })
    const res = await fetch('/api/claude-key?scope=user', { credentials: 'include' })
    setUserKey(await res.json())
    setUserKeyInput('')
    setSavingUserKey(false)
  }

  const removeUserKey = async () => {
    setSavingUserKey(true)
    await fetch('/api/claude-key?scope=user', { method: 'DELETE', credentials: 'include' })
    setUserKey({ connected: false, scope: 'user' })
    setSavingUserKey(false)
  }

  const saveOrgKey = async () => {
    if (!orgKeyInput.trim()) return
    setSavingOrgKey(true)
    await fetch('/api/claude-key', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: orgKeyInput.trim(), scope: 'org' }),
    })
    const res = await fetch('/api/claude-key?scope=org', { credentials: 'include' })
    setOrgKey(await res.json())
    setOrgKeyInput('')
    setSavingOrgKey(false)
  }

  const removeOrgKey = async () => {
    setSavingOrgKey(true)
    await fetch('/api/claude-key?scope=org', { method: 'DELETE', credentials: 'include' })
    setOrgKey({ connected: false, scope: 'org' })
    setSavingOrgKey(false)
  }

  return (
    <div>
      <h1 style={styles.title}>Settings</h1>
      <p style={styles.description}>Manage your account and preferences</p>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Profile</h2>
        <div style={styles.card}>
          <div style={styles.field}>
            <label style={styles.label}>Name</label>
            <input type="text" defaultValue={user.name ?? ''} placeholder="Your name" style={styles.input} />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input type="email" defaultValue={user.email} placeholder="your@email.com" style={styles.input} />
          </div>
          <button style={styles.saveButton}>Save Changes</button>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Integrations</h2>

        {/* GitHub */}
        <div style={{ ...styles.card, marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <GitHubIcon />
              <div>
                <p style={{ fontSize: '0.9375rem', fontWeight: 500 }}>GitHub</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--ds-gray-600)' }}>
                  Access repositories and save sandbox changes
                </p>
              </div>
            </div>
            {githubConnected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={styles.connectedBadge}>Connected</span>
                <button onClick={disconnectGithub} style={styles.secondaryButton}>
                  Disconnect
                </button>
              </div>
            ) : (
              <a
                href="/api/integrations/github/start?return_to=/settings"
                style={{ ...styles.saveButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                Connect
              </a>
            )}
          </div>
        </div>

        {/* Vercel */}
        <div style={styles.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <VercelIcon />
              <div>
                <p style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Vercel</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--ds-gray-600)' }}>
                  Deploy projects and manage environments
                </p>
              </div>
            </div>
            {vercelConnected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={styles.connectedBadge}>Connected</span>
                <button onClick={disconnectVercel} style={styles.secondaryButton}>
                  Disconnect
                </button>
              </div>
            ) : (
              <a
                href="/api/integrations/vercel/start?return_to=/settings"
                style={{ ...styles.saveButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                Connect
              </a>
            )}
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Claude / Anthropic</h2>
        <p style={{ fontSize: '0.8125rem', color: 'var(--ds-gray-600)', marginBottom: '1rem', marginTop: '-0.5rem' }}>
          API keys are resolved per project in priority order: project &gt; organization &gt; personal.
        </p>

        {/* Personal key */}
        <div style={{ ...styles.card, marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: userKey?.connected ? '0.75rem' : 0 }}>
            <div>
              <p style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Personal Key</p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--ds-gray-600)' }}>
                Your personal Anthropic API key. Used as fallback when no org or project key is set.
              </p>
            </div>
            {userKey?.connected && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={styles.connectedBadge}>{userKey.keyPrefix}</span>
                <button onClick={removeUserKey} disabled={savingUserKey} style={styles.secondaryButton}>
                  Remove
                </button>
              </div>
            )}
          </div>
          {!userKey?.connected && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <input
                type="password"
                value={userKeyInput}
                onChange={(e) => setUserKeyInput(e.target.value)}
                placeholder="sk-ant-api..."
                style={{ ...styles.input, flex: 1 }}
                onKeyDown={(e) => e.key === 'Enter' && saveUserKey()}
              />
              <button
                onClick={saveUserKey}
                disabled={!userKeyInput.trim() || savingUserKey}
                style={{ ...styles.saveButton, opacity: !userKeyInput.trim() || savingUserKey ? 0.5 : 1 }}
              >
                {savingUserKey ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {/* Organization key */}
        <div style={styles.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: orgKey?.connected ? '0.75rem' : 0 }}>
            <div>
              <p style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Organization Key</p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--ds-gray-600)' }}>
                Shared key for all projects in {currentOrg.name}. Overrides personal keys.
              </p>
            </div>
            {orgKey?.connected && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={styles.connectedBadge}>{orgKey.keyPrefix}</span>
                {isAdmin && (
                  <button onClick={removeOrgKey} disabled={savingOrgKey} style={styles.secondaryButton}>
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
          {!orgKey?.connected && isAdmin && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <input
                type="password"
                value={orgKeyInput}
                onChange={(e) => setOrgKeyInput(e.target.value)}
                placeholder="sk-ant-api..."
                style={{ ...styles.input, flex: 1 }}
                onKeyDown={(e) => e.key === 'Enter' && saveOrgKey()}
              />
              <button
                onClick={saveOrgKey}
                disabled={!orgKeyInput.trim() || savingOrgKey}
                style={{ ...styles.saveButton, opacity: !orgKeyInput.trim() || savingOrgKey ? 0.5 : 1 }}
              >
                {savingOrgKey ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
          {!orgKey?.connected && !isAdmin && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--ds-gray-600)', marginTop: '0.75rem', fontStyle: 'italic' }}>
              Only admins can set the organization key.
            </p>
          )}
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>API Keys</h2>
        <div style={styles.card}>
          <p style={styles.cardDescription}>
            Manage your API keys for authentication
          </p>
          <button style={styles.secondaryButton}>Generate New Key</button>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Danger Zone</h2>
        <div style={styles.dangerCard}>
          <div>
            <h3 style={styles.dangerTitle}>Delete Account</h3>
            <p style={styles.dangerDescription}>
              Permanently delete your account and all associated data
            </p>
          </div>
          <button style={styles.dangerButton}>Delete Account</button>
        </div>
      </div>
    </div>
  )
}

function GitHubIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

function VercelIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 76 65" fill="currentColor">
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
  )
}

const styles: Record<string, React.CSSProperties> = {
  title: { fontSize: '1.875rem', fontWeight: 600, marginBottom: '0.5rem' },
  description: { color: 'var(--ds-gray-600)', fontSize: '0.9375rem', marginBottom: '2rem' },
  section: { marginBottom: '2rem' },
  sectionTitle: { fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' },
  card: { padding: '1.5rem', border: '1px solid var(--ds-gray-200)', borderRadius: 8, background: 'var(--ds-background-100)' },
  field: { marginBottom: '1.25rem' },
  label: { display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--ds-gray-700)' },
  input: { width: '100%', padding: '0.625rem 0.75rem', fontSize: '0.875rem', border: '1px solid var(--ds-gray-300)', borderRadius: 6, fontFamily: 'inherit', color: 'var(--ds-gray-1000)', background: 'var(--ds-background-100)', boxSizing: 'border-box' as const },
  cardDescription: { fontSize: '0.875rem', color: 'var(--ds-gray-600)', marginBottom: '1rem' },
  saveButton: { padding: '0.625rem 1.25rem', background: 'var(--ds-gray-1000)', color: 'var(--ds-background-100)', border: 'none', borderRadius: 6, fontSize: '0.875rem', fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer', transition: 'opacity 0.15s ease' },
  secondaryButton: { padding: '0.5rem 1rem', background: 'none', border: '1px solid var(--ds-gray-300)', borderRadius: 6, color: 'var(--ds-gray-700)', fontSize: '0.875rem', fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer', transition: 'border-color 0.15s ease' },
  connectedBadge: { display: 'inline-block', padding: '0.25rem 0.625rem', fontSize: '0.75rem', fontWeight: 500, color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 9999 },
  dangerCard: { padding: '1.5rem', border: '1px solid #ef4444', borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  dangerTitle: { fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.25rem', color: '#991b1b' },
  dangerDescription: { fontSize: '0.8125rem', color: '#7f1d1d' },
  dangerButton: { padding: '0.5rem 1rem', background: '#ef4444', color: '#ffffff', border: 'none', borderRadius: 6, fontSize: '0.875rem', fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer', transition: 'background-color 0.15s ease' },
}
