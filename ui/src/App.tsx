import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Projects } from './pages/Projects'
import { Settings } from './pages/Settings'

interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
}

export function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.authenticated) setUser(data.user)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <p style={styles.muted}>Loading...</p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route element={<Layout user={user} onLogout={() => setUser(null)} />}>
          <Route
            path="/"
            element={user ? <Dashboard /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/projects"
            element={user ? <Projects /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/settings"
            element={user ? <Settings /> : <Navigate to="/login" replace />}
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

const styles: Record<string, React.CSSProperties> = {
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
  },
  muted: {
    color: 'var(--ds-gray-600)',
    fontSize: '0.8125rem',
  },
}
