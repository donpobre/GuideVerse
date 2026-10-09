const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
import { providerAuthHeaders } from './providerAuth'

export async function createExperience(payload) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  Object.assign(headers, providerAuthHeaders())
  const response = await fetch(`${API_BASE_URL}/api/provider/experiences`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Could not save the experience')
  return body
}

const providerHeaders = () => {
  const headers = { Accept: 'application/json' }
  Object.assign(headers, providerAuthHeaders())
  return headers
}

async function providerRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: { ...providerHeaders(), ...options.headers } })
  if (response.status === 204) return null
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Experience request failed')
  return body
}

export const listProviderExperiences = () => providerRequest('/api/provider/experiences')
export const getProviderExperience = id => providerRequest(`/api/provider/experiences/${encodeURIComponent(id)}`)
export const updateExperience = (id, payload) => providerRequest(`/api/provider/experiences/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
export const deleteExperience = id => providerRequest(`/api/provider/experiences/${encodeURIComponent(id)}`, { method: 'DELETE' })
