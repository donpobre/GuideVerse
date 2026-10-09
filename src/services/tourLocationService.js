const headers = () => {
  const user = JSON.parse(localStorage.getItem('tgm_user') || 'null')
  if (!user?.id) throw new Error('Sign in is required to manage tour locations.')
  return { Accept: 'application/json', 'Content-Type': 'application/json', 'X-User-Id': user.id }
}

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers(), ...(options.headers || {}) } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.detail || 'Tour locations could not be updated')
  return body
}

export const getPublicTourLocations = async () => {
  const response = await fetch('/api/public/tour-locations')
  const body = await response.json().catch(() => [])
  if (!response.ok) throw new Error(body.detail || 'Tour locations could not be loaded')
  return body
}

export const getAdminTourLocations = () => request('/api/admin/tour-locations')
export const createAdminTourLocation = name => request('/api/admin/tour-locations', { method: 'POST', body: JSON.stringify({ name }) })
export const updateAdminTourLocation = (id, name) => request(`/api/admin/tour-locations/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ name }) })
export const deleteAdminTourLocation = id => request(`/api/admin/tour-locations/${encodeURIComponent(id)}`, { method: 'DELETE' })