import * as schema from './schema'

const url = process.env.DATABASE_URL

async function createDb() {
  if (!url) {
    throw new Error('[db] DATABASE_URL environment variable is not set')
  }

  if (url.includes('neon.tech')) {
    const { neon } = await import('@neondatabase/serverless')
    const { drizzle } = await import('drizzle-orm/neon-http')
    return drizzle(neon(url), { schema })
  }

  // Local/test: use standard node-postgres driver
  const { drizzle } = await import(/* @vite-ignore */ 'drizzle-orm/node-postgres')
  return drizzle(url, { schema })
}

export const db = await createDb()
