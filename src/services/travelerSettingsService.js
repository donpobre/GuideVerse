const userHeaders = () => {
  const user = JSON.parse(localStorage.getItem('tgm_user') || 'null')
  if (!user?.id) throw new Error('Please sign in to manage your settings.')
  return { 'X-User-Id': user.id }
}
async function request(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { Accept: 'application/json', ...userHeaders(), ...options.headers } })
  if (response.status === 204) return null
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Could not save settings')
  return body
}
const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
export const getTravelerSettings = () => request('/api/traveler/settings')
export const updateTravelerProfile = profile => request('/api/traveler/settings/profile', json('PUT', profile))
export const updateNotificationPreferences = preferences => request('/api/traveler/settings/notifications', json('PUT', preferences))
export const getTravelerNotifications = () => request('/api/traveler/notifications')
export const createEmergencyContact = contact => request('/api/traveler/settings/emergency-contacts', json('POST', contact))
export const deleteEmergencyContact = id => request(`/api/traveler/settings/emergency-contacts/${id}`, { method: 'DELETE' })
export const updateAccountStatus = status => request('/api/traveler/settings/account-status', json('PUT', { status }))
export const getPaymentProviderStatus = () => request('/api/traveler/payment-methods/providers')
export const beginPaymentMethodSetup = provider => request(`/api/traveler/payment-methods/${provider}/setup`, json('POST', {}))
export const completePayPalSetup = token => request('/api/traveler/payment-methods/paypal/complete', json('POST', { token }))
export const deletePaymentMethod = id => request(`/api/traveler/payment-methods/${id}`, { method: 'DELETE' })
