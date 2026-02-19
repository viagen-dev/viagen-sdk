import type { RequestFn } from './projects.js'

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

export interface ApiTokenInfo {
  id: string
  name: string
  prefix: string
  expiresAt: string
  lastUsedAt: string | null
  createdAt: string
}

export interface AuthClient {
  /** Redirect the browser to a provider login page. (Web only) */
  login(provider?: 'google' | 'github' | 'microsoft'): void
  /** Get the current authenticated user. Works with both cookie and token auth. */
  me(): Promise<(ViagenUser & { organizations: OrgInfo[] }) | null>
  /** Log out the current user. In a browser, reloads the page. */
  logout(): Promise<void>
  /**
   * CLI login: opens browser to authorize page, starts localhost server, captures token.
   * Only available in Node.js environments.
   */
  loginCli(options?: {
    port?: number
    onOpenUrl?: (url: string) => void
  }): Promise<{ token: string; expiresAt: string }>
  /** List the current user's API tokens. */
  listTokens(): Promise<ApiTokenInfo[]>
  /** Revoke an API token by its hashed ID. */
  revokeToken(tokenId: string): Promise<void>
}

export function createAuthClient(baseUrl: string, request: RequestFn): AuthClient {
  return {
    login(provider = 'github') {
      window.location.href = `${baseUrl}/api/auth/login/${provider}`
    },

    async me() {
      try {
        const data = await request<AuthResult>('/api/auth/me')
        if (!data.authenticated) return null
        return { ...data.user, organizations: data.organizations }
      } catch {
        return null
      }
    },

    async logout() {
      await request<{ success: boolean }>('/api/auth/logout', { method: 'POST' })
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
    },

    async loginCli(options = {}) {
      const { port: preferredPort, onOpenUrl } = options

      const http = await import('node:http')

      return new Promise<{ token: string; expiresAt: string }>((resolve, reject) => {
        const server = http.createServer()

        const timeout = setTimeout(() => {
          server.close()
          reject(new Error('Login timed out'))
        }, 5 * 60 * 1000)

        server.listen(preferredPort ?? 0, '127.0.0.1', () => {
          const address = server.address() as import('net').AddressInfo
          const port = address.port
          const loginUrl = `${baseUrl}/cli/authorize?port=${port}`

          if (onOpenUrl) {
            onOpenUrl(loginUrl)
          } else {
            // Try platform-specific browser open via child_process
            import('node:child_process')
              .then(({ exec }) => {
                const cmd =
                  process.platform === 'darwin'
                    ? `open "${loginUrl}"`
                    : process.platform === 'win32'
                      ? `start "${loginUrl}"`
                      : `xdg-open "${loginUrl}"`
                exec(cmd)
              })
              .catch(() => {
                console.log(`Open this URL in your browser:\n  ${loginUrl}`)
              })
          }
        })

        server.on('request', (req, res) => {
          const url = new URL(req.url!, `http://127.0.0.1`)

          if (url.pathname === '/callback') {
            const token = url.searchParams.get('token')
            const error = url.searchParams.get('error')

            if (error || !token) {
              res.writeHead(200, { 'Content-Type': 'text/html' })
              res.end(
                '<html><body style="font-family:system-ui;display:flex;justify-content:center;padding-top:40vh">' +
                  '<div><h2>Login failed</h2><p>You can close this tab.</p></div></body></html>',
              )
              clearTimeout(timeout)
              server.close()
              reject(new Error(error ?? 'No token received'))
              return
            }

            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(
              '<html><body style="font-family:system-ui;display:flex;justify-content:center;padding-top:40vh">' +
                '<div><h2>Login successful!</h2><p>You can close this tab.</p></div></body></html>',
            )
            clearTimeout(timeout)
            server.close()
            resolve({ token, expiresAt: '' })
          } else {
            res.writeHead(404)
            res.end()
          }
        })
      })
    },

    async listTokens() {
      const data = await request<{ tokens: ApiTokenInfo[] }>('/api/auth/tokens')
      return data.tokens
    },

    async revokeToken(tokenId: string) {
      await request<{ success: boolean }>('/api/auth/tokens', {
        method: 'DELETE',
        body: JSON.stringify({ tokenId }),
      })
    },
  }
}
