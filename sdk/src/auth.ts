export interface ViagenUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  profilePictureUrl: string | null
}

export interface AuthResult {
  authenticated: true
  user: ViagenUser
  sessionId: string
  organizationId?: string
}

export interface AuthClient {
  /** Redirect the browser to the login page. */
  login(): void
  /** Get the current authenticated user. Returns null if not authenticated. */
  me(): Promise<ViagenUser | null>
  /** Log out the current user. Optionally redirects to WorkOS logout. */
  logout(options?: { redirect?: boolean }): Promise<void>
}

export function createAuthClient(baseUrl: string): AuthClient {
  return {
    login() {
      window.location.href = `${baseUrl}/auth/login`
    },

    async me() {
      const res = await fetch(`${baseUrl}/auth/me`, {
        credentials: 'include',
      })

      if (!res.ok) return null

      const data: AuthResult = await res.json()
      return data.authenticated ? data.user : null
    },

    async logout({ redirect = true } = {}) {
      const res = await fetch(`${baseUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })

      if (redirect && res.ok) {
        const { url } = await res.json()
        if (url) window.location.href = url
      }
    },
  }
}
