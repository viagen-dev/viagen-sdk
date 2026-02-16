import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { handle } from 'hono/vercel'
import { auth } from './routes/auth.js'

const app = new Hono().basePath('/api')

app.use(
  '*',
  cors({
    origin: (origin) => origin,
    credentials: true,
  }),
)

app.route('/auth', auth)

app.get('/health', (c) => c.json({ ok: true }))

// Vercel serverless entry
export default handle(app)

// Local dev entry
if (process.env.NODE_ENV !== 'production') {
  const { serve } = await import('@hono/node-server')
  serve({ fetch: app.fetch, port: 3000 }, (info) => {
    console.log(`viagen-sdk API running at http://localhost:${info.port}`)
  })
}
