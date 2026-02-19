import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { requireAuth } from '~/lib/session.server'
import { db } from '~/lib/db/index.server'
import { projects } from '~/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const { org, role } = await requireAuth(request)
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, params.id), eq(projects.organizationId, org.id)))

  if (!project) {
    throw Response.json({ error: 'Project not found' }, { status: 404 })
  }

  return { project, role }
}

interface Project {
  id: string
  name: string
  templateId: string | null
  vercelProjectId: string | null
  githubRepo: string | null
  gitBranch: string | null
  createdAt: string
  updatedAt: string
}

interface ClaudeStatus {
  connected: boolean
  source?: 'project' | 'org' | 'user'
  keyPrefix?: string
}

interface SecretRow {
  key: string
  value: string
  source: 'project' | 'org'
}

const SOURCE_LABELS: Record<string, string> = {
  project: 'project key',
  org: 'org key',
  user: 'personal key',
}

export default function ProjectDetail({
  loaderData,
}: {
  loaderData: { project: Project; role: string }
}) {
  const { project, role } = loaderData
  const isAdmin = role === 'admin'

  // Claude status
  const [claudeStatus, setClaudeStatus] = useState<ClaudeStatus | null>(null)

  // Sandbox
  const [launching, setLaunching] = useState(false)
  const [sandboxUrl, setSandboxUrl] = useState<string | null>(null)
  const [sandboxError, setSandboxError] = useState<string | null>(null)

  // Secrets
  const [secrets, setSecrets] = useState<SecretRow[]>([])
  const [secretsLoading, setSecretsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add form
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [saving, setSaving] = useState(false)

  // Edit state
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Reveal state
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set())

  // Fetch Claude status
  useEffect(() => {
    fetch(`/api/projects/${project.id}/claude`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setClaudeStatus)
      .catch(() => setClaudeStatus({ connected: false }))
  }, [project.id])

  // Fetch secrets
  const fetchSecrets = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/secrets`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load secrets')
      const data = await res.json()
      setSecrets(data.secrets)
    } catch {
      setError('Failed to load secrets')
    } finally {
      setSecretsLoading(false)
    }
  }

  useEffect(() => {
    fetchSecrets()
  }, [project.id])

  // Launch sandbox
  const handleLaunch = async () => {
    setLaunching(true)
    setSandboxError(null)
    setSandboxUrl(null)
    try {
      const res = await fetch(`/api/projects/${project.id}/sandbox`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        setSandboxError(data.error ?? 'Failed to launch sandbox')
        return
      }
      setSandboxUrl(data.url)
    } catch {
      setSandboxError('Failed to launch sandbox')
    } finally {
      setLaunching(false)
    }
  }

  // Secret handlers
  const handleAdd = async () => {
    if (!newKey.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${project.id}/secrets`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: newKey.trim(), value: newValue }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Failed to save secret')
        setSaving(false)
        return
      }
      setNewKey('')
      setNewValue('')
      await fetchSecrets()
    } catch {
      setError('Failed to save secret')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (key: string) => {
    if (editSaving) return
    setEditSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${project.id}/secrets`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: editValue }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Failed to update secret')
        setEditSaving(false)
        return
      }
      setEditingKey(null)
      setEditValue('')
      await fetchSecrets()
    } catch {
      setError('Failed to update secret')
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async (key: string) => {
    setError(null)
    try {
      const res = await fetch(`/api/projects/${project.id}/secrets`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Failed to delete secret')
        return
      }
      await fetchSecrets()
    } catch {
      setError('Failed to delete secret')
    }
  }

  const toggleReveal = (key: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const startEdit = (secret: SecretRow) => {
    setEditingKey(secret.key)
    setEditValue(secret.value)
  }

  const cancelEdit = () => {
    setEditingKey(null)
    setEditValue('')
  }

  const maskValue = (value: string) => {
    if (value.length <= 4) return '\u2022'.repeat(8)
    return value.slice(0, 4) + '\u2022'.repeat(Math.min(value.length - 4, 20))
  }

  return (
    <div>
      <Link to="/projects" style={styles.backLink}>&larr; Projects</Link>

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>{project.name}</h1>
        <button
          onClick={handleLaunch}
          disabled={launching}
          style={{
            ...styles.launchButton,
            opacity: launching ? 0.6 : 1,
          }}
        >
          {launching ? 'Launching...' : 'Launch Sandbox'}
        </button>
      </div>

      {sandboxUrl && (
        <div style={styles.successBanner}>
          Sandbox ready:{' '}
          <a href={sandboxUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#166534', fontWeight: 500 }}>
            Open sandbox
          </a>
        </div>
      )}
      {sandboxError && <div style={styles.errorBanner}>{sandboxError}</div>}

      {/* Project details */}
      <div style={styles.detailsGrid}>
        {project.templateId && (
          <div style={styles.detailCard}>
            <span style={styles.detailLabel}>Template</span>
            <span style={styles.detailValue}>{project.templateId}</span>
          </div>
        )}
        {project.githubRepo && (
          <div style={styles.detailCard}>
            <span style={styles.detailLabel}>Repository</span>
            <span style={styles.detailValue}>
              <GitHubIcon /> {project.githubRepo}
            </span>
          </div>
        )}
        <div style={styles.detailCard}>
          <span style={styles.detailLabel}>Branch</span>
          <span style={styles.detailValue}>{project.gitBranch ?? 'main'}</span>
        </div>
        {project.vercelProjectId && (
          <div style={styles.detailCard}>
            <span style={styles.detailLabel}>Vercel</span>
            <span style={styles.detailValue}>
              <VercelIcon /> {project.vercelProjectId}
            </span>
          </div>
        )}
        <div style={styles.detailCard}>
          <span style={styles.detailLabel}>Claude</span>
          <span style={styles.detailValue}>
            {claudeStatus === null ? (
              <span style={{ color: 'var(--ds-gray-500)' }}>Checking...</span>
            ) : claudeStatus.connected ? (
              <span style={styles.connectedBadge}>
                {SOURCE_LABELS[claudeStatus.source ?? 'project']}
                {claudeStatus.keyPrefix ? ` (${claudeStatus.keyPrefix})` : ''}
              </span>
            ) : (
              <span style={styles.disconnectedBadge}>Not connected</span>
            )}
          </span>
        </div>
        <div style={styles.detailCard}>
          <span style={styles.detailLabel}>Created</span>
          <span style={styles.detailValue}>{new Date(project.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Secrets section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Environment Variables</h2>
          {project.vercelProjectId && (
            <span style={styles.vercelBadge}>
              <VercelIcon /> Syncs to Vercel
            </span>
          )}
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}

        {/* Add form */}
        {isAdmin && (
          <div style={styles.addRow}>
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
              placeholder="KEY_NAME"
              style={{ ...styles.input, flex: '0 0 200px', fontFamily: 'var(--font-mono, monospace)' }}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="value"
              style={{ ...styles.input, flex: 1 }}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={handleAdd}
              disabled={!newKey.trim() || saving}
              style={{
                ...styles.primaryButton,
                opacity: !newKey.trim() || saving ? 0.5 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Add'}
            </button>
          </div>
        )}

        {/* Secrets list */}
        {secretsLoading ? (
          <p style={{ color: 'var(--ds-gray-500)', fontSize: '0.875rem', padding: '1rem 0' }}>
            Loading...
          </p>
        ) : secrets.length === 0 ? (
          <p style={{ color: 'var(--ds-gray-500)', fontSize: '0.875rem', padding: '1rem 0' }}>
            No environment variables set.
          </p>
        ) : (
          <div style={styles.table}>
            {secrets.map((secret) => (
              <div key={secret.key} style={styles.row}>
                {editingKey === secret.key ? (
                  <>
                    <span style={styles.keyCell}>{secret.key}</span>
                    <div style={{ flex: 1, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        style={{ ...styles.input, flex: 1 }}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEdit(secret.key)
                          if (e.key === 'Escape') cancelEdit()
                        }}
                      />
                      <button
                        onClick={() => handleEdit(secret.key)}
                        disabled={editSaving}
                        style={styles.primaryButton}
                      >
                        {editSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={cancelEdit} style={styles.secondaryButton}>
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span style={styles.keyCell}>{secret.key}</span>
                    <span
                      style={styles.valueCell}
                      onClick={() => toggleReveal(secret.key)}
                      title="Click to reveal"
                    >
                      {revealedKeys.has(secret.key) ? secret.value : maskValue(secret.value)}
                    </span>
                    <span style={secret.source === 'org' ? styles.orgBadge : styles.projectBadge}>
                      {secret.source === 'org' ? 'inherited' : 'project'}
                    </span>
                    {isAdmin && secret.source === 'project' && (
                      <div style={styles.actions}>
                        <button onClick={() => startEdit(secret)} style={styles.actionButton}>
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(secret.key)}
                          style={{ ...styles.actionButton, color: '#dc2626' }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                    {secret.source === 'org' && isAdmin && (
                      <div style={styles.actions}>
                        <button
                          onClick={() => {
                            setNewKey(secret.key)
                            setNewValue('')
                          }}
                          style={styles.actionButton}
                          title="Create a project-level override"
                        >
                          Override
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function VercelIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 76 65" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

const styles: Record<string, React.CSSProperties> = {
  backLink: {
    display: 'inline-block',
    fontSize: '0.875rem',
    color: 'var(--ds-gray-600)',
    textDecoration: 'none',
    marginBottom: '1.5rem',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '1.5rem',
  },
  title: {
    fontSize: '1.875rem',
    fontWeight: 600,
  },
  launchButton: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.625rem 1.25rem',
    background: 'var(--ds-gray-1000)',
    color: 'var(--ds-background-100)',
    border: 'none',
    borderRadius: 6,
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  successBanner: {
    padding: '0.625rem 0.875rem',
    marginBottom: '1rem',
    fontSize: '0.8125rem',
    color: '#166534',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 6,
  },
  errorBanner: {
    padding: '0.625rem 0.875rem',
    marginBottom: '1rem',
    fontSize: '0.8125rem',
    color: '#991b1b',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 6,
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '0.75rem',
    marginBottom: '1.5rem',
  },
  detailCard: {
    padding: '1rem',
    border: '1px solid var(--ds-gray-200)',
    borderRadius: 8,
    background: 'var(--ds-background-100)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.375rem',
  },
  detailLabel: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: 'var(--ds-gray-500)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.025em',
  },
  detailValue: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--ds-gray-1000)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
  connectedBadge: {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#166534',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 9999,
  },
  disconnectedBadge: {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    color: 'var(--ds-gray-600)',
    background: 'var(--ds-gray-100)',
    border: '1px solid var(--ds-gray-200)',
    borderRadius: 9999,
  },
  section: {
    padding: '1.5rem',
    border: '1px solid var(--ds-gray-200)',
    borderRadius: 8,
    background: 'var(--ds-background-100)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem',
  },
  sectionTitle: {
    fontSize: '1.125rem',
    fontWeight: 600,
  },
  vercelBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.25rem 0.625rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    color: 'var(--ds-gray-700)',
    background: 'var(--ds-gray-50)',
    border: '1px solid var(--ds-gray-200)',
    borderRadius: 9999,
  },
  addRow: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
    marginBottom: '1rem',
    paddingBottom: '1rem',
    borderBottom: '1px solid var(--ds-gray-200)',
  },
  input: {
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    border: '1px solid var(--ds-gray-300)',
    borderRadius: 6,
    fontFamily: 'inherit',
    color: 'var(--ds-gray-1000)',
    background: 'var(--ds-background-100)',
    boxSizing: 'border-box' as const,
  },
  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.5rem 1rem',
    background: 'var(--ds-gray-1000)',
    color: 'var(--ds-background-100)',
    border: 'none',
    borderRadius: 6,
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.5rem 1rem',
    background: 'none',
    color: 'var(--ds-gray-700)',
    border: '1px solid var(--ds-gray-300)',
    borderRadius: 6,
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  table: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.625rem 0',
    borderBottom: '1px solid var(--ds-gray-100)',
  },
  keyCell: {
    flex: '0 0 200px',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: 'var(--ds-gray-1000)',
  },
  valueCell: {
    flex: 1,
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '0.8125rem',
    color: 'var(--ds-gray-600)',
    cursor: 'pointer',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  projectBadge: {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    fontSize: '0.6875rem',
    fontWeight: 500,
    color: 'var(--ds-gray-600)',
    background: 'var(--ds-gray-100)',
    border: '1px solid var(--ds-gray-200)',
    borderRadius: 9999,
    whiteSpace: 'nowrap' as const,
  },
  orgBadge: {
    display: 'inline-block',
    padding: '0.125rem 0.5rem',
    fontSize: '0.6875rem',
    fontWeight: 500,
    color: '#854d0e',
    background: '#fefce8',
    border: '1px solid #fef08a',
    borderRadius: 9999,
    whiteSpace: 'nowrap' as const,
  },
  actions: {
    display: 'flex',
    gap: '0.25rem',
    flexShrink: 0,
  },
  actionButton: {
    background: 'none',
    border: 'none',
    padding: '0.25rem 0.5rem',
    fontSize: '0.8125rem',
    fontFamily: 'inherit',
    color: 'var(--ds-gray-600)',
    cursor: 'pointer',
  },
}
