const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { Accept: 'application/json', ...options.headers },
  })
  if (response.status === 204) return null
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Request failed')
  return body
}

export const getDestinationHub = (slug) => request(`/api/destinations/${encodeURIComponent(slug)}`)

export const getPublicProviderAvailability = (providerSlug, year, month) =>
  request(`/api/public/provider-availability/${encodeURIComponent(providerSlug)}?year=${year}&month=${month}`)
