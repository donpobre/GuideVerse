import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Globe, Search, Bell, User, Menu, X, Sun, Moon, LogOut } from 'lucide-react'
import { clearAuthSession } from '../../services/authSession'
import './Navbar.css'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [dark, setDark] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tgm_user') || 'null') } catch { return null }
  })

  useEffect(() => {
    const refreshUser = () => {
      try { setUser(JSON.parse(localStorage.getItem('tgm_user') || 'null')) } catch { setUser(null) }
    }
    refreshUser()
    window.addEventListener('tgm-auth-changed', refreshUser)
    return () => window.removeEventListener('tgm-auth-changed', refreshUser)
  }, [location.pathname])

  const logout = () => {
    clearAuthSession()
    setUser(null)
    setMenuOpen(false)
    navigate('/auth', { replace: true })
  }

  const toggleDark = () => {
    setDark(d => !d)
    document.documentElement.setAttribute('data-theme', dark ? '' : 'dark')
  }

  const navLinks = [
    { to: '/', label: 'Explore' },
    { to: '/search', label: 'Search' },
    ...(user?.primary_role === 'provider' ? [{ to: '/app/provider', label: 'Host' }] : user?.primary_role === 'traveler' ? [{ to: '/app/traveler', label: 'Trips' }] : []),
    { to: '/mockup', label: 'Screens' },
  ]

  const profilePath = user?.primary_role === 'provider' ? '/app/provider/settings' : '/app/traveler/settings'

  return (
    <header className="navbar" role="banner">
      <div className="navbar-inner container">
        {/* Logo */}
        <Link to="/" className="navbar-logo" aria-label="GuideVerse home">
          <span className="navbar-logo-icon"><Globe size={22} /></span>
          <span className="navbar-logo-text">GuideVerse</span>
        </Link>

        {/* Desktop nav links */}
        <nav className="navbar-links" aria-label="Primary navigation">
          {navLinks.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className={`navbar-link ${location.pathname === l.to ? 'active' : ''}`}
              aria-current={location.pathname === l.to ? 'page' : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Search bar – desktop */}
        <div className="navbar-search" role="search">
          <Search size={16} className="navbar-search-icon" aria-hidden="true" />
          <input
            className="navbar-search-input"
            placeholder="Search experiences…"
            aria-label="Search experiences"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && navigate(`/search${searchQuery.trim() ? `?q=${encodeURIComponent(searchQuery.trim())}` : ''}`)}
          />
        </div>

        {/* Actions */}
        <div className="navbar-actions">
          <button className="navbar-action-btn" onClick={toggleDark} aria-label="Toggle dark mode" title="Toggle dark mode">
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          {user ? <><Link to="/notifications" className="navbar-action-btn" aria-label="Notifications"><Bell size={20} /><span className="navbar-notif-dot" aria-label="New notifications" /></Link><Link to={profilePath} className="navbar-avatar" aria-label="Your profile" title={user.first_name || 'Your profile'}>{user.avatar_url ? <img src={user.avatar_url} alt="" /> : <User size={19} />}</Link><button className="navbar-action-btn navbar-logout" onClick={logout} aria-label="Log out" title="Log out"><LogOut size={19} /></button></> : <Link to="/auth" className="btn btn-primary btn-sm">Sign In</Link>}
        </div>

        {/* Mobile menu toggle */}
        <button
          className="navbar-menu-btn"
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <nav className="navbar-drawer" aria-label="Mobile navigation">
          {navLinks.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className={`navbar-drawer-link ${location.pathname === l.to ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          {user ? <><Link to="/notifications" className="navbar-drawer-link" onClick={() => setMenuOpen(false)}>Notifications</Link><Link to={profilePath} className="navbar-drawer-link" onClick={() => setMenuOpen(false)}>Profile</Link><button className="navbar-drawer-link navbar-drawer-logout" onClick={logout}><LogOut size={18} /> Log out</button></> : <Link to="/auth" className="navbar-drawer-link" onClick={() => setMenuOpen(false)}>Sign In</Link>}
        </nav>
      )}
    </header>
  )
}
