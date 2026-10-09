async function request(path, options = {}) {
  let response
  try {
    response = await fetch(path, {
      ...options,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...options.headers },
    })
  } catch {
    throw new Error('Could not reach the authentication server. Please try again.')
  }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = typeof body.detail === 'string'
      ? body.detail
      : Array.isArray(body.detail)
        ? body.detail.map(item => item.msg?.replace(/^Value error, /, '')).filter(Boolean).join('. ')
        : ''
    throw new Error(detail || `Authentication request failed (${response.status})`)
  }
  return body
}

export const loginUser = (credentials) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
export const signupUser = (payload) => request('/api/auth/signup', { method: 'POST', body: JSON.stringify(payload) });
export const requestPasswordReset = (email) => request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
export const forgotPassword = requestPasswordReset; // alias used by Auth.jsx
export const socialLogin = (provider) => request(`/api/auth/oauth/${provider}`, { method: 'POST' });
export const getSocialProviders = () => request('/api/auth/oauth/providers')
export const exchangeSocialLogin = token => request('/api/auth/oauth/exchange', { method: 'POST', body: JSON.stringify({ token }) })
export const resetPassword = (token, password) => request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) })
export const completeSocialRole = (token, role) => request('/api/auth/complete-role', { method: 'POST', body: JSON.stringify({ token, role }) })
