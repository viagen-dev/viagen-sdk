export function Projects() {
  return (
    <div>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Projects</h1>
          <p style={styles.description}>Manage your viagen projects</p>
        </div>
        <button style={styles.createButton}>
          Create Project
        </button>
      </div>

      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>📦</div>
        <h3 style={styles.emptyTitle}>No projects yet</h3>
        <p style={styles.emptyDescription}>
          Get started by creating your first project
        </p>
        <button style={styles.createButtonPrimary}>
          Create Project
        </button>
      </div>
    </div>
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
  createButton: {
    padding: '0.625rem 1rem',
    background: 'var(--ds-gray-1000)',
    color: 'var(--ds-background-100)',
    border: 'none',
    borderRadius: 6,
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'opacity 0.15s ease',
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
    marginBottom: '1.5rem',
    textAlign: 'center',
  },
  createButtonPrimary: {
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
  },
}
