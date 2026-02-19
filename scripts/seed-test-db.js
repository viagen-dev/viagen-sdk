import pg from 'pg'
import { randomBytes, createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://viagen:viagen@localhost:5433/viagen_test'

function createToken(userId) {
  const plaintext = randomBytes(32).toString('hex')
  const hashed = createHash('sha256').update(plaintext).digest('hex')
  const prefix = plaintext.slice(0, 8)
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  return { plaintext, hashed, prefix, expiresAt, userId }
}

const client = new pg.Client({ connectionString: DATABASE_URL })
await client.connect()

try {
  // ── User A: primary test user (admin of "Test Org") ──

  const {
    rows: [userA],
  } = await client.query(`
    INSERT INTO users (email, name, provider, provider_user_id)
    VALUES ('test@viagen.dev', 'Test User', 'github', 'test-seed-123')
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `)

  const {
    rows: [orgA],
  } = await client.query(`
    INSERT INTO organizations (name) VALUES ('Test Org') RETURNING id
  `)

  await client.query(
    `INSERT INTO org_members (user_id, organization_id, role)
     VALUES ($1, $2, 'admin')
     ON CONFLICT DO NOTHING`,
    [userA.id, orgA.id],
  )

  await client.query(
    `INSERT INTO projects (organization_id, name, template_id)
     VALUES ($1, 'Test Project', 'react-router')`,
    [orgA.id],
  )

  const tokenA = createToken(userA.id)
  await client.query(
    `INSERT INTO api_tokens (id, user_id, name, token_prefix, expires_at)
     VALUES ($1, $2, 'sdk-test', $3, $4)`,
    [tokenA.hashed, userA.id, tokenA.prefix, tokenA.expiresAt],
  )

  // ── User B: outsider in a separate org ──

  const {
    rows: [userB],
  } = await client.query(`
    INSERT INTO users (email, name, provider, provider_user_id)
    VALUES ('other@example.com', 'Other User', 'github', 'test-seed-456')
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `)

  const {
    rows: [orgB],
  } = await client.query(`
    INSERT INTO organizations (name) VALUES ('Other Org') RETURNING id
  `)

  await client.query(
    `INSERT INTO org_members (user_id, organization_id, role)
     VALUES ($1, $2, 'admin')
     ON CONFLICT DO NOTHING`,
    [userB.id, orgB.id],
  )

  const tokenB = createToken(userB.id)
  await client.query(
    `INSERT INTO api_tokens (id, user_id, name, token_prefix, expires_at)
     VALUES ($1, $2, 'sdk-test-other', $3, $4)`,
    [tokenB.hashed, userB.id, tokenB.prefix, tokenB.expiresAt],
  )

  // ── Write env file ──

  const envPath = join(__dirname, '..', 'sdk', '.env.test')
  writeFileSync(
    envPath,
    [
      `VIAGEN_TEST_URL=http://localhost:5173`,
      `VIAGEN_TEST_TOKEN=${tokenA.plaintext}`,
      `VIAGEN_TEST_TOKEN_OTHER=${tokenB.plaintext}`,
    ].join('\n') + '\n',
  )

  console.log('\nTest data seeded successfully!')
  console.log(`  User A:   ${userA.id} (test@viagen.dev) → Test Org`)
  console.log(`  User B:   ${userB.id} (other@example.com) → Other Org`)
  console.log(`  Token A:  ${tokenA.plaintext.slice(0, 8)}...`)
  console.log(`  Token B:  ${tokenB.plaintext.slice(0, 8)}...`)
  console.log(`  Env:      ${envPath}`)
} finally {
  await client.end()
}
