import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { apiFetch } from '../lib/api'

interface Project {
  id: string
  name: string
  vercelProjectId: string | null
  githubRepo: string | null
  createdAt: string
}

interface VercelProject {
  id: string
  name: string
  framework: string | null
  link?: { type: string; org: string; repo: string }
}

interface GitHubRepo {
  id: number
  fullName: string
  name: string
  owner: string
  private: boolean
}

export function Projects() {
  const navigate = useNavigate()
  const { currentOrg } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  // Vercel linking (legacy projects)
  const [linkingProjectId, setLinkingProjectId] = useState<string | null>(null)
  const [vercelProjects, setVercelProjects] = useState<VercelProject[]>([])
  const [vercelLoading, setVercelLoading] = useState(false)
  const [vercelError, setVercelError] = useState<string | null>(null)

  // New project modal
  const [showCreate, setShowCreate] = useState(false)
  const [createStep, setCreateStep] = useState<'vercel' | 'confirm'>('vercel')
  const [createVercelProjects, setCreateVercelProjects] = useState<VercelProject[]>([])
  const [createVercelLoading, setCreateVercelLoading] = useState(false)
  const [createVercelError, setCreateVercelError] = useState<string | null>(null)
  const [selectedVercel, setSelectedVercel] = useState<VercelProject | null>(null)
  const [projectName, setProjectName] = useState('')
  const [githubRepo, setGithubRepo] = useState('')
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([])
  const [githubLoading, setGithubLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    apiFetch('/api/projects', currentOrg.id)
      .then((r) => (r.ok ? r.json() : { projects: [] }))
      .then((data) => setProjects(data.projects))
      .finally(() => setLoading(false))
  }, [currentOrg.id])

  // --- New Project Modal ---

  const openCreateModal = async () => {
    setShowCreate(true)
    setCreateStep('vercel')
    setSelectedVercel(null)
    setProjectName('')
    setGithubRepo('')
    setCreateVercelError(null)
    setCreateVercelLoading(true)

    try {
      const res = await apiFetch('/api/vercel/projects?limit=50', currentOrg.id)
      if (res.status === 400) {
        setCreateVercelError('not_configured')
        return
      }
      if (!res.ok) throw new Error()
      const data = await res.json()
      setCreateVercelProjects(data.projects)
    } catch {
      setCreateVercelError('failed')
    } finally {
      setCreateVercelLoading(false)
    }
  }

  const selectVercelProject = async (vp: VercelProject) => {
    setSelectedVercel(vp)
    setProjectName(vp.name)
    setCreateStep('confirm')

    // Auto-detect GitHub repo from Vercel project link
    if (vp.link?.org && vp.link?.repo) {
      setGithubRepo(`${vp.link.org}/${vp.link.repo}`)
    } else {
      setGithubRepo('')
      // Fetch GitHub repos for manual selection
      setGithubLoading(true)
      try {
        const res = await apiFetch('/api/github/repos?per_page=50', currentOrg.id)
        if (res.ok) {
          const data = await res.json()
          setGithubRepos(data.repos)
        }
      } catch {
        // GitHub not connected or failed — user can type manually
      } finally {
        setGithubLoading(false)
      }
    }
  }

  const createProject = async () => {
    if (!projectName.trim() || !selectedVercel) return
    setCreating(true)
    try {
      const res = await apiFetch('/api/projects', currentOrg.id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName.trim(),
          vercelProjectId: selectedVercel.id,
          githubRepo: githubRepo.trim() || null,
        }),
      })
      if (res.ok) {
        const { project } = await res.json()
        setProjects((prev) => [...prev, project])
        setShowCreate(false)
      }
    } finally {
      setCreating(false)
    }
  }

  // --- Legacy Vercel Linking ---

  const openVercelPicker = async (projectId: string) => {
    setLinkingProjectId(projectId)
    setVercelLoading(true)
    setVercelError(null)
    try {
      const res = await apiFetch('/api/vercel/projects?limit=20', currentOrg.id)
      if (res.status === 400) {
        setVercelError('not_configured')
        return
      }
      if (res.status === 401) {
        setVercelError('invalid_token')
        return
      }
      if (!res.ok) throw new Error()
      const data = await res.json()
      setVercelProjects(data.projects)
    } catch {
      setVercelError('failed')
    } finally {
      setVercelLoading(false)
    }
  }

  const linkVercelProject = async (vercelProjectId: string) => {
    if (!linkingProjectId) return
    const res = await apiFetch(`/api/projects/${linkingProjectId}`, currentOrg.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vercelProjectId }),
    })
    if (res.ok) {
      const { project } = await res.json()
      setProjects((prev) => prev.map((p) => (p.id === project.id ? project : p)))
    }
    setLinkingProjectId(null)
    setVercelProjects([])
  }

  const unlinkVercelProject = async (projectId: string) => {
    const res = await apiFetch(`/api/projects/${projectId}`, currentOrg.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vercelProjectId: null }),
    })
    if (res.ok) {
      const { project } = await res.json()
      setProjects((prev) => prev.map((p) => (p.id === project.id ? project : p)))
    }
  }

  if (loading) {
    return (
      <div>
        <h1 style={styles.title}>Projects</h1>
        <p style={styles.description}>Loading...</p>
      </div>
    )
  }

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Projects</h1>
          <p style={styles.description}>Manage your viagen projects</p>
        </div>
        <button onClick={openCreateModal} style={styles.primaryButton}>
          New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📦</div>
          <h3 style={styles.emptyTitle}>No projects yet</h3>
          <p style={styles.emptyDescription}>
            Create a project to get started
          </p>
        </div>
      ) : (
        <div style={styles.grid}>
          {projects.map((project) => (
            <div key={project.id} style={styles.projectCard}>
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={styles.projectName}>{project.name}</h3>
                <p style={styles.projectMeta}>
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </div>

              {project.vercelProjectId && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: project.githubRepo ? '0.5rem' : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <VercelIcon />
                    <span style={{ fontSize: '0.8125rem', color: 'var(--ds-gray-600)' }}>
                      {project.vercelProjectId}
                    </span>
                  </div>
                  <button
                    onClick={() => unlinkVercelProject(project.id)}
                    style={styles.textButton}
                  >
                    Unlink
                  </button>
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

              {!project.vercelProjectId && (
                <button
                  onClick={() => openVercelPicker(project.id)}
                  style={styles.secondaryButton}
                >
                  <VercelIcon /> Link Vercel Project
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New Project Modal */}
      {showCreate && (
        <div style={styles.overlay} onClick={() => setShowCreate(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            {createStep === 'vercel' && (
              <>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  New Project
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--ds-gray-600)', marginBottom: '1rem' }}>
                  Select a Vercel project to link
                </p>

                {createVercelLoading && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--ds-gray-600)' }}>
                    Loading Vercel projects...
                  </p>
                )}

                {createVercelError === 'not_configured' && (
                  <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                    <p style={{ fontSize: '0.875rem', color: 'var(--ds-gray-600)', marginBottom: '1rem' }}>
                      Connect your Vercel account first
                    </p>
                    <button onClick={() => { setShowCreate(false); navigate('/settings') }} style={styles.primaryButton}>
                      Go to Settings
                    </button>
                  </div>
                )}

                {createVercelError === 'failed' && (
                  <p style={{ fontSize: '0.875rem', color: '#ef4444' }}>
                    Failed to load Vercel projects.
                  </p>
                )}

                {!createVercelLoading && !createVercelError && createVercelProjects.length === 0 && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--ds-gray-600)' }}>
                    No Vercel projects found.
                  </p>
                )}

                {!createVercelLoading && !createVercelError && createVercelProjects.length > 0 && (
                  <div style={{ maxHeight: 400, overflow: 'auto' }}>
                    {createVercelProjects.map((vp) => (
                      <button
                        key={vp.id}
                        onClick={() => selectVercelProject(vp)}
                        style={styles.pickerItem}
                      >
                        <div>
                          <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>{vp.name}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--ds-gray-600)' }}>
                            {vp.framework ?? 'No framework'}
                            {vp.link ? ` · ${vp.link.org}/${vp.link.repo}` : ''}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setShowCreate(false)}
                  style={{ ...styles.secondaryButton, marginTop: '1rem', width: '100%' }}
                >
                  Cancel
                </button>
              </>
            )}

            {createStep === 'confirm' && selectedVercel && (
              <>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
                  Confirm Project
                </h3>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={styles.label}>Project Name</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    style={styles.input}
                    autoFocus
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={styles.label}>Vercel Project</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 0.75rem', background: 'var(--ds-gray-50)', border: '1px solid var(--ds-gray-200)', borderRadius: 6 }}>
                    <VercelIcon />
                    <span style={{ fontSize: '0.875rem' }}>{selectedVercel.name}</span>
                    <button
                      onClick={() => setCreateStep('vercel')}
                      style={{ ...styles.textButton, marginLeft: 'auto' }}
                    >
                      Change
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={styles.label}>GitHub Repository</label>
                  {githubLoading ? (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--ds-gray-600)' }}>Loading repos...</p>
                  ) : githubRepos.length > 0 && !githubRepo ? (
                    <select
                      value={githubRepo}
                      onChange={(e) => setGithubRepo(e.target.value)}
                      style={{ ...styles.input, cursor: 'pointer' }}
                    >
                      <option value="">Select a repository (optional)</option>
                      {githubRepos.map((r) => (
                        <option key={r.id} value={r.fullName}>{r.fullName}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={githubRepo}
                      onChange={(e) => setGithubRepo(e.target.value)}
                      placeholder="owner/repo (optional)"
                      style={styles.input}
                    />
                  )}
                  {githubRepo && selectedVercel.link && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--ds-gray-500)', marginTop: '0.375rem' }}>
                      Auto-detected from Vercel project
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setCreateStep('vercel')}
                    style={{ ...styles.secondaryButton, flex: 1 }}
                  >
                    Back
                  </button>
                  <button
                    onClick={createProject}
                    disabled={creating || !projectName.trim()}
                    style={{ ...styles.primaryButton, flex: 1, opacity: creating || !projectName.trim() ? 0.5 : 1 }}
                  >
                    {creating ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Legacy Vercel linking overlay */}
      {linkingProjectId && (
        <div style={styles.overlay} onClick={() => { setLinkingProjectId(null); setVercelProjects([]) }}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
              Link Vercel Project
            </h3>

            {vercelLoading && (
              <p style={{ fontSize: '0.875rem', color: 'var(--ds-gray-600)' }}>
                Loading Vercel projects...
              </p>
            )}

            {vercelError === 'not_configured' && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--ds-gray-600)', marginBottom: '1rem' }}>
                  Connect your Vercel account first
                </p>
                <button onClick={() => navigate('/settings')} style={styles.primaryButton}>
                  Go to Settings
                </button>
              </div>
            )}

            {vercelError === 'invalid_token' && (
              <p style={{ fontSize: '0.875rem', color: '#ef4444' }}>
                Vercel token is invalid. Update it in Settings.
              </p>
            )}

            {vercelError === 'failed' && (
              <p style={{ fontSize: '0.875rem', color: '#ef4444' }}>
                Failed to load Vercel projects.
              </p>
            )}

            {!vercelLoading && !vercelError && vercelProjects.length === 0 && (
              <p style={{ fontSize: '0.875rem', color: 'var(--ds-gray-600)' }}>
                No Vercel projects found.
              </p>
            )}

            {!vercelLoading && !vercelError && vercelProjects.length > 0 && (
              <div style={{ maxHeight: 400, overflow: 'auto' }}>
                {vercelProjects.map((vp) => (
                  <button
                    key={vp.id}
                    onClick={() => linkVercelProject(vp.id)}
                    style={styles.pickerItem}
                  >
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>{vp.name}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--ds-gray-600)' }}>
                        {vp.framework ?? 'No framework'}
                        {vp.link ? ` · ${vp.link.org}/${vp.link.repo}` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => { setLinkingProjectId(null); setVercelProjects([]) }}
              style={{ ...styles.secondaryButton, marginTop: '1rem', width: '100%' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
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
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '2rem',
  },
  title: {
    fontSize: '1.875rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  description: {
    color: 'var(--ds-gray-600)',
    fontSize: '0.9375rem',
  },
  label: {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: 500,
    marginBottom: '0.5rem',
    color: 'var(--ds-gray-700)',
  },
  card: {
    padding: '1rem 1.5rem',
    border: '1px solid var(--ds-gray-200)',
    borderRadius: 8,
    background: 'var(--ds-background-100)',
  },
  input: {
    width: '100%',
    padding: '0.625rem 0.75rem',
    fontSize: '0.875rem',
    border: '1px solid var(--ds-gray-300)',
    borderRadius: 6,
    fontFamily: 'inherit',
    color: 'var(--ds-gray-1000)',
    background: 'var(--ds-background-100)',
    boxSizing: 'border-box',
  },
  primaryButton: {
    padding: '0.625rem 1.25rem',
    background: 'var(--ds-gray-1000)',
    color: 'var(--ds-background-100)',
    border: 'none',
    borderRadius: 6,
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'opacity 0.15s ease',
    whiteSpace: 'nowrap',
  },
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    background: 'none',
    border: '1px solid var(--ds-gray-300)',
    borderRadius: 6,
    color: 'var(--ds-gray-700)',
    fontSize: '0.8125rem',
    fontFamily: 'inherit',
    fontWeight: 500,
    cursor: 'pointer',
  },
  textButton: {
    background: 'none',
    border: 'none',
    color: 'var(--ds-gray-600)',
    fontSize: '0.75rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '1rem',
  },
  projectCard: {
    padding: '1.5rem',
    border: '1px solid var(--ds-gray-200)',
    borderRadius: 8,
    background: 'var(--ds-background-100)',
  },
  projectName: {
    fontSize: '1rem',
    fontWeight: 600,
    marginBottom: '0.25rem',
  },
  projectMeta: {
    fontSize: '0.8125rem',
    color: 'var(--ds-gray-600)',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 2rem',
    border: '1px dashed var(--ds-gray-300)',
    borderRadius: 12,
    background: 'var(--ds-gray-50)',
  },
  emptyIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  emptyTitle: {
    fontSize: '1.125rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  emptyDescription: {
    color: 'var(--ds-gray-600)',
    fontSize: '0.875rem',
    textAlign: 'center',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  modal: {
    background: 'var(--ds-background-100)',
    border: '1px solid var(--ds-gray-200)',
    borderRadius: 12,
    padding: '1.5rem',
    width: '100%',
    maxWidth: 480,
    maxHeight: '80vh',
    overflow: 'auto',
  },
  pickerItem: {
    width: '100%',
    display: 'block',
    textAlign: 'left',
    padding: '0.75rem 1rem',
    background: 'none',
    border: '1px solid var(--ds-gray-200)',
    borderRadius: 6,
    cursor: 'pointer',
    marginBottom: '0.5rem',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s ease',
  },
}
