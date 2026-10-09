export function clearAuthSession() {
  localStorage.removeItem('tgm_auth')
  localStorage.removeItem('tgm_user')
}
