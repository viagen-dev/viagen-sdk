# viagen-sdk

TypeScript API client for the [viagen](https://viagen.dev) platform. Works in Node.js, browsers, and edge runtimes.

```bash
npm install viagen-sdk
```

## Quick start

```ts
import { createViagen } from 'viagen-sdk'

const viagen = createViagen({
  baseUrl: 'https://api.viagen.dev',
  token: 'vgn_...',
  orgId: 'org_...',
})

const projects = await viagen.projects.list()
```

## Authentication

The client supports two auth modes:

- **Token auth** (CLI / server) — pass a `token` to use Bearer authentication
- **Cookie auth** (browser) — omit `token` and the client sends credentials with requests

### CLI login

```ts
const { token } = await viagen.auth.loginCli()
// Token is returned after browser-based OAuth flow
```

### Stored credentials

For CLI tools, use the built-in credential helpers:

```ts
import { createViagenFromCredentials, saveCredentials, clearCredentials } from 'viagen-sdk'

// Load a client from ~/.config/viagen/credentials.json
const viagen = await createViagenFromCredentials()

// Save credentials after login
await saveCredentials({ token, baseUrl: 'https://api.viagen.dev' })

// Clear stored credentials
await clearCredentials()
```

## API reference

### `viagen.auth`

| Method | Description |
|--------|-------------|
| `login(provider?)` | Redirect to OAuth provider (`'github'`, `'google'`, `'microsoft'`). Browser only. |
| `me()` | Get current user and org memberships. Returns `null` if unauthenticated. |
| `logout()` | Log out. Reloads the page in browsers. |
| `loginCli(options?)` | CLI login via browser OAuth flow. Node.js only. |
| `listTokens()` | List the current user's API tokens. |
| `revokeToken(tokenId)` | Revoke an API token. |

### `viagen.orgs`

| Method | Description |
|--------|-------------|
| `list()` | List the current user's organizations. |
| `create({ name })` | Create a new organization. User becomes admin. |
| `addMember({ email })` | Add a member by email. Admin only. |

### `viagen.projects`

| Method | Description |
|--------|-------------|
| `list()` | List all projects in the current org. |
| `create(input)` | Create a project. Admin only. |
| `get(id)` | Get a project by ID. |
| `update(id, input)` | Update a project. Admin only. |
| `delete(id)` | Delete a project. Admin only. |
| `sync(input)` | Upsert a project with optional secrets. Admin only. |
| `listSecrets(id)` | List project + inherited org secrets. |
| `setSecret(id, key, value)` | Set a project secret. Admin only. |
| `deleteSecret(id, key)` | Delete a project secret. Admin only. |
| `getClaudeStatus(id)` | Check Claude API key status (project or org level). |
| `setClaudeKey(id, apiKey)` | Set Anthropic API key. Admin only. |
| `removeClaudeKey(id)` | Remove project-level API key. Admin only. |
| `getDatabase(id)` | Get the project's database. |
| `provisionDatabase(id, input?)` | Provision a database. Admin only. |
| `deleteDatabase(id)` | Delete the project's database. Admin only. |

### `viagen.tasks`

| Method | Description |
|--------|-------------|
| `list(projectId, status?)` | List tasks, optionally filtered by status. |
| `get(projectId, taskId)` | Get a single task. |
| `create(projectId, input)` | Create a task. |
| `update(projectId, taskId, input)` | Update task status, result, PR URL, etc. |
| `merge(projectId, taskId)` | Merge the task's PR and mark completed. |

### `viagen.deployments`

| Method | Description |
|--------|-------------|
| `list(projectId)` | List recent Vercel deployments. |
| `redeploy(projectId, target?)` | Trigger a redeploy (`'production'` or `'preview'`). Admin only. |

### `viagen.vercel`

| Method | Description |
|--------|-------------|
| `integrationStatus()` | Check Vercel/GitHub integration status for the org. |
| `disconnect()` | Disconnect the Vercel integration. Admin only. |
| `listProjects(params?)` | List Vercel projects. Supports `search` and `limit`. |

### `viagen.github`

| Method | Description |
|--------|-------------|
| `listRepos(params?)` | List GitHub repos. Supports `page` and `perPage`. |

## Sandbox helpers

A separate entrypoint for code running inside a viagen sandbox. Auto-configured from environment variables set by the platform (`VIAGEN_CALLBACK_URL`, `VIAGEN_AUTH_TOKEN`, `VIAGEN_TASK_ID`).

```ts
import { updateTask } from 'viagen-sdk/sandbox'

// Report task ready for review
await updateTask({ status: 'review', prUrl: 'https://...', result: 'Added feature X' })

// Report task completed
await updateTask({ status: 'completed', result: 'Done' })
```

## Error handling

All methods throw `ViagenApiError` on non-2xx responses:

```ts
import { ViagenApiError } from 'viagen-sdk'

try {
  await viagen.projects.get('bad-id')
} catch (err) {
  if (err instanceof ViagenApiError) {
    console.log(err.status)  // 404
    console.log(err.message) // "Not found"
    console.log(err.detail)  // optional detail string
  }
}
```

## License

Proprietary.
