import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, Play, Shield, BadgeCheck, Percent, Globe, MapPin, Calendar, Users, Sparkles, ArrowRight, User, CheckCircle2 } from 'lucide-react'
import { categories as mockCategories, providers as mockProviders } from '../../data/mockData'
import Footer from '../../components/Footer/Footer'
import { getPublicCategories, getPublicProviders } from '../../services/experienceService'
import { searchExperiences } from '../../services/searchService'
import './Home.css'

const today = new Date().toISOString().slice(0, 10)
const defaultStartDate = `${new Date().getFullYear()}-09-15`
const defaultEndDate = `${new Date().getFullYear()}-09-20`

const fallbackThingsToDo = [
  { id: 'tt1', title: 'Sunset Sailing Tour', meta: '$150 · ★4.7', tag: 'GuideVerse', tagType: 'native', image: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=200&q=60' },
  { id: 'tt2', title: "Magellan's Cross", meta: 'Historic landmark', tag: 'Free', tagType: 'info', image: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=200&q=60' },
  { id: 'tt3', title: 'Street Food Night Walk', meta: '$85 · ★4.9', tag: 'GuideVerse', tagType: 'native', image: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=200&q=60' },
  { id: 'tt4', title: 'Tops Lookout', meta: 'Best at sunset', tag: 'Free', tagType: 'info', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=200&q=60' },
  { id: 'tt5', title: 'Reef Diving', meta: '$120 · ★4.9', tag: 'GuideVerse', tagType: 'native', image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=200&q=60' },
]

const destinationSuggestions = ['Cebu, Philippines', 'Bohol, Philippines', 'Manila, Philippines', 'Palawan, Philippines', 'Bali, Indonesia', 'Kyoto, Japan']

function formatDateLabel(value) {
  if (!value) return ''
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function guestCount(value) {
  const count = Number.parseInt(value, 10)
  return Number.isNaN(count) ? 2 : count
}

export default function Home() {
  const navigate = useNavigate()
  const [searchVal, setSearchVal] = useState('Cebu, Philippines')
  const [startDate, setStartDate] = useState(defaultStartDate < today ? today : defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate < today ? today : defaultEndDate)
  const [guestsVal, setGuestsVal] = useState('2')
  const [selectedInterests, setSelectedInterests] = useState(['Diving', 'Food'])
  const [flexibleDates, setFlexibleDates] = useState(false)
  const [dateError, setDateError] = useState('')
  const [previewItems, setPreviewItems] = useState([])
  const [user] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('tgm_user') || 'null')
    } catch {
      return null
    }
  })

  const [categories, setCategories] = useState([])
  const [providers, setProviders] = useState([])

  useEffect(() => {
    getPublicCategories()
      .then(cats => setCategories(cats && cats.length ? cats : mockCategories))
      .catch(() => setCategories(mockCategories))

    getPublicProviders()
      .then(provs => setProviders(provs && provs.length ? provs : mockProviders))
      .catch(() => setProviders(mockProviders))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchExperiences({
        query: searchVal.trim(),
        filters: {
          category: [], language: [], themes: selectedInterests, timeOfDay: [], activityLevel: [], durationBucket: [],
          minPrice: '', maxPrice: '', rating: 0, groupType: '', instant: false, isAccessible: false,
          minTravelers: guestCount(guestsVal), dateStart: flexibleDates ? '' : startDate, dateEnd: flexibleDates ? '' : endDate,
        },
        sort: 'recommended',
        page: 1,
        signal: controller.signal,
      })
        .then(result => setPreviewItems((result.items || []).slice(0, 5).map(item => ({
          id: item.id,
          slug: item.slug,
          title: item.title,
          meta: `${item.currency === 'PHP' ? 'Php' : item.currency} ${Number(item.price || 0).toFixed(0)} · ★${Number(item.rating || 0).toFixed(1)}`,
          tag: item.is_instant_book ? 'Instant' : 'GuideVerse',
          tagType: 'native',
          image: item.image,
        }))))
        .catch(error => {
          if (error.name !== 'AbortError') setPreviewItems([])
        })
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [searchVal, selectedInterests, startDate, endDate, guestsVal, flexibleDates])

  const handleSearch = () => {
    navigate(`/search?${buildContextParams().toString()}`)
  }

  const buildContextParams = ({ includeDates = true, includeFlexible = true } = {}) => {
    const params = new URLSearchParams()
    const trimmedLocation = searchVal.trim()
    const interests = [...new Set(selectedInterests.map(interest => interest.trim()).filter(Boolean))]
    if (trimmedLocation) params.set('q', trimmedLocation)
    interests.forEach(interest => params.append('themes', interest))
    if (guestCount(guestsVal) > 1) params.set('min_travelers', String(guestCount(guestsVal)))
    if (includeDates && !flexibleDates && startDate) params.set('date_start', startDate)
    if (includeDates && !flexibleDates && endDate) params.set('date_end', endDate || startDate)
    if (includeFlexible && flexibleDates) params.set('flexible_dates', 'true')
    return params
  }

  const aiSearchUrl = `/search?ai=true&${buildContextParams({ includeDates: false }).toString()}`
  const customRequestUrl = `/app/traveler/requests?${(() => {
    const params = buildContextParams()
    params.set('destination', searchVal.trim())
    params.delete('q')
    params.set('group_type', 'private')
    return params.toString()
  })()}`
  const availableNowUrl = `/search?instant=true&${buildContextParams({ includeDates: false, includeFlexible: false }).toString()}`

  const handleStartDateChange = value => {
    setStartDate(value)
    if (endDate && value > endDate) setEndDate(value)
    setDateError('')
  }

  const handleEndDateChange = value => {
    setEndDate(value)
    setDateError(startDate && value < startDate ? 'End date must be on or after the start date.' : '')
  }

  const thingsToDo = previewItems.length ? previewItems : fallbackThingsToDo
  const searchSummary = [
    searchVal.trim() || 'Anywhere',
    flexibleDates ? 'Flexible dates' : startDate ? `${formatDateLabel(startDate)}${endDate && endDate !== startDate ? ` – ${formatDateLabel(endDate)}` : ''}` : 'Choose dates',
    `${guestCount(guestsVal)} traveler${guestCount(guestsVal) === 1 ? '' : 's'}`,
  ].join(' · ')

  const toggleInterest = (interest) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest))
    } else {
      setSelectedInterests([...selectedInterests, interest])
    }
  }

  return (
    <div className="homepage">
      {/* TOP NAV */}
      <nav className="navbar" role="navigation" aria-label="Main Navigation">
        <div className="navbar__inner">
          <Link to="/" className="nav-logo">
            <span className="mark">G</span>GuideVerse
          </Link>
          <div className="nav-links">
            <Link to="/search">Explore</Link>
            <a href="#how-it-works">How it works</a>
            <Link to="/app/provider/settings">Become a Provider</Link>
          </div>
          <div className="nav-right">
            {user ? (
              <Link to="/app/traveler" className="nav-profile">
                <div className="nav-profile__avatar">
                  <User size={16} />
                </div>
                <span className="nav-profile__name">{user.first_name || 'Jane'}</span>
              </Link>
            ) : (
              <>
                <Link to="/auth" className="btn-nav-outline">Log In</Link>
                <Link to="/auth?signup=true" className="btn-nav-primary">Sign Up</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main>
        {/* HERO */}
        <section className="hero" aria-label="Welcome to GuideVerse">
          <div className="hero__bg"></div>
          <div className="hero__scrim"></div>
          <div className="hero__inner">
            <div className="wrap">
              <div className="hero__eyebrow">Book the person, not the tour</div>
              <h1>Explore the world with someone who <em>lives there.</em></h1>
              <div className="hero__sub">
                Verified local guides, escrow-protected bookings, and an AI planner that mixes real experiences with free things worth seeing.
              </div>
            </div>
          </div>
        </section>

        {/* SEARCH ZONE */}
        <div className="wrap">
          <div className="search-zone">
            <div className="search-card">
              <div>
                <div className="search-card__body">
                  <div className="search-field">
                    <div className="search-field__label">
                      <MapPin size={12} className="field-icon" />
                      Where
                    </div>
                    <input
                      type="text"
                      value={searchVal}
                      onChange={e => setSearchVal(e.target.value)}
                      placeholder="Where to next?"
                      list="home-destinations"
                      aria-label="Destination"
                    />
                    <datalist id="home-destinations">
                      {destinationSuggestions.map(destination => <option key={destination} value={destination} />)}
                    </datalist>
                  </div>
                  <div className="search-field">
                    <div className="search-field__label">
                      <Calendar size={12} className="field-icon" />
                      When
                    </div>
                    <div className="date-range-inputs">
                      <input type="date" min={today} value={startDate} onChange={event => handleStartDateChange(event.target.value)} aria-label="Start date" />
                      <span aria-hidden="true">→</span>
                      <input type="date" min={startDate || today} value={endDate} onChange={event => handleEndDateChange(event.target.value)} aria-label="End date" disabled={flexibleDates} />
                    </div>
                  </div>
                  <div className="search-field">
                    <div className="search-field__label">
                      <Users size={12} className="field-icon" />
                      Guests
                    </div>
                    <select value={guestsVal} onChange={e => setGuestsVal(e.target.value)} aria-label="Number of travelers">
                      <option value="1">1 traveler</option>
                      <option value="2">2 travelers</option>
                      <option value="3">3 travelers</option>
                      <option value="4">4+ travelers</option>
                    </select>
                  </div>
                </div>
                <div className="interest-row">
                  <span className="interest-row__label">Into:</span>
                  {['Diving', 'Food', 'Culture', 'Adventure', 'Photography'].map(interest => {
                    const emojiMap = {
                      Diving: '🤿',
                      Food: '🍜',
                      Culture: '🏛',
                      Adventure: '🥾',
                      Photography: '📷'
                    }
                    const isSelected = selectedInterests.includes(interest)
                    return (
                      <button
                        key={interest}
                        className={`interest-chip ${isSelected ? 'sel' : ''}`}
                        onClick={() => toggleInterest(interest)}
                      >
                        {emojiMap[interest]} {interest}
                      </button>
                    )
                  })}
                </div>
                <div className="search-options-row">
                  <label className="flexible-date-toggle"><input type="checkbox" checked={flexibleDates} onChange={event => { setFlexibleDates(event.target.checked); setDateError('') }} /> <span>My dates are flexible</span></label>
                  {dateError && <span className="home-field-error" role="alert">{dateError}</span>}
                </div>
              </div>
              <div className="search-card__stub">
                <button className="search-btn" onClick={handleSearch} disabled={Boolean(dateError)}><Search size={16} /> Find my guide</button>
              </div>
            </div>

            <div className="search-summary" aria-live="polite">
              <span><CheckCircle2 size={15} /> {searchSummary}</span>
              <strong>{selectedInterests.length ? `${selectedInterests.length} interest${selectedInterests.length === 1 ? '' : 's'} selected` : 'Personalize your search'}</strong>
            </div>

            <div className="ai-toggle">
              <Sparkles size={15} className="ai-icon" />
              Prefer to just tell us?{' '}
              <Link to={aiSearchUrl}>Describe your trip in your own words →</Link>
            </div>

            {/* THINGS TO DO PREVIEW */}
            <div className="tt-preview">
              <div className="tt-preview__label">
                <MapPin size={13} />
                Things to do in {searchVal || 'your destination'}
              </div>
              <div className="tt-scroll">
                {thingsToDo.map(item => (
                  <div key={item.id} className="tt-card" role="button" tabIndex="0" onClick={() => item.slug ? navigate(`/experience/${item.slug}`) : handleSearch} onKeyDown={event => { if (event.key === 'Enter') item.slug ? navigate(`/experience/${item.slug}`) : handleSearch() }}>
                    <div className="tt-card__photo" style={{ backgroundImage: `url(${item.image})` }}>
                      <span className={`tt-card__tag tt-card__tag--${item.tagType}`}>
                        {item.tag}
                      </span>
                    </div>
                    <div className="tt-card__body">
                      <div className="tt-card__title">{item.title}</div>
                      <div className="tt-card__meta">{item.meta}</div>
                      <span className="tt-card__action">{item.slug ? 'View experience →' : 'Explore more →'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* PLAN YOUR WAY (QUICK ACTIONS) */}
        <section className="section section--tinted" id="how-it-works">
          <div className="wrap">
            <div className="section-head">
              <div>
                <h2>Plan your way</h2>
                <div className="sub">Four ways in, same verified providers underneath</div>
              </div>
            </div>
            <div className="quick-grid">
              <button className="quick-card quick-card--book" onClick={handleSearch}>
                <div className="quick-card__icon">
                  <Play size={18} />
                </div>
                <div className="quick-card__content">
                  <div className="quick-card__title">Book a Tour</div>
                  <div className="quick-card__desc">
                    Already know what you want? Browse and book a fixed-itinerary experience instantly.
                  </div>
                  <div className="quick-card__cta">
                    Browse experiences <ArrowRight size={12} />
                  </div>
                </div>
              </button>

              <button className="quick-card quick-card--ai" onClick={() => navigate(aiSearchUrl)}>
                <div className="quick-card__icon">
                  <Sparkles size={18} />
                </div>
                <div className="quick-card__content">
                  <div className="quick-card__title">AI Trip Planner</div>
                  <div className="quick-card__desc">
                    Describe your trip in a sentence — get a full day-by-day plan with real guides and free stops.
                  </div>
                  <div className="quick-card__cta">
                    Start planning <ArrowRight size={12} />
                  </div>
                </div>
              </button>

              <button className="quick-card quick-card--custom" onClick={() => navigate(customRequestUrl)}>
                <div className="quick-card__icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                  </svg>
                </div>
                <div className="quick-card__content">
                  <div className="quick-card__title">Custom Request</div>
                  <div className="quick-card__desc">
                    Post what you're after — local providers send you proposals to compare and accept.
                  </div>
                  <div className="quick-card__cta">
                    Post a request <ArrowRight size={12} />
                  </div>
                </div>
              </button>

              <button className="quick-card quick-card--instant" onClick={() => navigate(availableNowUrl)}>
                <div className="quick-card__icon">
                  <MapPin size={18} />
                </div>
                <div className="quick-card__content">
                  <div className="live-badge">
                    <span className="dot"></span>3 guides live
                  </div>
                  <div className="quick-card__title">Available Now</div>
                  <div className="quick-card__desc">
                    See who's free near you right now — book on the spot, ride-share style.
                  </div>
                  <div className="quick-card__cta">
                    See who's available <ArrowRight size={12} />
                  </div>
                </div>
              </button>
            </div>
          </div>
        </section>

        {/* MEET A LOCAL EXPERT */}
        <section className="section section--white">
          <div className="wrap">
            <div className="section-head">
              <div>
                <h2>Meet a local expert</h2>
                <div className="sub">Real people, real reviews, verified before they ever guide a trip</div>
              </div>
              <Link to="/search" className="section-head__link">
                See all guides →
              </Link>
            </div>
            <div className="guide-grid">
              {providers.slice(0, 4).map(p => (
                <div key={p.id} className="guide-card" onClick={() => navigate(`/provider/${p.id}`)}>
                  <div className="guide-card__photo" style={{ backgroundImage: `url(${p.image})` }}>
                    {p.verified && (
                      <span className="guide-card__badge">
                        <BadgeCheck size={10} /> Verified
                      </span>
                    )}
                  </div>
                  <div className="guide-card__body">
                    <div className="guide-card__name">{p.name}</div>
                    <div className="guide-card__meta">{p.subtype} · {p.location.split(',')[0]}</div>
                    <div className="guide-card__rating">
                      <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
                        <path d="M12 2l3 6.5 7 .9-5 5 1.3 7L12 18l-6.3 3.4L7 14.4l-5-5 7-.9z" />
                      </svg>
                      {p.trustScore || '5.0'} · {p.reviewCount || 0} tours
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TRUST BAND */}
        <section className="trust-band" aria-label="Trust signals">
          <div className="trust-item">
            <Shield size={18} className="icon" /> Escrow protected
          </div>
          <div className="trust-item">
            <BadgeCheck size={18} className="icon" /> ID-verified providers
          </div>
          <div className="trust-item">
            <Percent size={18} className="icon" /> 10–12% transparent fee
          </div>
          <div className="trust-item">
            <CheckCircle2 size={18} className="icon" /> Support before and during your trip
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
