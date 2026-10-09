const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

const headers = () => {
  const user = JSON.parse(localStorage.getItem('tgm_user') || 'null')
  if (!user?.id) throw new Error('Please sign in to manage custom requests.')
  return { Accept: 'application/json', 'X-User-Id': user.id }
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { ...headers(), ...options.headers }
  })
  if (response.status === 204) return null
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Custom request operation failed')
  return body
}

const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
})

export const getTravelerCustomRequests = () => request('/api/traveler/custom-requests')
export const createCustomRequest = payload => request('/api/traveler/custom-requests', json('POST', payload))
export const updateCustomRequest = (id, payload) => request(`/api/traveler/custom-requests/${id}`, json('PUT', payload))
export const withdrawCustomRequest = id => request(`/api/traveler/custom-requests/${id}`, json('DELETE'))
export const getCustomRequestProposals = id => request(`/api/traveler/custom-requests/${id}/proposals`)
export const acceptCustomRequestProposal = (requestId, proposalId) => request(`/api/traveler/custom-requests/${requestId}/proposals/${proposalId}/accept`, { method: 'POST' })
export const getTravelerProposalRoom = (requestId, proposalId) => request(`/api/traveler/custom-requests/${requestId}/proposals/${proposalId}/room`)
export const sendTravelerProposalMessage = (requestId, proposalId, body) => request(`/api/traveler/custom-requests/${requestId}/proposals/${proposalId}/messages`, json('POST', { body }))
