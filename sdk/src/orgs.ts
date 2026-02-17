export interface OrgMembership {
  id: string
  organizationId: string
  organizationName: string
  role: string | undefined
  status: string
}

export interface Org {
  id: string
  name: string
}

export interface OrgsClient {
  /** List the current user's organization memberships. */
  list(): Promise<OrgMembership[]>
  /** Create a new organization. The current user becomes admin. */
  create(input: { name: string }): Promise<Org>
  /** Invite a user by email to the current organization. Admin only. */
  invite(input: { email: string }): Promise<void>
}

export function createOrgsClient(baseUrl: string, request: RequestFn): OrgsClient {
  return {
    async list() {
      const data = await request<{ memberships: OrgMembership[] }>('/orgs')
      return data.memberships
    },

    async create(input) {
      const data = await request<{ organization: Org }>('/orgs', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      return data.organization
    },

    async invite(input) {
      await request<{ success: boolean }>('/orgs/invite', {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },
  }
}

export type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>
