# viagen-sdk

API server and client SDK for viagen platform services.

## Structure

- `api/` — Hono API server (deploys to Vercel)
- `sdk/` — Client SDK (publishes to npm as `viagen-sdk`)

## Setup

```bash
npm install
cp api/.env.example api/.env  # fill in values
npm run db:push -w api        # push schema to Neon
```

## Development

```bash
npm run dev -w api     # Start API server locally
npm run build -w sdk   # Build SDK
npm test               # Run all tests
```

## Auth

OAuth via [Arctic](https://arcticjs.dev/) with our own DB sessions. Providers: GitHub, Google, Microsoft.

### API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/auth/login/:provider` | Redirect to OAuth provider (github, google, microsoft) |
| GET | `/api/auth/callback/:provider` | Exchange code, upsert user, create session |
| GET | `/api/auth/me` | Return current user + org memberships |
| POST | `/api/auth/logout` | Delete session, clear cookie |
| GET | `/api/orgs` | List user's organizations |
| POST | `/api/orgs` | Create organization (user becomes admin) |
| POST | `/api/orgs/members` | Add member by email (admin only) |
| GET | `/api/projects` | List projects (org-scoped) |
| POST | `/api/projects` | Create project (admin only) |
| GET | `/api/projects/:id` | Get project (org-scoped) |
| DELETE | `/api/projects/:id` | Delete project (admin only) |

### SDK Usage

```ts
import { createViagen } from 'viagen-sdk'

const viagen = createViagen({ baseUrl: 'https://api.viagen.dev/api' })

viagen.auth.login('github')
const user = await viagen.auth.me()
await viagen.auth.logout()

const orgs = await viagen.orgs.list()
await viagen.orgs.create({ name: 'My Team' })

const projects = await viagen.projects.list()
await viagen.projects.create({ name: 'My App' })
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon Postgres connection string |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `MICROSOFT_CLIENT_ID` | Microsoft Entra app client ID |
| `MICROSOFT_CLIENT_SECRET` | Microsoft Entra app client secret |
| `MICROSOFT_TENANT_ID` | Microsoft tenant ID (default: `common`) |
| `AUTH_REDIRECT_BASE` | Callback base URL (default: `http://localhost:3000`) |

## Front end

`ui/` — Vite + React SPA using Vercel's [Geist](https://vercel.com/geist/introduction) design language.

```bash
npm run dev          # starts api + ui concurrently
npm run dev -w ui    # ui only (port 5173)
```

### Design system

Geist's component library is internal to Vercel and not published to npm. We use the open pieces:

- **Fonts** — `@fontsource-variable/geist` (sans) and `@fontsource-variable/geist-mono` (mono), imported in `main.tsx`. The official `geist` npm package is Next.js-only.
- **Color tokens** — CSS custom properties following Geist's `--ds-` naming convention (`--ds-gray-100` through `--ds-gray-1000`, `--ds-background-100/200`, `--ds-blue-700/800`). Light and dark mode via `prefers-color-scheme`.
- **Typography** — System scale: 0.75rem (xs), 0.8125rem (sm), 0.875rem (base), 1.5rem (heading). Weight 500 for headings, 400 for body.
- **Components** — Built from scratch following Geist conventions: 6px border radius, `--ds-gray-1000` primary buttons with `--ds-background-100` text, subtle `--ds-gray-200` borders for secondary actions.

### Proxy

Vite proxies `/api` → `http://localhost:3000` so the SPA and API share cookies on `localhost` during development. OAuth callbacks hit the API directly (port 3000), then `AFTER_LOGIN_URL` redirects back to the UI.

## TODO

- [X] Set up OAuth providers:
  - [X] **GitHub**: https://github.com/settings/developers → New OAuth App (callback: `{base}/api/auth/callback/github`)
  - [ ] **Google**: https://console.cloud.google.com/apis/credentials → OAuth client ID (callback: `{base}/api/auth/callback/google`)
  - [ ] **Microsoft**: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade → New registration (callback: `{base}/api/auth/callback/microsoft`)
- [ ] Test full auth flow end-to-end
- [ ] Add `app/` workspace — Vite SPA that dogfoods the SDK
- [ ] Deploy API to Vercel (api.viagen.dev)
- [ ] Publish SDK to npm
