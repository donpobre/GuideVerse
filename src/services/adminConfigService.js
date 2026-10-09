const headers = () => {
  const user = JSON.parse(localStorage.getItem('tgm_user') || 'null')
  if (!user?.id) throw new Error('Sign in is required to manage platform configuration.')
  return { Accept: 'application/json', 'Content-Type': 'application/json', 'X-User-Id': user.id }
}
async function request(options = {}) {
  const response = await fetch('/api/admin/platform-config', { ...options, headers: headers() })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.detail || 'Platform configuration could not be saved')
  return body
}
export const getPlatformConfig = () => request()
export const updatePlatformConfig = serviceFeePercent => request({ method: 'PUT', body: JSON.stringify({ service_fee_percent: serviceFeePercent }) })
