/**
 * Parse a GitHub PR URL into its components.
 * Accepts URLs like https://github.com/owner/repo/pull/123
 */
export function parsePrUrl(prUrl: string): { owner: string; repo: string; number: number } | null {
  const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
  if (!match) return null
  return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) }
}

const GITHUB_API = 'https://api.github.com'

function githubHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'viagen-sdk',
  }
}

// Cache merge check results for 60s to avoid hammering GitHub API
const mergeCache = new Map<string, { merged: boolean | null; checkedAt: number }>()
const MERGE_CACHE_TTL = 60_000

/** Check whether a PR has been merged. Returns null if the request fails. Caches results for 60s. */
export async function isPrMerged(token: string, owner: string, repo: string, prNumber: number): Promise<boolean | null> {
  const cacheKey = `${owner}/${repo}/${prNumber}`
  const cached = mergeCache.get(cacheKey)
  if (cached && Date.now() - cached.checkedAt < MERGE_CACHE_TTL) {
    return cached.merged
  }

  const url = `${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}`
  try {
    const res = await fetch(url, {
      headers: githubHeaders(token),
    })
    if (!res.ok) {
      console.error(`[isPrMerged] GitHub API ${res.status} for ${url}`)
      mergeCache.set(cacheKey, { merged: null, checkedAt: Date.now() })
      return null
    }
    const data = await res.json()
    const merged = data.merged === true
    console.log(`[isPrMerged] ${owner}/${repo}#${prNumber} — state=${data.state}, merged=${merged}`)
    mergeCache.set(cacheKey, { merged, checkedAt: Date.now() })
    // If merged, cache indefinitely (it won't un-merge)
    if (merged) mergeCache.set(cacheKey, { merged, checkedAt: Date.now() + 1e12 })
    return merged
  } catch (err) {
    console.error(`[isPrMerged] fetch error for ${url}:`, err)
    return null
  }
}

/** Merge a PR. Returns { merged, message } on success, throws on failure. */
export async function mergePr(
  token: string,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ merged: boolean; message: string }> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
    method: 'PUT',
    headers: {
      ...githubHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ merge_method: 'squash' }),
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.message ?? `GitHub merge failed (${res.status})`)
  }

  return { merged: data.merged ?? true, message: data.message ?? 'Pull request merged' }
}

/** Close an open PR. Throws on failure. */
export async function closePr(
  token: string,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<void> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}`, {
    method: 'PATCH',
    headers: {
      ...githubHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ state: 'closed' }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message ?? `GitHub close PR failed (${res.status})`)
  }
}
