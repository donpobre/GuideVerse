export function providerAuthHeaders() {
  try {
    const user = JSON.parse(localStorage.getItem('tgm_user') || 'null')
    if (user?.id) return { 'X-User-Id': user.id }
  } catch {}
  return import.meta.env.VITE_PROVIDER_ID ? { 'X-Provider-Id': import.meta.env.VITE_PROVIDER_ID } : {}
}
