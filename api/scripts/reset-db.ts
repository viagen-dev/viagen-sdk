import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env') })

import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log('Dropping all tables...')
  await sql`DROP TABLE IF EXISTS org_members CASCADE`
  await sql`DROP TABLE IF EXISTS projects CASCADE`
  await sql`DROP TABLE IF EXISTS sessions CASCADE`
  await sql`DROP TABLE IF EXISTS organizations CASCADE`
  await sql`DROP TABLE IF EXISTS users CASCADE`
  console.log('Done. Run db:push to recreate.')
}

main().catch(console.error)
