export interface OrgMembership {
  id: string
  name: string
  role: string
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
  /** Add a member by email to the current organization. Admin only. */
  addMember(input: { email: string }): Promise<void>
}

export function createOrgsClient(_baseUrl: string, request: RequestFn): OrgsClient {
  return {
    async list() {
      const data = await request<{ organizations: OrgMembership[] }>('/api/orgs')
      return data.organizations
    },

    async create(input) {
      const data = await request<{ organization: Org }>('/api/orgs', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      return data.organization
    },

    async addMember(input) {
      await request<{ success: boolean }>('/api/orgs/members', {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },
  }
}

export type RequestFn = <T>(path: string, options?: RequestInit) => Promise<T>
