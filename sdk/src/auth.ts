export interface ViagenUser {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
}

export interface OrgInfo {
  id: string
  name: string
  role: string
}

export interface AuthResult {
  authenticated: true
  user: ViagenUser
  organizations: OrgInfo[]
}

export interface AuthClient {
  /** Redirect the browser to a provider login page. */
  login(provider?: 'google' | 'github' | 'microsoft'): void
  /** Get the current authenticated user. Returns null if not authenticated. */
  me(): Promise<(ViagenUser & { organizations: OrgInfo[] }) | null>
  /** Log out the current user. */
  logout(): Promise<void>
}

export function createAuthClient(baseUrl: string): AuthClient {
  return {
    login(provider = 'github') {
      window.location.href = `${baseUrl}/api/auth/login/${provider}`
    },

    async me() {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        credentials: 'include',
      })

      if (!res.ok) return null

      const data: AuthResult = await res.json()
      if (!data.authenticated) return null

      return { ...data.user, organizations: data.organizations }
    },

    async logout() {
      await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
      window.location.reload()
    },
  }
}
