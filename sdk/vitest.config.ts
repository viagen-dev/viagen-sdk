import { readFileSync } from 'fs'
import { defineConfig } from 'vitest/config'

function loadTestEnv() {
  try {
    const content = readFileSync('.env.test', 'utf8')
    const env: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        // Don't override env vars already set (e.g. from Docker Compose)
        if (!(key in process.env)) {
          env[key] = match[2].trim()
        }
      }
    }
    return env
  } catch {
    return {}
  }
}

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    env: loadTestEnv(),
  },
})
