export async function getTravelerDashboard() {
  const user = JSON.parse(localStorage.getItem('tgm_user') || 'null')
  if (!user?.id) throw new Error('Please sign in to view your dashboard.')
  const response = await fetch('/api/traveler/dashboard', { headers: { Accept: 'application/json', 'X-User-Id': user.id } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Could not load dashboard')
  return body
}
