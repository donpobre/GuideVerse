import { useNavigate } from 'react-router-dom'
import { Compass, ArrowRight } from 'lucide-react'
import './Splash.css'

const slides = [
  { img: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200&q=80', city: 'Santorini, Greece' },
  { img: 'https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=1200&q=80', city: 'Kyoto, Japan' },
  { img: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&q=80', city: 'Paris, France' },
]

export default function Splash() {
  const navigate = useNavigate()
  return (
    <main className="splash" aria-label="Welcome to GetOut">
      {/* Background slideshow */}
      <div className="splash-bg" aria-hidden="true">
        {slides.map((s, i) => (
          <div key={i} className={`splash-slide slide-${i}`}>
            <img src={s.img} alt={s.city} />
          </div>
        ))}
        <div className="splash-overlay" />
      </div>

      {/* Content */}
      <div className="splash-content">
        {/* Logo */}
        <div className="splash-logo">
          <div className="splash-logo-icon"><Compass size={28} /></div>
          <span className="splash-logo-text">GetOut</span>
        </div>

        {/* Tagline */}
        <h1 className="splash-title">
          Explore the world,<br />
          <span className="splash-title-accent">your way</span>
        </h1>
        <p className="splash-sub">
          AI-powered experiences with local guides,<br />
          tailored to your unique travel style.
        </p>

        {/* Slide labels */}
        <div className="splash-cities" aria-hidden="true">
          {slides.map((s, i) => (
            <span key={i} className="splash-city-dot">
              <span className="dot" />
              {s.city}
            </span>
          ))}
        </div>

        {/* CTAs */}
        <div className="splash-ctas">
          <button
            className="btn btn-primary btn-lg"
            onClick={() => navigate('/onboarding')}
          >
            Get Started <ArrowRight size={18} />
          </button>
          <button
            className="btn btn-ghost splash-signin"
            onClick={() => navigate('/auth')}
          >
            Already have an account? <strong>Sign In</strong>
          </button>
        </div>
      </div>
    </main>
  )
}
