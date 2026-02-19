# viagen-sdk

TypeScript client for the viagen platform API. Used by sandboxes, the CLI, and any external consumer that needs to talk to the platform.

## Install

```bash
npm install viagen-sdk
```

## Quick Start

```ts
import { createViagen } from 'viagen-sdk'

const viagen = createViagen({ baseUrl: 'https://app.viagen.dev' })

// Get current user
const user = await viagen.auth.me()

// List projects
const projects = await viagen.projects.list()
```

## API Reference

### `createViagen(config)`

Creates a client instance. All methods use `credentials: 'include'` for cookie-based auth.

```ts
const viagen = createViagen({ baseUrl: 'http://localhost:5173' })
```

---

### `viagen.auth`

| Method | Description |
|---|---|
| `login(provider?)` | Redirects the browser to OAuth login. Default: `'github'`. Options: `'github'`, `'google'`, `'microsoft'` |
| `me()` | Returns the current user + orgs, or `null` if not authenticated |
| `logout()` | Ends the session and reloads the page |

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
| `auth.me` | GET | `/api/auth/me` |
| `auth.logout` | POST | `/api/auth/logout` |
| `orgs.list` | GET | `/api/orgs` |
| `orgs.create` | POST | `/api/orgs` |
| `orgs.addMember` | POST | `/api/orgs/members` |
| `projects.list` | GET | `/api/projects` |
| `projects.create` | POST | `/api/projects` |
| `projects.get` | GET | `/api/projects/:id` |
| `projects.update` | PATCH | `/api/projects/:id` |
| `projects.delete` | DELETE | `/api/projects/:id` |
| `vercel.integrationStatus` | GET | `/api/integrations/status` |
| `vercel.disconnect` | DELETE | `/api/integrations/vercel` |
| `vercel.listProjects` | GET | `/api/vercel/projects` |
| `github.listRepos` | GET | `/api/github/repos` |
