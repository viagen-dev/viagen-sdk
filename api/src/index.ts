import 'dotenv/config'
import { Hono } from 'hono'
import { html } from 'hono/html'
import { cors } from 'hono/cors'
import { handle } from 'hono/vercel'
import { auth } from './routes/auth.js'
import { orgs } from './routes/orgs.js'
import { projectRoutes } from './routes/projects.js'
import { vercelRoutes } from './routes/vercel.js'
import { integrationRoutes } from './routes/integrations.js'
import { githubRoutes } from './routes/github.js'

const app = new Hono()

// Login page — rendered by the API for the OAuth flow
app.get('/', (c) => {
  return c.html(html`<!doctype html>
    <html>
      <head>
        <title>viagen</title>
        <style>
          body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fafafa; }
          .card { text-align: center; }
          h1 { font-size: 1.5rem; font-weight: 500; margin-bottom: 1.5rem; }
          .providers { display: flex; gap: 0.5rem; justify-content: center; }
          a { display: inline-block; padding: 0.625rem 1.25rem; background: #111; color: #fff; text-decoration: none; border-radius: 6px; font-size: 0.8125rem; }
          a:hover { background: #333; }
          .meta { font-size: 0.75rem; color: #999; margin-top: 1.5rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>viagen</h1>
          <p style="font-size: 0.8125rem; color: #666; margin-bottom: 1.25rem;">Sign in to continue</p>
          <div class="providers">
            <a href="/api/auth/login/github">GitHub</a>
            <a href="/api/auth/login/google">Google</a>
            <a href="/api/auth/login/microsoft">Microsoft</a>
          </div>
          <p class="meta">api.viagen.dev</p>
        </div>
      </body>
    </html>`)
})

const api = new Hono().basePath('/api')

api.use(
  '*',
  cors({
    origin: (origin) => origin,
    credentials: true,
  }),
)

api.route('/auth', auth)
api.route('/orgs', orgs)
api.route('/projects', projectRoutes)
api.route('/vercel', vercelRoutes)
api.route('/integrations', integrationRoutes)
api.route('/github', githubRoutes)

api.get('/health', (c) => c.json({ ok: true }))

app.route('/', api)

// Vercel serverless entry
export default handle(app)

// Local dev entry
if (process.env.NODE_ENV !== 'production') {
  const { serve } = await import('@hono/node-server')
  serve({ fetch: app.fetch, port: 3000 }, (info) => {
    console.log(`viagen-sdk API running at http://localhost:${info.port}`)
  })
}
