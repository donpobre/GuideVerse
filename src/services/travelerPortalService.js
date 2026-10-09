const headers = () => {
  const user = JSON.parse(localStorage.getItem('tgm_user') || 'null')
  if (!user?.id) throw new Error('Please sign in to continue.')
  return { Accept: 'application/json', 'Content-Type': 'application/json', 'X-User-Id': user.id }
}
async function request(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { ...headers(), ...options.headers } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.detail || 'Traveler data could not be loaded')
  return body
}
export const getTravelerTrips = () => request('/api/traveler/trips')
export const getTravelerConversations = () => request('/api/traveler/conversations')
export const sendTravelerMessage = (id, body) => request(`/api/traveler/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) })
export const generateTravelerPlan = prompt => request('/api/traveler/ai-planner', { method: 'POST', body: JSON.stringify({ prompt }) })
