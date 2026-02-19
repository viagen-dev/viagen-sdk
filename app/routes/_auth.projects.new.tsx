import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router'

const TEMPLATES = [
  {
    id: 'react-router',
    name: 'React Router',
    description: 'Full-stack React with SSR, loaders, and actions',
    framework: 'React',
  },
]

type Mode = 'template' | 'import'

interface VercelProject {
  id: string
  name: string
  framework: string | null
  link?: { type: string; org: string; repo: string }
}

export default function NewProject() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [mode, setMode] = useState<Mode>('template')
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Import state
  const [vercelProjects, setVercelProjects] = useState<VercelProject[]>([])
  const [vercelLoading, setVercelLoading] = useState(false)
  const [vercelError, setVercelError] = useState<string | null>(null)
  const [selectedVercel, setSelectedVercel] = useState<VercelProject | null>(null)

  useEffect(() => {
    if (mode === 'import' && vercelProjects.length === 0 && !vercelLoading) {
      loadVercelProjects()
    }
  }, [mode])

  const loadVercelProjects = async () => {
    setVercelLoading(true)
    setVercelError(null)
    try {
      const res = await fetch('/api/vercel/projects?limit=50', { credentials: 'include' })
      if (res.status === 400) {
        setVercelError('not_connected')
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

  const selectVercelProject = (vp: VercelProject) => {
    setSelectedVercel(vp)
    if (!name) setName(vp.name)
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    setCreating(true)
    setError(null)

    try {
      const body: Record<string, string | null> = { name: name.trim() }

      if (mode === 'template') {
        body.templateId = selectedTemplate
      } else if (selectedVercel) {
        body.vercelProjectId = selectedVercel.id
        if (selectedVercel.link?.org && selectedVercel.link?.repo) {
          body.githubRepo = `${selectedVercel.link.org}/${selectedVercel.link.repo}`
        }
      }

      const res = await fetch('/api/projects', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? 'Failed to create project')
        return
      }

      navigate('/projects')
    } catch {
      setError('Something went wrong')
    } finally {
      setCreating(false)
    }
  }

  const canCreate =
    name.trim().length > 0 &&
    (mode === 'template' || selectedVercel !== null)

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <Link to="/projects" style={styles.backLink}>&larr; Projects</Link>
        <h1 style={styles.title}>New Project</h1>
      </div>

      {/* Project name — always visible */}
      <div style={styles.field}>
        <label style={styles.label}>Project Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && canCreate && handleCreate()}
          placeholder="my-app"
          style={styles.input}
          autoFocus
        />
      </div>

      {/* Mode tabs */}
      <div style={styles.tabs}>
        <button
          onClick={() => setMode('template')}
          style={{ ...styles.tab, ...(mode === 'template' ? styles.tabActive : {}) }}
        >
          Start from Template
        </button>
        <button
          onClick={() => setMode('import')}
          style={{ ...styles.tab, ...(mode === 'import' ? styles.tabActive : {}) }}
        >
          Import Existing
        </button>
      </div>

      {/* Template selection */}
      {mode === 'template' && (
        <div style={{ marginBottom: '2rem' }}>
          <p style={styles.sectionDescription}>
            Start with a pre-configured template. More coming soon.
          </p>
          <div style={styles.templateGrid}>
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t.id)}
                style={{
                  ...styles.templateCard,
                  borderColor: selectedTemplate === t.id ? 'var(--ds-gray-1000)' : 'var(--ds-gray-200)',
                }}
              >
                <div style={styles.templateHeader}>
                  <ReactRouterIcon />
                  <span style={styles.templateName}>{t.name}</span>
                  {selectedTemplate === t.id && (
                    <span style={styles.checkmark}>&#10003;</span>
                  )}
                </div>
                <p style={styles.templateDescription}>{t.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Import from Vercel */}
      {mode === 'import' && (
        <div style={{ marginBottom: '2rem' }}>
          <p style={styles.sectionDescription}>
            Import an existing project from Vercel.
          </p>

          {vercelLoading && (
            <p style={{ fontSize: '0.875rem', color: 'var(--ds-gray-600)', padding: '1rem 0' }}>
              Loading Vercel projects...
            </p>
          )}

          {vercelError === 'not_connected' && (
            <div style={styles.notice}>
              <p style={{ fontSize: '0.875rem', color: 'var(--ds-gray-600)', marginBottom: '0.75rem' }}>
                Connect your Vercel account to import projects.
              </p>
              <Link to="/settings" style={styles.secondaryButton}>Go to Settings</Link>
            </div>
          )}

          {vercelError === 'failed' && (
            <p style={{ fontSize: '0.875rem', color: '#ef4444', padding: '1rem 0' }}>
              Failed to load Vercel projects.
            </p>
          )}

          {!vercelLoading && !vercelError && vercelProjects.length === 0 && (
            <p style={{ fontSize: '0.875rem', color: 'var(--ds-gray-600)', padding: '1rem 0' }}>
              No Vercel projects found.
            </p>
          )}

          {!vercelLoading && !vercelError && vercelProjects.length > 0 && (
            <div style={{ maxHeight: 360, overflow: 'auto' }}>
              {vercelProjects.map((vp) => (
                <button
                  key={vp.id}
                  onClick={() => selectVercelProject(vp)}
                  style={{
                    ...styles.pickerItem,
                    borderColor: selectedVercel?.id === vp.id ? 'var(--ds-gray-1000)' : 'var(--ds-gray-200)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>{vp.name}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--ds-gray-600)' }}>
                        {vp.framework ?? 'No framework'}
                        {vp.link ? ` \u00b7 ${vp.link.org}/${vp.link.repo}` : ''}
                      </p>
                    </div>
                    {selectedVercel?.id === vp.id && (
                      <span style={styles.checkmark}>&#10003;</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && <p style={{ fontSize: '0.8125rem', color: '#ef4444', marginBottom: '1rem' }}>{error}</p>}

      {/* Create button */}
      <button
        onClick={handleCreate}
        disabled={!canCreate || creating}
        style={{ ...styles.primaryButton, width: '100%', opacity: !canCreate || creating ? 0.5 : 1 }}
      >
        {creating ? 'Creating...' : mode === 'template' ? 'Create Project' : 'Import Project'}
      </button>
    </div>
  )
}

function ReactRouterIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="6" cy="18" r="3" fill="var(--ds-gray-1000)" />
      <circle cx="18" cy="18" r="3" fill="var(--ds-gray-1000)" />
      <circle cx="12" cy="6" r="3" fill="var(--ds-gray-1000)" />
      <path d="M12 9v3M9 16.5L7.5 15M15 16.5l1.5-1.5" stroke="var(--ds-gray-1000)" strokeWidth="1.5" />
    </svg>
  )
}

const styles: Record<string, React.CSSProperties> = {
  backLink: { fontSize: '0.8125rem', color: 'var(--ds-gray-600)', textDecoration: 'none', display: 'inline-block', marginBottom: '0.5rem' },
  title: { fontSize: '1.875rem', fontWeight: 600 },
  field: { marginBottom: '1.5rem' },
  label: { display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--ds-gray-700)' },
  input: { width: '100%', padding: '0.625rem 0.75rem', fontSize: '0.875rem', border: '1px solid var(--ds-gray-300)', borderRadius: 6, fontFamily: 'inherit', color: 'var(--ds-gray-1000)', background: 'var(--ds-background-100)', boxSizing: 'border-box' as const },
  tabs: { display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--ds-gray-200)', paddingBottom: 0 },
  tab: { padding: '0.625rem 1rem', background: 'none', border: 'none', borderBottom: '2px solid transparent', fontSize: '0.875rem', fontFamily: 'inherit', fontWeight: 500, color: 'var(--ds-gray-600)', cursor: 'pointer', marginBottom: '-1px', transition: 'color 0.15s ease' },
  tabActive: { color: 'var(--ds-gray-1000)', borderBottomColor: 'var(--ds-gray-1000)' },
  sectionDescription: { fontSize: '0.8125rem', color: 'var(--ds-gray-600)', marginBottom: '1rem' },
  templateGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' },
  templateCard: { textAlign: 'left' as const, padding: '1.25rem', background: 'var(--ds-background-100)', border: '2px solid var(--ds-gray-200)', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.15s ease' },
  templateHeader: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' },
  templateName: { fontSize: '0.9375rem', fontWeight: 600 },
  templateDescription: { fontSize: '0.8125rem', color: 'var(--ds-gray-600)', lineHeight: 1.4 },
  checkmark: { marginLeft: 'auto', fontSize: '0.875rem', fontWeight: 700, color: 'var(--ds-gray-1000)' },
  notice: { padding: '1.5rem', border: '1px solid var(--ds-gray-200)', borderRadius: 8, textAlign: 'center' as const },
  pickerItem: { width: '100%', display: 'block', textAlign: 'left' as const, padding: '0.75rem 1rem', background: 'none', border: '2px solid var(--ds-gray-200)', borderRadius: 6, cursor: 'pointer', marginBottom: '0.5rem', fontFamily: 'inherit', transition: 'border-color 0.15s ease' },
  primaryButton: { padding: '0.625rem 1.25rem', background: 'var(--ds-gray-1000)', color: 'var(--ds-background-100)', border: 'none', borderRadius: 6, fontSize: '0.875rem', fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer', transition: 'opacity 0.15s ease' },
  secondaryButton: { display: 'inline-flex', alignItems: 'center', padding: '0.5rem 1rem', background: 'none', border: '1px solid var(--ds-gray-300)', borderRadius: 6, color: 'var(--ds-gray-700)', fontSize: '0.8125rem', fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer', textDecoration: 'none' },
}
