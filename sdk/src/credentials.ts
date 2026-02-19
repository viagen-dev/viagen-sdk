import { join } from 'node:path'
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'

export interface StoredCredentials {
  token: string
  baseUrl: string
  expiresAt?: string
}

function credentialsDir(): string {
  return join(
    process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'),
    'viagen',
  )
}

function credentialsPath(): string {
  return join(credentialsDir(), 'credentials.json')
}

export async function loadCredentials(): Promise<StoredCredentials | null> {
  try {
    const raw = await readFile(credentialsPath(), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function saveCredentials(creds: StoredCredentials): Promise<void> {
  const dir = credentialsDir()
  await mkdir(dir, { recursive: true })
  await writeFile(credentialsPath(), JSON.stringify(creds, null, 2) + '\n', {
    mode: 0o600,
  })
}

export async function clearCredentials(): Promise<void> {
  try {
    await unlink(credentialsPath())
  } catch {
    // File may not exist
  }
}
