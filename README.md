# viagen-sdk

API server and client SDK for viagen platform services.

## Structure

- `api/` — Hono API server (deploys to Vercel)
- `sdk/` — Client SDK (publishes to npm as `viagen-sdk`)

## Setup

```bash
npm install
```

## Development

```bash
# Start API server locally
npm run dev -w api

# Build SDK
npm run build -w sdk

# Run all tests
npm test
```

## Auth

Auth is powered by [WorkOS AuthKit](https://workos.com/docs/user-management/authkit). The API handles the OAuth redirect flow and sealed session management. The SDK provides a typed client.

### API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/auth/login` | Redirect to WorkOS AuthKit login |
| GET | `/auth/callback` | Exchange code for session, set cookie |
| GET | `/auth/me` | Return current user from session |
| POST | `/auth/logout` | Clear session cookie |

### SDK Usage

```ts
import { createViagen } from 'viagen-sdk'

const viagen = createViagen({ baseUrl: 'https://sdk.viagen.dev' })

viagen.auth.login()
const user = await viagen.auth.me()
await viagen.auth.logout()
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `WORKOS_API_KEY` | WorkOS API key |
| `WORKOS_CLIENT_ID` | WorkOS client ID |
| `WORKOS_COOKIE_PASSWORD` | 32+ char secret for sealing sessions |
