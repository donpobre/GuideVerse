import { Link } from 'react-router-dom'
import { Shield, BadgeCheck, Phone } from 'lucide-react'
import Footer from '../../../components/Footer/Footer'

export default function StaticPage({ title = 'Safety at GuideVerse', type = 'safety' }) {
  const content = {
    safety: {
      title: 'Safety at GuideVerse',
      body: 'GuideVerse is built on three pillars of traveler safety: escrow-protected payments, government ID verification for all providers, and a 24/7 SOS emergency response system.',
      items: ['Escrow protection — funds held until 24h after your trip', 'ID-verified providers with liveness checks', 'One-tap SOS with live geolocation for agents'],
    },
    about: { title: 'About GuideVerse', body: 'GuideVerse connects travelers with verified local experts. We believe in booking the person, not the tour.' },
    help: { title: 'Help Center', body: 'Browse topics or search for answers about bookings, payments, and safety.' },
    legal: { title: 'Terms & Privacy', body: 'Legal documents and privacy policy for GuideVerse platform users.' },
  }[type] || { title, body: 'Content page mockup.' }

  return (
    <div className="portal-page no-nav">
      <header className="home-top-bar">
        <div className="container home-top-inner">
          <Link to="/" className="home-logo"><span>GuideVerse</span></Link>
          <Link to="/auth" className="btn btn-primary btn-sm">Sign In</Link>
        </div>
      </header>
      <main className="container" style={{ maxWidth: 720, padding: 'var(--space-10) var(--space-4)' }}>
        <article className="article static-content">
          <h1>{content.title}</h1>
          <p style={{ margin: 'var(--space-4) 0', fontSize: 'var(--text-lg)' }}>{content.body}</p>
          {type === 'safety' && (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {content.items.map(item => (
                <li key={item} className="portal-card" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                  <Shield size={20} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                  {item}
                </li>
              ))}
            </ul>
          )}
          {type === 'help' && (
            <div style={{ display: 'grid', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
              {['How escrow protection works', 'What to do if your guide is late', 'Cancellation policies'].map(t => (
                <div key={t} className="portal-card card help-topic" style={{ cursor: 'pointer' }}>{t}</div>
              ))}
            </div>
          )}
          <Link to="/safety" className="btn btn-primary" style={{ marginTop: 'var(--space-6)' }}>Read the full safety policy</Link>
        </article>
      </main>
      <Footer />
    </div>
  )
}

export function SafetyPage() { return <StaticPage type="safety" /> }
export function AboutPage() { return <StaticPage type="about" /> }
export function HelpPage() { return <StaticPage type="help" /> }
export function LegalPage() { return <StaticPage type="legal" /> }
