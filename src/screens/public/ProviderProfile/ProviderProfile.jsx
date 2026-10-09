import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BadgeCheck, MapPin, Star, Play, ChevronLeft, ChevronRight, Lock, Zap, Share2 } from 'lucide-react'
import Footer from '../../../components/Footer/Footer'
import { getPublicProvider } from '../../../services/providerProfileService'
import { getPublicProviderAvailability } from '../../../services/destinationService'

export default function ProviderProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [provider, setProvider] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [availability, setAvailability] = useState([])

  useEffect(() => {
    setProvider(null)
    setError('')
    setLoading(true)
    getPublicProvider(id)
      .then(setProvider)
      .catch(error => setError(error.message))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (provider) {
      getPublicProviderAvailability(id, currentYear, currentMonth)
        .then(setAvailability)
        .catch(console.error)
    }
  }, [provider, currentYear, currentMonth, id])

  if (loading) return <div style={{ padding: '100px 20px', textAlign: 'center' }}>Loading provider...</div>
  if (error) return (
    <div style={{ padding: '100px 20px', textAlign: 'center' }}>
      <h1>Provider unavailable</h1>
      <p>{error}</p>
      <Link className="btn btn-primary" to="/search">Browse experiences</Link>
    </div>
  )
  if (!provider) return null

  const name = `${provider.first_name} ${provider.last_name}`

  const nextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const prevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate()
  const getFirstDayOfMonth = (year, month) => new Date(year, month - 1, 1).getDay()

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth)
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
    const days = []
    
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="pp2-cal-day pp2-cal-day--empty"></div>)
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let i = 1; i <= daysInMonth; i++) {
      const dateString = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      const currentSlot = availability.find(a => a.date === dateString)
      const dateObj = new Date(currentYear, currentMonth - 1, i)
      
      let statusClass = ''
      if (dateObj < today) {
         statusClass = 'pp2-cal-day--past'
      } else if (currentSlot) {
        if (currentSlot.status === 'open') statusClass = 'pp2-cal-day--open'
        else if (currentSlot.status === 'booked' || currentSlot.status === 'unavailable') statusClass = 'pp2-cal-day--full'
      }

      days.push(
        <div key={i} className={`pp2-cal-day ${statusClass}`}>
          {i}
        </div>
      )
    }
    return days
  }

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

  return (
    <div className="pp2-page-wrapper">
      <style>{`
        :root{
          --color-primary:#142B52; --color-primary-600:#1D3A6B; --color-primary-100:#E7ECF4;
          --color-accent:#C9A227; --color-accent-600:#B08F1F; --color-accent-100:#F6EFD6;
          --color-bg:#F7F5F0; --color-surface:#FFFFFF; --color-ink:#16202E; --color-muted:#5B6472; --color-faint:#8A93A2;
          --color-border:#E3E0D6; --color-success:#1E6B4F; --color-success-100:#E9F5EE;
        }
        .pp2-page-wrapper { background:var(--color-bg); color:var(--color-ink); min-height: 100vh; }
        .pp2-kicker{font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--color-accent-600);margin-bottom:8px;display:flex;align-items:center;gap:8px}
        .pp2-kicker::before{content:'';width:20px;height:2px;background:var(--color-accent)}
        
        .pp2-crumbbar{background:var(--color-surface);border-bottom:1px solid var(--color-border)}
        .pp2-crumbbar__inner{max-width:1280px;margin:0 auto;padding:13px 28px;display:flex;gap:8px;font-size:12.5px;color:var(--color-faint)}
        .pp2-crumbbar__sep{color:var(--color-border)}
        .pp2-crumbbar__current{color:var(--color-ink);font-weight:600}
        
        .pp2-page{max-width:1280px;margin:0 auto;padding:0 28px 80px}
        
        .pp2-cover{height:180px;border-radius:0 0 24px 24px;overflow:hidden;background-size:cover;background-position:center;background-color:var(--color-primary-100)}
        .pp2-profile-header{display:flex;align-items:flex-end;gap:20px;margin:-52px 0 26px;flex-wrap:wrap}
        .pp2-profile-avatar{width:112px;height:112px;border-radius:50%;object-fit:cover;border:5px solid var(--color-surface);box-shadow:0 4px 14px rgba(20,43,82,.18); background:var(--color-surface); display:flex; align-items:center; justify-content:center; font-size:36px; font-weight:700; color:var(--color-primary);}
        .pp2-profile-header__info{flex:1;padding-bottom:4px}
        .pp2-profile-name-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
        .pp2-profile-name-row h1{font-size:28px;margin:0; font-weight:700;}
        .pp2-verified-badge{display:inline-flex;align-items:center;gap:5px;background:var(--color-success-100);color:var(--color-success);font-size:12px;font-weight:700;padding:4px 11px;border-radius:999px}
        .pp2-profile-sub{font-size:14px;color:var(--color-muted);margin-top:5px}
        .pp2-profile-tags{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
        .pp2-profile-tag{font-size:11.5px;font-weight:700;padding:5px 12px;border-radius:999px;background:var(--color-primary-100);color:var(--color-primary)}
        .pp2-share-btn{padding:10px 18px;border-radius:10px;border:1px solid var(--color-border);background:#fff;font-size:13.5px;font-weight:600;display:flex;align-items:center;gap:7px; cursor:pointer;}
        
        .pp2-stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:32px}
        .pp2-stat-box{background:#fff;border:1px solid var(--color-border);border-radius:14px;padding:18px;text-align:center}
        .pp2-stat-box strong{display:block;font-size:23px;font-weight:600}
        .pp2-stat-box span{font-size:11.5px;color:var(--color-muted);text-transform:uppercase;letter-spacing:.03em}
        
        .pp2-body-grid{display:grid;grid-template-columns:1fr 360px;gap:32px;align-items:start}
        
        .pp2-section-card{background:var(--color-surface);border:1px solid var(--color-border);border-radius:18px;padding:30px;margin-bottom:24px}
        .pp2-section-card h2{font-size:22px;margin:0 0 16px; font-weight:700;}
        
        .pp2-video-intro{position:relative;height:220px;border-radius:16px;overflow:hidden;background:linear-gradient(135deg,#0F1B2E,#1D3A6B);display:flex;align-items:center;justify-content:center;margin-bottom:20px;cursor:pointer}
        .pp2-video-intro__play{width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,.15);border:2px solid #fff;display:flex;align-items:center;justify-content:center}
        .pp2-video-intro__label{position:absolute;bottom:14px;left:16px;font-size:12.5px;color:#fff;background:rgba(0,0,0,.4);padding:4px 11px;border-radius:8px}
        .pp2-bio-text{font-size:1rem;color:var(--color-muted);line-height:1.75;max-width:680px}
        
        .pp2-cal-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
        .pp2-cal-nav__month{font-weight:700;font-size:16px}
        .pp2-cal-nav__btn{width:32px;height:32px;border-radius:9px;border:1px solid var(--color-border);background:#fff;display:flex;align-items:center;justify-content:center; cursor:pointer;}
        .pp2-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
        .pp2-cal-daylabel{text-align:center;font-size:10.5px;font-weight:700;color:var(--color-faint);text-transform:uppercase;padding-bottom:6px}
        .pp2-cal-day{aspect-ratio:1;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600}
        .pp2-cal-day--open{background:var(--color-success-100);color:var(--color-success);}
        .pp2-cal-day--full{background:var(--color-bg);color:var(--color-faint);text-decoration:line-through;}
        .pp2-cal-day--past{color:var(--color-faint); opacity: 0.5;}
        .pp2-cal-day--empty{background:transparent}
        .pp2-cal-legend{display:flex;gap:16px;margin-top:14px;font-size:12px;color:var(--color-muted)}
        .pp2-cal-legend span{display:flex;align-items:center;gap:6px}
        .pp2-cal-legend .pp2-dot{width:9px;height:9px;border-radius:3px}
        
        .pp2-portfolio-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
        .pp2-portfolio-item{height:120px;border-radius:12px;background-size:cover;background-position:center}
        
        .pp2-exp-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
        .pp2-exp-card{background:#fff;border:1px solid var(--color-border);border-radius:15px;overflow:hidden;cursor:pointer}
        .pp2-exp-card:hover{box-shadow:0 12px 26px rgba(20,43,82,.12)}
        .pp2-exp-card__photo{height:130px;background-size:cover;background-position:center;position:relative}
        .pp2-exp-card__price{position:absolute;bottom:9px;right:9px;background:rgba(20,43,82,.85);color:#fff;font-weight:600;padding:4px 10px;border-radius:8px;font-size:12.5px}
        .pp2-exp-card__body{padding:12px 14px}
        .pp2-exp-card__title{font-weight:700;font-size:13.5px;margin-bottom:4px}
        .pp2-exp-card__meta{font-size:11.5px;color:var(--color-muted)}
        
        .pp2-review-summary{display:flex;gap:32px;align-items:center;margin-bottom:22px;flex-wrap:wrap}
        .pp2-review-score strong{font-size:40px;font-weight:700;display:block}
        .pp2-review-score .pp2-stars{color:var(--color-accent);font-size:14px;margin:4px 0}
        .pp2-review-score span{font-size:12px;color:var(--color-muted)}
        .pp2-review-bars{flex:1;min-width:200px}
        .pp2-review-bar-row{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--color-muted);margin-bottom:6px}
        .pp2-review-bar-row .pp2-label{width:44px;flex-shrink:0}
        .pp2-review-bar-track{flex:1;height:6px;background:var(--color-border);border-radius:3px;overflow:hidden}
        .pp2-review-bar-fill{height:100%;background:var(--color-accent);border-radius:3px}
        .pp2-review-bar-row .pp2-pct{width:36px;text-align:right}
        
        .pp2-booking-panel{position:sticky;top:24px;background:var(--color-primary);border-radius:20px;padding:26px;color:#fff;box-shadow:0 20px 44px -12px rgba(20,43,82,.4)}
        .pp2-instant-ribbon{display:inline-flex;align-items:center;gap:6px;background:rgba(235,212,138,.15);border:1px solid rgba(235,212,138,.4);color:#F0DFA0;font-size:11px;font-weight:800;padding:6px 12px;border-radius:999px;margin-bottom:16px}
        .pp2-bk-price{display:flex;align-items:baseline;gap:8px;margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid rgba(255,255,255,.14)}
        .pp2-bk-price__from{font-size:13px;color:rgba(255,255,255,.65)}
        .pp2-bk-price__amount{font-weight:700;font-size:30px}
        .pp2-bk-price__unit{font-size:13px;color:rgba(255,255,255,.65)}
        .pp2-bk-response{font-size:13px;color:rgba(255,255,255,.85);margin-bottom:18px;display:flex;align-items:center;gap:8px}
        .pp2-btn-book-primary{width:100%;background:var(--color-accent);color:var(--color-primary);border:none;border-radius:12px;padding:14px;font-weight:700;font-size:14.5px;margin-bottom:10px; cursor:pointer;}
        .pp2-btn-book-outline{width:100%;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.3);color:#fff;border-radius:12px;padding:13px;font-weight:600;font-size:14px; cursor:pointer;}
        .pp2-escrow-note{display:flex;align-items:center;gap:7px;font-size:11.5px;color:rgba(255,255,255,.65);margin-top:16px;justify-content:center}
        
        @media (max-width:900px){.pp2-body-grid{grid-template-columns:1fr}.pp2-booking-panel{position:static}.pp2-stat-row,.pp2-exp-grid,.pp2-portfolio-grid{grid-template-columns:repeat(2,1fr)}}
      `}</style>

      <div className="pp2-crumbbar">
        <div className="pp2-crumbbar__inner">
          <Link to="/">GuideVerse</Link>
          <span className="pp2-crumbbar__sep">/</span>
          <Link to="/">Provider</Link>
          <span className="pp2-crumbbar__sep">/</span>
          <span className="pp2-crumbbar__current">{name}</span>
        </div>
      </div>

      <div className="pp2-page">
        <div className="pp2-cover" style={{ backgroundImage: provider.cover_url ? `url(${provider.cover_url})` : undefined }}></div>
        <div className="pp2-profile-header">
          {provider.avatar_url ? (
            <img className="pp2-profile-avatar" src={provider.avatar_url} alt={name} />
          ) : (
            <div className="pp2-profile-avatar">{provider.first_name[0]}{provider.last_name[0]}</div>
          )}
          <div className="pp2-profile-header__info">
            <div className="pp2-profile-name-row">
              <h1>{name}</h1>
              {provider.identity_verified && <span className="pp2-verified-badge"><BadgeCheck size={14} /> Verified</span>}
            </div>
            <div className="pp2-profile-sub">
              {(provider.categories || []).join(' · ')} {provider.base_address ? `· ${provider.base_address}` : ''} · Speaks {(provider.languages || []).join(', ')}
            </div>
          </div>
          <button className="pp2-share-btn"><Share2 size={15} />Share</button>
        </div>

        <div className="pp2-stat-row">
          <div className="pp2-stat-box"><strong>{Number(provider.trust_score).toFixed(1)}</strong><span>Trust Score</span></div>
          <div className="pp2-stat-box"><strong>{provider.review_count}</strong><span>Reviews</span></div>
          <div className="pp2-stat-box"><strong>{provider.years_experience || 0}</strong><span>Years Exp</span></div>
          <div className="pp2-stat-box"><strong>&lt; 1 hr</strong><span>Response time</span></div>
        </div>

        <div className="pp2-body-grid">
          <div>
            <div className="pp2-section-card">
              <div className="pp2-kicker">About</div>
              <h2>Meet {provider.first_name}</h2>
              {provider.video_intro_url && (
                <div className="pp2-video-intro" onClick={() => window.open(provider.video_intro_url, '_blank')}>
                  <div className="pp2-video-intro__play"><Play color="#fff" fill="#fff" size={24} /></div>
                  <span className="pp2-video-intro__label">60s introduction from {provider.first_name}</span>
                </div>
              )}
              <p className="pp2-bio-text">{provider.bio}</p>
            </div>

            <div className="pp2-section-card">
              <div className="pp2-kicker">Availability</div>
              <h2>Book {provider.first_name}'s time</h2>
              <div className="pp2-cal-nav">
                <button className="pp2-cal-nav__btn" onClick={prevMonth}><ChevronLeft size={16} /></button>
                <span className="pp2-cal-nav__month">{monthNames[currentMonth - 1]} {currentYear}</span>
                <button className="pp2-cal-nav__btn" onClick={nextMonth}><ChevronRight size={16} /></button>
              </div>
              <div className="pp2-cal-grid">
                <div className="pp2-cal-daylabel">S</div><div className="pp2-cal-daylabel">M</div><div className="pp2-cal-daylabel">T</div><div className="pp2-cal-daylabel">W</div><div className="pp2-cal-daylabel">T</div><div className="pp2-cal-daylabel">F</div><div className="pp2-cal-daylabel">S</div>
                {renderCalendar()}
              </div>
              <div className="pp2-cal-legend">
                <span><span className="pp2-dot" style={{ background: 'var(--color-success-100)' }}></span>Available</span>
                <span><span className="pp2-dot" style={{ background: 'var(--color-bg)' }}></span>Booked</span>
              </div>
            </div>

            {(provider.portfolio_urls && provider.portfolio_urls.length > 0) && (
              <div className="pp2-section-card">
                <div className="pp2-kicker">Behind the Scenes</div>
                <h2>Portfolio</h2>
                <div className="pp2-portfolio-grid">
                  {provider.portfolio_urls.map((url, i) => (
                    <div key={i} className="pp2-portfolio-item" style={{ backgroundImage: `url(${url})` }}></div>
                  ))}
                </div>
              </div>
            )}

            {(provider.listings && provider.listings.length > 0) && (
              <div className="pp2-section-card">
                <div className="pp2-kicker">Bookable</div>
                <h2>Published experiences</h2>
                <div className="pp2-exp-grid">
                  {provider.listings.map(exp => (
                    <div key={exp.id} className="pp2-exp-card" onClick={() => navigate(`/experience/${exp.slug}`)}>
                      <div className="pp2-exp-card__photo" style={{ backgroundImage: `url(${exp.image || 'https://via.placeholder.com/400x300?text=Experience'})` }}>
                        <span className="pp2-exp-card__price">{exp.currency} {Number(exp.base_price).toFixed(2)}</span>
                      </div>
                      <div className="pp2-exp-card__body">
                        <div className="pp2-exp-card__title">{exp.title}</div>
                        <div className="pp2-exp-card__meta">
                          {exp.duration_minutes} mins · {exp.meeting_address}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pp2-section-card">
              <div className="pp2-kicker">What Travelers Say</div>
              <h2>Reviews</h2>
              <div className="pp2-review-summary">
                <div className="pp2-review-score">
                  <strong>{Number(provider.trust_score).toFixed(1)}</strong>
                  <div className="pp2-stars">★★★★★</div>
                  <span>{provider.review_count} reviews</span>
                </div>
                <div className="pp2-review-bars">
                  <div className="pp2-review-bar-row"><span className="pp2-label">5 stars</span><div className="pp2-review-bar-track"><div className="pp2-review-bar-fill" style={{ width: '85%' }}></div></div><span className="pp2-pct">85%</span></div>
                  <div className="pp2-review-bar-row"><span className="pp2-label">4 stars</span><div className="pp2-review-bar-track"><div className="pp2-review-bar-fill" style={{ width: '10%' }}></div></div><span className="pp2-pct">10%</span></div>
                  <div className="pp2-review-bar-row"><span className="pp2-label">3 stars</span><div className="pp2-review-bar-track"><div className="pp2-review-bar-fill" style={{ width: '5%' }}></div></div><span className="pp2-pct">5%</span></div>
                </div>
              </div>
              {provider.review_count === 0 && <p>No reviews yet.</p>}
            </div>

          </div>

          <aside className="pp2-booking-panel">
            <div className="pp2-instant-ribbon"><Zap size={14} fill="currentColor" /> Usually responds quickly</div>
            <div className="pp2-bk-price">
              <span className="pp2-bk-price__from">From</span>
              <span className="pp2-bk-price__amount">
                {provider.currency} {provider.hourly_rate ? Number(provider.hourly_rate).toFixed(0) : (provider.listings?.[0] ? Number(provider.listings[0].base_price).toFixed(0) : '0')}
              </span>
              <span className="pp2-bk-price__unit">per hour</span>
            </div>
            <div className="pp2-bk-response">
              <BadgeCheck size={15} color="#EBD48A" />
              {provider.is_accepting_custom_requests ? 'Accepting custom requests this week' : 'Currently unavailable for direct requests'}
            </div>
            <button className="pp2-btn-book-primary" disabled={!provider.is_accepting_custom_requests} onClick={() => navigate('/custom-requests')}>Request Custom Booking</button>
            <button className="pp2-btn-book-outline" onClick={() => navigate('/auth')}>Send a Message</button>
            <div className="pp2-escrow-note"><Lock size={13} />Payment held in escrow, released 24h after your tour</div>
          </aside>
        </div>
      </div>
      <Footer />
    </div>
  )
}
