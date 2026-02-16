import { createAuthClient, type AuthClient } from './auth.js'

export type { ViagenUser, AuthResult, AuthClient } from './auth.js'

export interface ViagenConfig {
  baseUrl: string
}

export interface ViagenClient {
  auth: AuthClient
}

export function createViagen(config: ViagenConfig): ViagenClient {
  const baseUrl = config.baseUrl.replace(/\/+$/, '')

  return {
    auth: createAuthClient(baseUrl),
  }
}
