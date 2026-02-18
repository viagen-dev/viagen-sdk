import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/auth'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Onboarding } from './pages/Onboarding'
import { Dashboard } from './pages/Dashboard'
import { Projects } from './pages/Projects'
import { Settings } from './pages/Settings'

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {(state) => {
          if (state.status === 'loading') {
            return (
              <div style={styles.loadingContainer}>
                <p style={styles.muted}>Loading...</p>
              </div>
            )
          }

          if (state.status === 'unauthenticated') {
            return (
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            )
          }

          // Authenticated but no organizations — force onboarding (step 1: create team)
          if (state.organizations.length === 0) {
            return (
              <Routes>
                <Route
                  path="/onboarding"
                  element={
                    <Onboarding
                      onCreated={state.refreshAuth}
                      onLogout={state.logout}
                    />
                  }
                />
                <Route path="*" element={<Navigate to="/onboarding" replace />} />
              </Routes>
            )
          }

          // Authenticated with org — full app + onboarding route (for OAuth redirect return)
          const orgId = state.organizations[0].id
          return (
            <Routes>
              <Route
                path="/onboarding"
                element={
                  <Onboarding
                    onCreated={state.refreshAuth}
                    onLogout={state.logout}
                    orgId={orgId}
                  />
                }
              />
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )
        }}
      </AuthProvider>
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
