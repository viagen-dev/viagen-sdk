import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router'
import { requireAuth } from '~/lib/session.server'
import { db } from '~/lib/db/index.server'
import { projects } from '~/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function loader({ request }: { request: Request }) {
  const { org } = await requireAuth(request)
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.organizationId, org.id))
  return { projects: rows }
}

interface Project {
  id: string
  name: string
  templateId: string | null
  vercelProjectId: string | null
  githubRepo: string | null
  createdAt: string
}

interface ClaudeStatus {
  connected: boolean
  source?: 'project' | 'org' | 'user'
  keyPrefix?: string
}

const SOURCE_LABELS: Record<string, string> = {
  project: 'project key',
  org: 'org key',
  user: 'personal key',
}

export default function Projects({ loaderData }: { loaderData: { projects: Project[] } }) {
  const { projects } = loaderData
  const [searchParams, setSearchParams] = useSearchParams()

  const [claudeStatuses, setClaudeStatuses] = useState<Record<string, ClaudeStatus>>({})
  const [claudeLoading, setClaudeLoading] = useState(true)
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  // Clean up OAuth redirect params
  useEffect(() => {
    if (searchParams.has('connected') || searchParams.has('error')) {
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Fetch Claude status for all projects
  useEffect(() => {
    if (projects.length === 0) {
      setClaudeLoading(false)
      return
    }
    setClaudeLoading(true)
    Promise.all(
      projects.map(async (p) => {
        try {
          const res = await fetch(`/api/projects/${p.id}/claude`, { credentials: 'include' })
          const data = await res.json()
          return [p.id, data] as const
        } catch {
          return [p.id, { connected: false }] as const
        }
      })
    ).then((entries) => {
      setClaudeStatuses(Object.fromEntries(entries))
      setClaudeLoading(false)
    })
  }, [projects])

  const refreshStatus = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/claude`, { credentials: 'include' })
      const data = await res.json()
      setClaudeStatuses(prev => ({ ...prev, [projectId]: data }))
    } catch {}
  }

  const handleSaveApiKey = async () => {
    if (!activeProject || !apiKeyInput.trim()) return
    setSaving(true)
    setModalError(null)
    try {
      const res = await fetch(`/api/projects/${activeProject.id}/claude`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
      })
      if (!res.ok) {
        setModalError('Failed to save API key')
        setSaving(false)
        return
      }
      await refreshStatus(activeProject.id)
      setApiKeyInput('')
      setSaving(false)
      setActiveProject(null)
    } catch {
      setModalError('Failed to save API key')
      setSaving(false)
    }
  }

  const handleRemoveProjectKey = async () => {
    if (!activeProject) return
    setSaving(true)
    await fetch(`/api/projects/${activeProject.id}/claude`, {
      method: 'DELETE',
      credentials: 'include',
    })
    await refreshStatus(activeProject.id)
    setSaving(false)
    setActiveProject(null)
  }

  const openModal = (project: Project) => {
    setActiveProject(project)
    setApiKeyInput('')
    setModalError(null)
    setSaving(false)
  }

  const closeModal = () => {
    setActiveProject(null)
    setApiKeyInput('')
    setModalError(null)
  }

  const activeStatus = activeProject ? claudeStatuses[activeProject.id] : null

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Projects</h1>
          <p style={styles.description}>Manage your viagen projects</p>
        </div>
        <Link to="/projects/new" style={styles.primaryButton}>
          New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div style={styles.emptyState}>
          <h3 style={styles.emptyTitle}>No projects yet</h3>
          <p style={styles.emptyDescription}>Create your first project to get started</p>
          <Link to="/projects/new" style={{ ...styles.primaryButton, marginTop: '1rem' }}>
            New Project
          </Link>
        </div>
      ) : (
        <div style={styles.grid}>
          {projects.map((project) => {
            const status = claudeStatuses[project.id]
            return (
              <div key={project.id} style={styles.projectCard}>
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={styles.projectName}>{project.name}</h3>
                  <p style={styles.projectMeta}>
                    Created {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {project.templateId && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={styles.templateBadge}>{project.templateId}</span>
                  </div>
                )}

                {project.vercelProjectId && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: project.githubRepo ? '0.5rem' : 0 }}>
                    <VercelIcon />
                    <span style={{ fontSize: '0.8125rem', color: 'var(--ds-gray-600)' }}>
                      {project.vercelProjectId}
                    </span>
                  </div>
                )}

                {project.githubRepo && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <GitHubIcon />
                    <span style={{ fontSize: '0.8125rem', color: 'var(--ds-gray-600)' }}>
                      {project.githubRepo}
                    </span>
                  </div>
                )}

                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', cursor: 'pointer' }}
                  onClick={() => openModal(project)}
                >
                  <ClaudeIcon />
                  {claudeLoading ? (
                    <span style={styles.loadingBadge}>Checking...</span>
                  ) : status?.connected ? (
                    <span style={styles.connectedBadge}>
                      {SOURCE_LABELS[status.source ?? 'project'] ?? 'Connected'}
                    </span>
                  ) : (
                    <span style={styles.disconnectedBadge}>Not connected</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Claude credentials modal */}
      {activeProject && (
        <div style={styles.modalOverlay} onClick={closeModal}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
                Claude &mdash; {activeProject.name}
              </h3>
              <button onClick={closeModal} style={styles.closeButton}>&times;</button>
            </div>

            {modalError && (
              <div style={styles.errorBanner}>{modalError}</div>
            )}

            {activeStatus?.connected ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <span style={styles.connectedBadge}>Connected</span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--ds-gray-600)' }}>
                    via {SOURCE_LABELS[activeStatus.source ?? 'project']}
                    {activeStatus.keyPrefix ? ` (${activeStatus.keyPrefix})` : ''}
                  </span>
                </div>

                {activeStatus.source === 'project' ? (
                  <button onClick={handleRemoveProjectKey} disabled={saving} style={styles.dangerButton}>
                    {saving ? 'Removing...' : 'Remove Project Key'}
                  </button>
                ) : (
                  <div>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--ds-gray-600)', marginBottom: '1rem' }}>
                      This project is using the {SOURCE_LABELS[activeStatus.source ?? 'org']}. You can set a project-specific key to override it.
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="password"
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder="sk-ant-api..."
                        style={{ ...styles.input, flex: 1 }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
                      />
                      <button
                        onClick={handleSaveApiKey}
                        disabled={!apiKeyInput.trim() || saving}
                        style={{
                          ...styles.primaryButton,
                          opacity: !apiKeyInput.trim() || saving ? 0.5 : 1,
                        }}
                      >
                        {saving ? 'Saving...' : 'Override'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--ds-gray-600)', marginBottom: '1rem' }}>
                  No API key found for this project. Set a project key below, or configure an org/personal key in{' '}
                  <Link to="/settings" style={{ color: 'var(--ds-gray-1000)' }}>Settings</Link>.
                </p>
                <label style={styles.label}>Anthropic API Key</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="sk-ant-api..."
                    style={{ ...styles.input, flex: 1 }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
                  />
                  <button
                    onClick={handleSaveApiKey}
                    disabled={!apiKeyInput.trim() || saving}
                    style={{
                      ...styles.primaryButton,
                      opacity: !apiKeyInput.trim() || saving ? 0.5 : 1,
                    }}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ClaudeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M17.308 6.136a.3.3 0 0 0-.417-.139l-4.381 2.12a.3.3 0 0 0-.164.268v7.23a.3.3 0 0 0 .442.265l4.381-2.34a.3.3 0 0 0 .158-.265V6.406a.3.3 0 0 0-.019-.13z" />
      <path d="M11.654 3.07a.3.3 0 0 0-.308 0L3.882 7.284a.3.3 0 0 0-.152.261v8.91a.3.3 0 0 0 .152.261l7.464 4.214a.3.3 0 0 0 .308 0l7.464-4.214a.3.3 0 0 0 .152-.261v-8.91a.3.3 0 0 0-.152-.261zm-4.19 13.504L4.83 15.062V8.538l5.018 2.718v7.028zm.614-8.218L3.9 5.775 11.5 1.482l4.178 2.58z" />
    </svg>
  )
}

function VercelIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 76 65" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem' },
  title: { fontSize: '1.875rem', fontWeight: 600, marginBottom: '0.5rem' },
  description: { color: 'var(--ds-gray-600)', fontSize: '0.9375rem' },
  primaryButton: { display: 'inline-flex', alignItems: 'center', padding: '0.625rem 1.25rem', background: 'var(--ds-gray-1000)', color: 'var(--ds-background-100)', border: 'none', borderRadius: 6, fontSize: '0.875rem', fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' },
  projectCard: { padding: '1.5rem', border: '1px solid var(--ds-gray-200)', borderRadius: 8, background: 'var(--ds-background-100)' },
  projectName: { fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' },
  projectMeta: { fontSize: '0.8125rem', color: 'var(--ds-gray-600)' },
  templateBadge: { display: 'inline-block', padding: '0.125rem 0.5rem', fontSize: '0.75rem', fontWeight: 500, color: 'var(--ds-gray-700)', background: 'var(--ds-gray-100)', border: '1px solid var(--ds-gray-200)', borderRadius: 9999 },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', border: '1px dashed var(--ds-gray-300)', borderRadius: 12, background: 'var(--ds-gray-50)' },
  emptyTitle: { fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' },
  emptyDescription: { color: 'var(--ds-gray-600)', fontSize: '0.875rem', textAlign: 'center' },

  // Claude status badges
  connectedBadge: { display: 'inline-block', padding: '0.125rem 0.5rem', fontSize: '0.75rem', fontWeight: 500, color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 9999 },
  disconnectedBadge: { display: 'inline-block', padding: '0.125rem 0.5rem', fontSize: '0.75rem', fontWeight: 500, color: 'var(--ds-gray-600)', background: 'var(--ds-gray-100)', border: '1px solid var(--ds-gray-200)', borderRadius: 9999 },
  loadingBadge: { display: 'inline-block', padding: '0.125rem 0.5rem', fontSize: '0.75rem', fontWeight: 500, color: 'var(--ds-gray-600)', background: 'var(--ds-gray-50)', border: '1px solid var(--ds-gray-200)', borderRadius: 9999 },

  // Modal
  modalOverlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { background: 'var(--ds-background-100)', borderRadius: 12, padding: '2rem', width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' },
  closeButton: { background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--ds-gray-600)', padding: '0.25rem', lineHeight: 1 },
  errorBanner: { padding: '0.625rem 0.875rem', marginBottom: '1rem', fontSize: '0.8125rem', color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6 },
  label: { display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--ds-gray-700)' },
  input: { padding: '0.625rem 0.75rem', fontSize: '0.875rem', border: '1px solid var(--ds-gray-300)', borderRadius: 6, fontFamily: 'inherit', color: 'var(--ds-gray-1000)', background: 'var(--ds-background-100)', boxSizing: 'border-box' as const },
  dangerButton: { display: 'inline-flex', alignItems: 'center', padding: '0.5rem 1rem', background: 'none', border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626', fontSize: '0.875rem', fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer' },
}
