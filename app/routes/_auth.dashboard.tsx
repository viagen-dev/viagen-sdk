import { useRouteLoaderData } from 'react-router'

export default function Dashboard() {
  const parentData = useRouteLoaderData('routes/_auth') as any
  const orgName = parentData?.currentOrg?.name ?? ''

  return (
    <div>
      <h1 style={styles.title}>Dashboard</h1>
      <p style={styles.description}>Welcome to {orgName}</p>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Projects</h3>
          <p style={styles.cardValue}>0</p>
          <p style={styles.cardDescription}>Active projects</p>
        </div>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>API Calls</h3>
          <p style={styles.cardValue}>0</p>
          <p style={styles.cardDescription}>This month</p>
        </div>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Usage</h3>
          <p style={styles.cardValue}>0%</p>
          <p style={styles.cardDescription}>Of quota used</p>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  title: { fontSize: '1.875rem', fontWeight: 600, marginBottom: '0.5rem' },
  description: { color: 'var(--ds-gray-600)', fontSize: '0.9375rem', marginBottom: '2rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' },
  card: { padding: '1.5rem', border: '1px solid var(--ds-gray-200)', borderRadius: 8, background: 'var(--ds-background-100)' },
  cardTitle: { fontSize: '0.875rem', fontWeight: 500, color: 'var(--ds-gray-600)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.025em' },
  cardValue: { fontSize: '2rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--ds-gray-1000)' },
  cardDescription: { fontSize: '0.8125rem', color: 'var(--ds-gray-600)' },
}
