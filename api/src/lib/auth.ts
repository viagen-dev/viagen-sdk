import { Google, GitHub, MicrosoftEntraId, generateState, generateCodeVerifier } from 'arctic'
import { randomBytes } from 'crypto'
import { db } from '../db/index.js'
import { users, sessions } from '../db/schema.js'
import { eq } from 'drizzle-orm'

// --- Providers ---

const redirectBase = process.env.AUTH_REDIRECT_BASE ?? 'http://localhost:3000'

export const providers = {
  google: new Google(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${redirectBase}/api/auth/callback/google`,
  ),
  github: new GitHub(
    process.env.GITHUB_CLIENT_ID!,
    process.env.GITHUB_CLIENT_SECRET!,
    `${redirectBase}/api/auth/callback/github`,
  ),
  microsoft: new MicrosoftEntraId(
    process.env.MICROSOFT_TENANT_ID ?? 'common',
    process.env.MICROSOFT_CLIENT_ID!,
    process.env.MICROSOFT_CLIENT_SECRET!,
    `${redirectBase}/api/auth/callback/microsoft`,
  ),
} as const

export type ProviderName = keyof typeof providers

export function isValidProvider(name: string): name is ProviderName {
  return name in providers
}

// --- Authorization URL ---

export function createAuthUrl(provider: ProviderName): { url: URL; state: string; codeVerifier?: string } {
  const state = generateState()

  if (provider === 'github') {
    const url = providers.github.createAuthorizationURL(state, ['user:email'])
    return { url, state }
  }

  const codeVerifier = generateCodeVerifier()

  if (provider === 'google') {
    const url = providers.google.createAuthorizationURL(state, codeVerifier, ['openid', 'email', 'profile'])
    return { url, state, codeVerifier }
  }

  const url = providers.microsoft.createAuthorizationURL(state, codeVerifier, ['openid', 'email', 'profile'])
  return { url, state, codeVerifier }
}

// --- Code Exchange ---

export async function exchangeCode(provider: ProviderName, code: string, codeVerifier?: string) {
  if (provider === 'github') {
    return providers.github.validateAuthorizationCode(code)
  }
  if (provider === 'google') {
    return providers.google.validateAuthorizationCode(code, codeVerifier!)
  }
  return providers.microsoft.validateAuthorizationCode(code, codeVerifier!)
}

// --- Fetch User Info from Provider ---

interface ProviderUser {
  email: string
  name: string | null
  avatarUrl: string | null
  providerUserId: string
}

export async function fetchProviderUser(provider: ProviderName, accessToken: string): Promise<ProviderUser> {
  if (provider === 'google') {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = await res.json()
    return {
      email: data.email,
      name: data.name ?? null,
      avatarUrl: data.picture ?? null,
      providerUserId: data.id,
    }
  }

  if (provider === 'github') {
    const [userRes, emailRes] = await Promise.all([
      fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      }),
      fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      }),
    ])
    const userData = await userRes.json()
    const emails: any[] = await emailRes.json()
    const primary = emails.find((e: any) => e.primary) ?? emails[0]
    return {
      email: primary.email,
      name: userData.name ?? userData.login,
      avatarUrl: userData.avatar_url ?? null,
      providerUserId: String(userData.id),
    }
  }

  // Microsoft
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()
  return {
    email: data.mail ?? data.userPrincipalName,
    name: data.displayName ?? null,
    avatarUrl: null,
    providerUserId: data.id,
  }
}

// --- Session Management ---

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

export async function createSession(userId: string) {
  const token = generateSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

  await db.insert(sessions).values({
    id: token,
    userId,
    expiresAt,
  })

  return { token, expiresAt }
}

export async function validateSession(token: string) {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, token))

  if (!session || session.expiresAt < new Date()) {
    if (session) await db.delete(sessions).where(eq(sessions.id, token))
    return null
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))

  if (!user) return null

  return { session, user }
}

export async function deleteSession(token: string) {
  await db.delete(sessions).where(eq(sessions.id, token))
}

// --- User Upsert ---

export async function upsertUser(provider: ProviderName, providerUser: ProviderUser) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, providerUser.email))

  if (existing.length > 0) {
    // Update provider info and profile on each login
    const [updated] = await db
      .update(users)
      .set({
        name: providerUser.name,
        avatarUrl: providerUser.avatarUrl,
        provider,
        providerUserId: providerUser.providerUserId,
      })
      .where(eq(users.email, providerUser.email))
      .returning()
    return updated
  }

  const [created] = await db
    .insert(users)
    .values({
      email: providerUser.email,
      name: providerUser.name,
      avatarUrl: providerUser.avatarUrl,
      provider,
      providerUserId: providerUser.providerUserId,
    })
    .returning()
  return created
}
