import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'

export interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
}

export interface Organization {
  id: string
  name: string
  role: string
}

interface AuthContextValue {
  user: User
  organizations: Organization[]
  currentOrg: Organization
  setCurrentOrg: (org: Organization) => void
  refreshAuth: () => Promise<void>
  logout: () => Promise<void>
}

type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | {
      status: 'authenticated'
      user: User
      organizations: Organization[]
      refreshAuth: () => Promise<void>
      logout: () => Promise<void>
    }

const AuthContext = createContext<AuthContextValue | null>(null)

const ORG_STORAGE_KEY = 'viagen-current-org'

function resolveCurrentOrg(organizations: Organization[]): Organization {
  const storedId = localStorage.getItem(ORG_STORAGE_KEY)
  if (storedId) {
    const found = organizations.find((o) => o.id === storedId)
    if (found) return found
  }
  return organizations[0]
}

export function AuthProvider({ children }: { children: (state: AuthState) => ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [currentOrg, setCurrentOrgState] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  const fetchAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      if (!res.ok) {
        setAuthenticated(false)
        setUser(null)
        setOrganizations([])
        setCurrentOrgState(null)
        return
      }
      const data = await res.json()
      if (!data.authenticated) {
        setAuthenticated(false)
        setUser(null)
        setOrganizations([])
        setCurrentOrgState(null)
        return
      }
      setAuthenticated(true)
      setUser(data.user)
      setOrganizations(data.organizations)
      if (data.organizations.length > 0) {
        const org = resolveCurrentOrg(data.organizations)
        setCurrentOrgState(org)
        localStorage.setItem(ORG_STORAGE_KEY, org.id)
      }
    } catch {
      setAuthenticated(false)
      setUser(null)
      setOrganizations([])
      setCurrentOrgState(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAuth()
  }, [fetchAuth])

  const setCurrentOrg = useCallback((org: Organization) => {
    setCurrentOrgState(org)
    localStorage.setItem(ORG_STORAGE_KEY, org.id)
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    localStorage.removeItem(ORG_STORAGE_KEY)
    setAuthenticated(false)
    setUser(null)
    setOrganizations([])
    setCurrentOrgState(null)
  }, [])

  // Build state for render prop
  let state: AuthState
  if (loading) {
    state = { status: 'loading' }
  } else if (!authenticated || !user) {
    state = { status: 'unauthenticated' }
  } else {
    state = {
      status: 'authenticated',
      user,
      organizations,
      refreshAuth: fetchAuth,
      logout,
    }
  }

  // Only provide context when we have a selected org
  if (state.status === 'authenticated' && currentOrg) {
    return (
      <AuthContext.Provider
        value={{
          user: state.user,
          organizations: state.organizations,
          currentOrg,
          setCurrentOrg,
          refreshAuth: fetchAuth,
          logout,
        }}
      >
        {children(state)}
      </AuthContext.Provider>
    )
  }

  return <>{children(state)}</>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an authenticated AuthProvider')
  return ctx
}
