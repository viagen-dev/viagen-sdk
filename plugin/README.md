# viagen

A Vite dev server plugin and CLI tool that enables you to use Claude Code in a sandbox — instantly.

## Prerequisites

- [Claude](https://claude.ai/signup) — Max, Pro, or API plan. The setup wizard handles auth.
- [Vercel](https://vercel.com/signup) — Free plan works. Sandboxes last 45 min on Hobby, 5 hours on Pro.
- [GitHub CLI](https://cli.github.com) — Enables git clone and push from sandboxes.

## Quick Setup (Claude Code Plugin)

```
/plugin marketplace add viagen-dev/viagen-claude-plugin
/plugin install viagen@viagen-marketplace
```

**Restart Claude Code to load the plugin.**

```
/viagen-install
```

The plugin will handle npm installation, vite config updates, and run the setup wizard for you.

## Manual Setup

### Step 1 — Add viagen to your app

```bash
npm install --save-dev viagen
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { viagen } from 'viagen'

export default defineConfig({
  plugins: [viagen()],
})
```

### Step 2 — Setup

```bash
npx viagen setup
```

The setup wizard authenticates with Claude, detects your GitHub and Vercel credentials, and captures your git remote info — all written to your local `.env`. This ensures sandboxes clone the correct repo instead of inferring it at runtime.

You can now run `npm run dev` to start the local dev server. At this point you can launch viagen and chat with Claude to make changes to your app.

### Step 3 — Sandbox

```bash
npx viagen sandbox
```

Deploys your dev server to a remote Vercel Sandbox — an isolated VM-like environment where Claude can read, write, and push code.

```bash
# Deploy on a specific branch
npx viagen sandbox --branch feature/my-thing

# Set a longer timeout (default: 30 min)
npx viagen sandbox --timeout 60

# Auto-send a prompt on load
npx viagen sandbox --prompt "build me a landing page"

# Stop a running sandbox
npx viagen sandbox stop <sandboxId>
```


## Plugin Options

```ts
viagen({
  position: 'bottom-right',  // toggle button position
  model: 'sonnet',           // claude model
  panelWidth: 375,           // chat panel width in px
  overlay: true,             // fix button on error overlay
  ui: true,                  // inject chat panel into pages
  sandboxFiles: [...],       // copy files manually into sandbox
  systemPrompt: '...',       // custom system prompt (see below)
  editable: ['src','conf'],  // files/dirs editable in the UI
  mcpServers: { ... },       // additional MCP servers for Claude
})
```


### Custom MCP Servers

Pass additional [MCP server](https://modelcontextprotocol.io) configurations to give Claude access to custom tools:

```ts
viagen({
  mcpServers: {
    'my-db': {
      command: 'npx',
      args: ['-y', '@my-org/db-mcp-server'],
      env: { DATABASE_URL: process.env.DATABASE_URL },
    },
  },
})
```

These are merged with viagen's built-in platform tools (when connected). User-provided servers take precedence if names collide.

### Editable Files

Add a file editor panel to the chat UI:

```ts
viagen({
  editable: ['src/components', 'vite.config.ts']
})
```

Paths can be files or directories (directories include all files within). The editor appears as a "Files" tab in the chat panel with a collapsible directory tree, syntax highlighting (TypeScript, JavaScript, CSS, HTML, JSON, Markdown), and image preview.

The default system prompt tells Claude it's embedded in a Vite dev server, that file edits trigger HMR, and how to check server logs. Recent build errors are automatically appended to give Claude context about what went wrong.

To customize the prompt, you can replace it entirely or extend the default:

```ts
import { viagen, DEFAULT_SYSTEM_PROMPT } from 'viagen'

viagen({
  // Replace entirely
  systemPrompt: 'You are a React expert. Only use TypeScript.',

  // Or extend the default
  systemPrompt: DEFAULT_SYSTEM_PROMPT + '\nAlways use Tailwind for styling.',
})
```

## API

Every viagen endpoint is available as an API. Build your own UI, integrate with CI, or script Claude from the command line.

```
POST /via/chat        — send a message, streamed SSE response
POST /via/chat/reset  — clear conversation history
GET  /via/health      — check API key status
GET  /via/error       — latest build error (if any)
GET  /via/ui          — standalone chat interface
GET  /via/iframe      — split view (app + chat side by side)
GET  /via/files       — list editable files (when configured)
GET  /via/file?path=  — read file content
POST /via/file        — write file content { path, content }
GET  /via/file/raw    — serve raw file (images, etc.) with correct MIME type
GET  /via/git/status  — list changed files (git status)
GET  /via/git/diff    — full diff, or single file with ?path=
GET  /via/git/branch  — current branch, remote URL, open PR info
GET  /via/logs        — dev server log entries, optional ?since=<timestamp>
```

When `VIAGEN_AUTH_TOKEN` is set (always on in sandboxes), pass the token as a `Bearer` header, a `/t/:token` path segment, or a `?token=` query param.

```bash
# With curl
curl -X POST http://localhost:5173/via/chat \
  -H "Authorization: Bearer $VIAGEN_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "add a hello world route"}'

# Or pass the token in the URL path (sets a session cookie)
open "http://localhost:5173/via/ui/t/$VIAGEN_AUTH_TOKEN"

# ?token= query param also works (fallback for backwards compat)
open "http://localhost:5173/via/ui?token=$VIAGEN_AUTH_TOKEN"
```

## Development

```bash
npm install
npm run dev        # Dev server (site)
npm run build      # Build with tsup
npm run test       # Run tests
npm run typecheck  # Type check
```

## License

[MIT](LICENSE)
