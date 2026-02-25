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

/** Check whether a PR has been merged. Returns null if the request fails. */
export async function isPrMerged(token: string, owner: string, repo: string, prNumber: number): Promise<boolean | null> {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}`, {
      headers: githubHeaders(token),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.merged === true
  } catch {
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
