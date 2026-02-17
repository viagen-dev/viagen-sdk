export function Settings() {
  return (
    <div>
      <h1 style={styles.title}>Settings</h1>
      <p style={styles.description}>Manage your account and preferences</p>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Profile</h2>
        <div style={styles.card}>
          <div style={styles.field}>
            <label style={styles.label}>Name</label>
            <input
              type="text"
              placeholder="Your name"
              style={styles.input}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              placeholder="your@email.com"
              style={styles.input}
            />
          </div>
          <button style={styles.saveButton}>Save Changes</button>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>API Keys</h2>
        <div style={styles.card}>
          <p style={styles.cardDescription}>
            Manage your API keys for authentication
          </p>
          <button style={styles.createButton}>Generate New Key</button>
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

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: '1.875rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  description: {
    color: 'var(--ds-gray-600)',
    fontSize: '0.9375rem',
    marginBottom: '2rem',
  },
  section: {
    marginBottom: '2rem',
  },
  sectionTitle: {
    fontSize: '1.125rem',
    fontWeight: 600,
    marginBottom: '1rem',
  },
  card: {
    padding: '1.5rem',
    border: '1px solid var(--ds-gray-200)',
    borderRadius: 8,
    background: 'var(--ds-background-100)',
  },
  field: {
    marginBottom: '1.25rem',
  },
  label: {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: 500,
    marginBottom: '0.5rem',
    color: 'var(--ds-gray-700)',
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
  },
  cardDescription: {
    fontSize: '0.875rem',
    color: 'var(--ds-gray-600)',
    marginBottom: '1rem',
  },
  saveButton: {
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
  createButton: {
    padding: '0.5rem 1rem',
    background: 'none',
    border: '1px solid var(--ds-gray-300)',
    borderRadius: 6,
    color: 'var(--ds-gray-700)',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'border-color 0.15s ease',
  },
  dangerCard: {
    padding: '1.5rem',
    border: '1px solid #ef4444',
    borderRadius: 8,
    background: '#fef2f2',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dangerTitle: {
    fontSize: '0.9375rem',
    fontWeight: 600,
    marginBottom: '0.25rem',
    color: '#991b1b',
  },
  dangerDescription: {
    fontSize: '0.8125rem',
    color: '#7f1d1d',
  },
  dangerButton: {
    padding: '0.5rem 1rem',
    background: '#ef4444',
    color: '#ffffff',
    border: 'none',
    borderRadius: 6,
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
}
