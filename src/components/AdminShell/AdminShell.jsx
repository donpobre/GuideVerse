import { useEffect, useState } from 'react'
import { LogIn, LogOut, Menu, ShieldCheck, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { loginUser } from '../../services/authService'
import { clearAuthSession } from '../../services/authSession'
import AdminSidebar from '../AdminSidebar/AdminSidebar'
import './AdminShell.css'

const titles = {
  '/admin': 'Executive dashboard',
  '/admin/users': 'Accounts',
  '/admin/kyc': 'Verification desk',
  '/admin/moderation': 'Moderation queue',
  '/admin/requests': 'Custom request moderation',
  '/admin/escrow': 'Escrow control',
  '/admin/disputes': 'Dispute center',
  '/admin/destinations': 'Destinations & Hubs',
  '/admin/config': 'Platform configuration',
}

export default function AdminShell({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('tgm_user') || 'null'))
  const [menuOpen, setMenuOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => setMenuOpen(false), [location.pathname])

  const logout = () => {
    clearAuthSession()
    setUser(null)
    navigate('/admin', { replace: true })
  }

  const login = async event => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await loginUser({ email, password })
      if (result.user?.primary_role !== 'admin') throw new Error('This account does not have administrator access.')
      localStorage.setItem('tgm_auth', 'true')
      localStorage.setItem('tgm_user', JSON.stringify(result.user))
      setUser(result.user)
    } catch (caught) {
      setError(caught.message || 'Unable to sign in.')
    } finally {
      setLoading(false)
    }
  }

  if (!user || user.primary_role !== 'admin') {
    return <main className="admin-login-page"><section className="admin-login-card"><div className="admin-login-brand"><span><ShieldCheck size={22} /></span><div><strong>GuideVerse</strong><small>Operations console</small></div></div><p className="admin-login-eyebrow">Secure administration</p><h1>Welcome back</h1><p className="admin-login-copy">Sign in with an administrator account to manage the marketplace.</p>{error && <div className="inline-banner">{error}</div>}<form onSubmit={login} className="admin-login-form"><label><span>Email address</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" required /></label><label><span>Password</span><input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required /></label><button className="btn btn-primary btn-full" disabled={loading}>{loading ? 'Signing in…' : <><LogIn size={16} /> Sign in to admin</>}</button></form><button className="admin-login-back" onClick={() => navigate('/')}>Return to GuideVerse</button></section></main>
  }

  return <div className={`admin-shell ${menuOpen ? 'menu-open' : ''}`}><div className="admin-mobile-backdrop" onClick={() => setMenuOpen(false)} /><div className="admin-shell-sidebar"><AdminSidebar onNavigate={() => setMenuOpen(false)} /></div><div className="admin-shell-main"><header className="admin-topbar"><button className="admin-menu-button" onClick={() => setMenuOpen(open => !open)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button><div><span className="admin-topbar-kicker">GuideVerse operations</span><h1>{titles[location.pathname] || 'Admin workspace'}</h1></div><div className="admin-topbar-actions"><div className="admin-user-chip"><span>{(user.first_name || 'A').slice(0, 1)}{(user.last_name || '').slice(0, 1)}</span><div><strong>{user.first_name} {user.last_name}</strong><small>Administrator</small></div></div><button className="admin-logout" onClick={logout} title="Sign out"><LogOut size={17} /></button></div></header><main className="admin-content">{children}</main></div></div>
}