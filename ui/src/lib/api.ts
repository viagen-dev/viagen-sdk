/**
 * Org-scoped fetch wrapper. Automatically includes credentials
 * and the X-Organization header for all API calls.
 */
export function apiFetch(
  path: string,
  orgId: string,
  options?: RequestInit,
): Promise<Response> {
  const headers = new Headers(options?.headers)
  headers.set('X-Organization', orgId)

  return fetch(path, {
    ...options,
    credentials: 'include',
    headers,
  })
}
