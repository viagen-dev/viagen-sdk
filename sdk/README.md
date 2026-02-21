# viagen-sdk

TypeScript client for the viagen platform API. Used by sandboxes, the CLI, and any external consumer that needs to talk to the platform.

## Install

```bash
npm install viagen-sdk
```

## Quick Start

### Web (cookie-based)

```ts
import { createViagen } from 'viagen-sdk'

const viagen = createViagen({ baseUrl: 'https://app.viagen.dev' })

// Redirect to login
viagen.auth.login('github')

// Get current user (uses session cookie)
const user = await viagen.auth.me()
```

### CLI / Node.js (token-based)

```ts
import { createViagen, saveCredentials, createViagenFromCredentials } from 'viagen-sdk'

// First time: open browser to authorize
const viagen = createViagen({ baseUrl: 'https://app.viagen.dev' })
const { token } = await viagen.auth.loginCli()

// Save token for future sessions
await saveCredentials({ token, baseUrl: 'https://app.viagen.dev' })

// Later: create client from stored credentials
const client = await createViagenFromCredentials()
const projects = await client.projects.list()
```

## API Reference

### `createViagen(config)`

Creates a client instance.

```ts
// Web: uses cookies
const viagen = createViagen({ baseUrl: 'http://localhost:5173' })

// CLI: uses Bearer token
const viagen = createViagen({ baseUrl: 'https://app.viagen.dev', token: 'your-api-token' })
```

| Option | Type | Description |
|---|---|---|
| `baseUrl` | `string` | Platform URL |
| `token` | `string?` | API token. When set, uses `Authorization: Bearer` instead of cookies |

### `createViagenFromCredentials(overrides?)`

Creates a client from stored credentials (`~/.config/viagen/credentials.json`). Returns `null` if no credentials found.

---

### `viagen.auth`

| Method | Description |
|---|---|
| `login(provider?)` | Redirects the browser to OAuth login. Default: `'github'`. Options: `'github'`, `'google'`, `'microsoft'`. Web only |
| `loginCli(options?)` | Opens browser to authorize, starts localhost server, captures API token. Node.js only |
| `me()` | Returns the current user + orgs, or `null` if not authenticated |
| `logout()` | Ends the session. In a browser, reloads the page |
| `listTokens()` | List the current user's API tokens |
| `revokeToken(tokenId)` | Revoke an API token by ID |

**`loginCli` options:**

```ts
{
  port?: number                      // Preferred localhost port (default: random)
  onOpenUrl?: (url: string) => void  // Custom handler to open the URL (default: system browser)
}
```

---

### `viagen.orgs`

| Method | Description |
|---|---|
| `list()` | List the current user's org memberships |
| `create({ name })` | Create a new org. The caller becomes admin |
| `addMember({ email })` | Add a member by email. Admin only |

---

### `viagen.projects`

| Method | Description |
|---|---|
| `list()` | List all projects in the current org |
| `create(input)` | Create a project. Admin only |
| `get(id)` | Get a single project by ID |
| `update(id, input)` | Update a project. Admin only |
| `delete(id)` | Delete a project. Admin only |
| `sync(input)` | Upsert a project with optional secrets. Admin only |
| `listSecrets(id)` | List all secrets for a project (project + inherited org) |
| `setSecret(id, key, value)` | Set a project secret. Syncs to Vercel if linked. Admin only |
| `deleteSecret(id, key)` | Delete a project secret. Removes from Vercel if linked. Admin only |
| `getClaudeStatus(id)` | Get Claude API key status (resolves project > org > user) |
| `setClaudeKey(id, apiKey)` | Set a project-level Anthropic API key. Admin only |
| `removeClaudeKey(id)` | Remove a project-level Anthropic API key. Admin only |

**`CreateProjectInput`**

```ts
{
  name: string
  templateId?: string        // e.g. 'react-router'
  vercelProjectId?: string   // link to existing Vercel project
  githubRepo?: string        // 'owner/repo'
}
```

**`UpdateProjectInput`**

```ts
{
  name?: string
  vercelProjectId?: string | null
  githubRepo?: string | null
}
```

**`SyncProjectInput`**

```ts
{
  id?: string                          // optional — upserts by ID if provided
  name: string
  templateId?: string
  githubRepo?: string
  secrets?: Record<string, string>     // key-value env vars to store
}
```

---

### `viagen.vercel`

| Method | Description |
|---|---|
| `integrationStatus()` | Returns `{ github: boolean, vercel: boolean }` for the current org |
| `disconnect()` | Remove the org's Vercel connection. Admin only |
| `listProjects(params?)` | List Vercel projects. Params: `{ search?, limit? }` |

> Connecting Vercel is done via OAuth redirect (`/api/integrations/vercel/start`), not through the SDK.

---

### `viagen.github`

| Method | Description |
|---|---|
| `listRepos(params?)` | List repos from the org's connected GitHub account. Params: `{ page?, perPage? }` |

> Connecting GitHub is done via OAuth redirect (`/api/integrations/github/start`), not through the SDK.

---

## Credentials

Utilities for managing stored CLI credentials (`~/.config/viagen/credentials.json`):

```ts
import { saveCredentials, loadCredentials, clearCredentials } from 'viagen-sdk'

await saveCredentials({ token: '...', baseUrl: 'https://app.viagen.dev' })
const creds = await loadCredentials()   // { token, baseUrl } | null
await clearCredentials()                // deletes the file
```

---

## Error Handling

All methods throw `ViagenApiError` on failure:

```ts
import { ViagenApiError } from 'viagen-sdk'

try {
  await viagen.projects.create({ name: 'my-app' })
} catch (err) {
  if (err instanceof ViagenApiError) {
    console.error(err.status, err.message)
  }
}
```

## API Routes

The SDK maps to these platform resource routes:

| SDK | Method | Route |
|---|---|---|
| `auth.login` | GET (redirect) | `/api/auth/login/:provider` |
| `auth.loginCli` | GET (browser) | `/cli/authorize?port=...` |
| `auth.me` | GET | `/api/auth/me` |
| `auth.logout` | POST | `/api/auth/logout` |
| `auth.listTokens` | GET | `/api/auth/tokens` |
| `auth.revokeToken` | DELETE | `/api/auth/tokens` |
| `orgs.list` | GET | `/api/orgs` |
| `orgs.create` | POST | `/api/orgs` |
| `orgs.addMember` | POST | `/api/orgs/members` |
| `projects.list` | GET | `/api/projects` |
| `projects.create` | POST | `/api/projects` |
| `projects.get` | GET | `/api/projects/:id` |
| `projects.update` | PATCH | `/api/projects/:id` |
| `projects.delete` | DELETE | `/api/projects/:id` |
| `projects.sync` | POST | `/api/projects/sync` |
| `projects.listSecrets` | GET | `/api/projects/:id/secrets` |
| `projects.setSecret` | POST | `/api/projects/:id/secrets` |
| `projects.deleteSecret` | DELETE | `/api/projects/:id/secrets` |
| `projects.getClaudeStatus` | GET | `/api/projects/:id/claude` |
| `projects.setClaudeKey` | PUT | `/api/projects/:id/claude` |
| `projects.removeClaudeKey` | DELETE | `/api/projects/:id/claude` |
| `vercel.integrationStatus` | GET | `/api/integrations/status` |
| `vercel.disconnect` | DELETE | `/api/integrations/vercel` |
| `vercel.listProjects` | GET | `/api/vercel/projects` |
| `github.listRepos` | GET | `/api/github/repos` |
