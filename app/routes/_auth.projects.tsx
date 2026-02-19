import { Link } from 'react-router'
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

export default function Projects({ loaderData }: { loaderData: { projects: Project[] } }) {
  const { projects } = loaderData

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
          {projects.map((project) => (
            <div key={project.id} style={styles.projectCard}>
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={styles.projectName}>{project.name}</h3>
                <p style={styles.projectMeta}>
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </div>

              {project.templateId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={styles.badge}>{project.templateId}</span>
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
            </div>
          ))}
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
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem' },
  title: { fontSize: '1.875rem', fontWeight: 600, marginBottom: '0.5rem' },
  description: { color: 'var(--ds-gray-600)', fontSize: '0.9375rem' },
  primaryButton: { display: 'inline-flex', alignItems: 'center', padding: '0.625rem 1.25rem', background: 'var(--ds-gray-1000)', color: 'var(--ds-background-100)', border: 'none', borderRadius: 6, fontSize: '0.875rem', fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' },
  projectCard: { padding: '1.5rem', border: '1px solid var(--ds-gray-200)', borderRadius: 8, background: 'var(--ds-background-100)' },
  projectName: { fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' },
  projectMeta: { fontSize: '0.8125rem', color: 'var(--ds-gray-600)' },
  badge: { display: 'inline-block', padding: '0.125rem 0.5rem', fontSize: '0.75rem', fontWeight: 500, color: 'var(--ds-gray-700)', background: 'var(--ds-gray-100)', border: '1px solid var(--ds-gray-200)', borderRadius: 9999 },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', border: '1px dashed var(--ds-gray-300)', borderRadius: 12, background: 'var(--ds-gray-50)' },
  emptyTitle: { fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' },
  emptyDescription: { color: 'var(--ds-gray-600)', fontSize: '0.875rem', textAlign: 'center' },
}
