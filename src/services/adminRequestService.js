const headers = () => {
  const user = JSON.parse(localStorage.getItem('tgm_user') || 'null')
  if (!user?.id) throw new Error('Sign in is required for admin operations.')
  return { Accept: 'application/json', 'Content-Type': 'application/json', 'X-User-Id': user.id }
}

async function request(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { ...headers(), ...options.headers } })
  if (response.status === 204) return null
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Admin operation failed')
  return body
}

export const getAdminCustomRequests = () => request('/api/admin/custom-requests')
export const deleteAdminCustomRequest = id => request(`/api/admin/custom-requests/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const getAdminCustomRequestDetail = id => request(`/api/admin/custom-requests/${encodeURIComponent(id)}`)
export const closeAdminCustomRequest = id => request(`/api/admin/custom-requests/${encodeURIComponent(id)}/close`, { method: 'POST' })
export const hideAdminProposal = (requestId, proposalId) => request(`/api/admin/custom-requests/${encodeURIComponent(requestId)}/proposals/${encodeURIComponent(proposalId)}/hide`, { method: 'POST' })