import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Compass,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  User,
  X,
  Zap,
} from 'lucide-react'
import { getExperience } from '../../../services/experienceService'
import Footer from '../../../components/Footer/Footer'
import './ExperienceDetail.css'

const faqItems = [
  { q: 'What should I wear?', a: 'Wear light, comfortable clothing and shoes with grip. Bring a hat or light layer if you are sensitive to sun or sea breeze.' },
  { q: 'Is this suitable for children?', a: 'Yes — families are welcome as long as children are supervised. Final suitability may depend on weather and route conditions.' },
  { q: 'Can I customize the route?', a: 'Yes. You can send a custom request to the guide before booking if you want to adjust stops, pace, or focus areas.' },
]

const formatCurrency = (currency, value) => {
  const amount = Number(value || 0).toFixed(0)
  if (currency === 'PHP') return `Php ${amount}`
  if (currency === 'USD') return `$${amount}`
  return `${currency} ${amount}`
}

function personLabel(rule) {
  return String(rule).replace('-', '–')
}

function safeDescriptionMarkup(value) {
  const source = String(value || '')
  if (!/<\/?(p|h[1-3]|strong|b|ul|ol|li|br)\b/i.test(source)) return null
  const template = document.createElement('template')
  template.innerHTML = source
  template.content.querySelectorAll('*').forEach(element => {
    const allowed = ['P', 'H1', 'H2', 'H3', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'BR', 'A']
    if (!allowed.includes(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes))
      return
    }
    Array.from(element.attributes).forEach(attribute => element.removeAttribute(attribute.name))
    if (element.tagName === 'A') {
      const href = element.getAttribute('href')
      if (!href || !/^https?:\/\//i.test(href)) element.replaceWith(...Array.from(element.childNodes))
      else {
        element.setAttribute('href', href)
        element.setAttribute('target', '_blank')
        element.setAttribute('rel', 'noreferrer')
      }
    }
  })
  return { __html: template.innerHTML }
}

export default function ExperienceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [exp, setExp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [guests, setGuests] = useState(2)
  const [preferredDate, setPreferredDate] = useState('')
  const [customGroupType, setCustomGroupType] = useState('private')
  const [customInquiry, setCustomInquiry] = useState('')
  const [activeImage, setActiveImage] = useState(0)
  const [faqOpen, setFaqOpen] = useState(0)
  const customizeRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError('')
    getExperience(id, { signal: controller.signal })
      .then(data => {
        setExp(data)
        setGuests(Math.min(2, data?.maxGuests || 2))
      })
      .catch(error => {
        if (error.name !== 'AbortError') setLoadError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [id])

  const matchesGroup = (rule, count) => {
    const values = String(rule).match(/\d+/g)?.map(Number) || []
    if (values.length === 1) return count === values[0]
    return values.length > 1 && count >= values[0] && count <= values[1]
  }

  const selectedPriceGroup = useMemo(() => exp?.priceGroups?.find(group => matchesGroup(group.persons, guests)), [exp, guests])
  const heroImages = exp?.images?.length ? exp.images : exp?.image ? [exp.image] : []
  const currentImage = heroImages[activeImage] || heroImages[0]
  const basePrice = selectedPriceGroup?.price ?? exp?.price ?? 0
  const totalPrice = basePrice * guests
  const leadReview = exp?.reviews?.[0]

  const scrollToCustomize = () => {
    customizeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleReserve = () => {
    let user = null
    try { user = JSON.parse(localStorage.getItem('tgm_user') || 'null') } catch {}
    if (!user?.id) {
      sessionStorage.setItem('gv:checkout_intent', JSON.stringify({ experienceId: exp.id, date: preferredDate, guests }))
      navigate(`/auth?redirect=/app/traveler/checkout/${exp.id}&date=${preferredDate}&guests=${guests}`)
      return
    }
    navigate(`/app/traveler/checkout/${exp.id}?date=${preferredDate}&guests=${guests}`)
  }

  if (loading) return <div className="portal-page no-nav"><main className="experience-page"><div className="section-card"><p>Loading experience…</p></div></main></div>
  if (loadError || !exp) return <div className="portal-page no-nav"><main className="experience-page"><div className="section-card"><h2>Experience unavailable</h2><p>{loadError || 'This experience could not be found.'}</p><button className="share-btn" onClick={() => navigate('/search')}>Browse experiences</button></div></main></div>

  const themeBadges = exp.themes?.length ? exp.themes : [exp.category].filter(Boolean)
  const activityLevel = exp.activityLevel || 'Minimal'
  const languageTags = exp.languages?.length ? exp.languages : ['English']

  return (
    <div className="experience-detail-page portal-page no-nav">
      <div className="crumbbar">
        <div className="crumbbar__inner">
          <Link to="/">Explore</Link>
          <span className="crumbbar__sep">/</span>
          <Link to="/search">Experiences</Link>
          <span className="crumbbar__sep">/</span>
          <span className="crumbbar__current">{exp.title}</span>
        </div>
      </div>

      <main className="experience-page">
        <div className="title-row">
          <div>
            <button className="back-link" type="button" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back</button>
            <h1>{exp.title}</h1>
            <div className="title-meta">
              <span className="rating"><Star size={15} fill="currentColor" /> {Number(exp.rating || 0).toFixed(1)}</span>
              <span>{exp.reviewCount || 0} reviews</span>
              <span>{exp.location}</span>
            </div>
          </div>
          <button className="share-btn" type="button"><Share2 size={15} /> Share</button>
        </div>

        <div className="badge-row">
          {themeBadges.slice(0, 3).map(tag => <span key={tag} className="theme-tag">{tag}</span>)}
          <span className="private-tag">{exp.groupType === 'private' ? 'Private experience' : 'Small-group friendly'}</span>
          <span className="match-tag"><ShieldCheck size={13} /> Verified host</span>
        </div>

        <div className="body-grid">
          <div>
            <section className="gallery">
              <div className="gallery__main" style={{ backgroundImage: currentImage ? `url(${currentImage})` : undefined }}>
                {heroImages.length > 1 && <button className="gallery__main-nav gallery__main-nav--prev" type="button" onClick={() => setActiveImage(value => (value - 1 + heroImages.length) % heroImages.length)}><ChevronLeft size={18} /></button>}
                {heroImages.length > 1 && <button className="gallery__main-nav gallery__main-nav--next" type="button" onClick={() => setActiveImage(value => (value + 1) % heroImages.length)}><ChevronRight size={18} /></button>}
                <div className="gallery__counter">{heroImages.length ? `${activeImage + 1}/${heroImages.length}` : '1/1'}</div>
              </div>
              <div className="gallery__caption">A tailored local experience with thoughtful pacing, great storytelling, and photo-worthy moments throughout.</div>
              <div className="gallery__thumbstrip">
                {(heroImages.length ? heroImages : [null, null, null, null, null, null]).slice(0, 6).map((image, index) => <button key={`${image || 'fallback'}-${index}`} type="button" className={`gallery__thumb ${index === activeImage ? 'active' : ''}`} style={image ? { backgroundImage: `url(${image})` } : undefined} onClick={() => image && setActiveImage(index)} />)}
              </div>
            </section>

            <section className="section-card">
              <div className="kicker">Overview</div>
              <h2>What this experience feels like</h2>
              {safeDescriptionMarkup(exp.description) ? <div className="lead-copy rich-description-output" dangerouslySetInnerHTML={safeDescriptionMarkup(exp.description)} /> : <p className="lead-copy">{exp.description}</p>}
              <div className="overview-points">
                <div className="overview-point"><Clock3 size={17} /><div><strong>{exp.duration}</strong><span>Carefully paced with room to enjoy each stop.</span></div></div>
                <div className="overview-point"><Users size={17} /><div><strong>Up to {exp.maxGuests} travelers</strong><span>{exp.groupType === 'private' ? 'Private format for a more personal pace.' : 'Small groups keep the experience relaxed.'}</span></div></div>
                <div className="overview-point"><MapPin size={17} /><div><strong>{exp.location}</strong><span>Meeting details shared clearly after you reserve.</span></div></div>
              </div>
            </section>

            <section className="section-card">
              <div className="kicker">Itinerary</div>
              <h2>Where you'll go</h2>
              <div className="timeline">
                {exp.itinerary?.length ? exp.itinerary.map((stop, index) => <div key={stop.id || stop.stop_order || index} className="timeline-stop"><div className="timeline-num">{String(index + 1).padStart(2, '0')}</div><div className="timeline-body"><strong>{stop.title}</strong>{stop.description ? ` — ${stop.description}` : ''}</div></div>) : <div className="timeline-stop"><div className="timeline-num">01</div><div className="timeline-body">Your guide confirms the exact route and pacing after booking.</div></div>}
              </div>
              <span className="customizable-tag"><Sparkles size={12} /> This tour can be customized</span>
            </section>

            <section className="section-card">
              <div className="kicker">The Details</div>
              <h2>What's included</h2>
              <div className="inc-grid">
                <div>
                  <div className="inc-col-title">Included</div>
                  <ul className="inc-list yes">{(exp.inclusions?.length ? exp.inclusions : ['Guide support', 'Thoughtful pacing', 'Planning help']).map(item => <li key={item}><Check size={14} />{item}</li>)}</ul>
                </div>
                <div>
                  <div className="inc-col-title">Not included</div>
                  <ul className="inc-list no">{(exp.exclusions?.length ? exp.exclusions : ['Transport not listed in booking', 'Personal purchases']).map(item => <li key={item}><X size={14} />{item}</li>)}</ul>
                </div>
              </div>
            </section>

            <section className="section-card guide-card">
              <div className="kicker">Meet Your Guide</div>
              <h2>Hosted by {exp.host.name}</h2>
              <div className="guide-profile">
                {exp.host.avatarUrl ? <img src={exp.host.avatarUrl} alt={exp.host.name} /> : <div className="guide-avatar-fallback"><User size={40} strokeWidth={1.8} aria-label="Guide profile" /></div>}
                <div>
                  <div className="guide-profile__name">{exp.host.name}</div>
                  <div className="guide-profile__meta">{exp.host.subtype} · Trust score {Number(exp.host.trustScore || 0).toFixed(1)}</div>
                  <p>{exp.host.bio || 'A local host who blends planning, storytelling, and care to make the day feel effortless.'}</p>
                  <button type="button" className="message-host-btn" onClick={scrollToCustomize}><MessageCircle size={15} /> Message host</button>
                </div>
              </div>
            </section>

            <section className="section-card">
              <div className="kicker">More Details</div>
              <h2>Other details</h2>
              <div className="detail-grid">
                <div><div className="detail-block-label">Tour categories</div><div className="tag-row">{themeBadges.map(tag => <span key={tag} className="tag-pill">{tag}</span>)}</div></div>
                <div><div className="detail-block-label">Languages</div><div className="tag-row">{languageTags.map(tag => <span key={tag} className="tag-pill">{tag}</span>)}</div></div>
                <div><div className="detail-block-label">Activity level</div><div className="tag-row"><span className="tag-pill">{activityLevel}</span></div></div>
                <div><div className="detail-block-label">Accessibility</div><div className="tag-row"><span className="tag-pill">{exp.isAccessible ? 'Accessible' : 'Host can advise'}</span></div></div>
                <div><div className="detail-block-label">Group size</div><div className="tag-row"><span className="tag-pill">1–{exp.maxGuests} travelers</span></div></div>
                <div><div className="detail-block-label">Tour reference</div><div className="tag-row"><span className="tag-pill mono-pill">GV-EXP-{String(exp.id).slice(-4).toUpperCase()}</span></div></div>
              </div>
            </section>

            <section className="section-card">
              <div className="kicker">Getting There</div>
              <h2>Meeting and pickup</h2>
              <div className="meeting-layout">
                <div>
                  <div className="meeting-label">Meeting point</div>
                  <div className="meeting-title">{exp.meetingPoint || exp.location}</div>
                  <p className="meeting-copy">Please arrive 10–15 minutes early. Your host will share the final meetup details and contact guidance after booking.</p>
                </div>
                <div className="meeting-map">
                  {Number.isFinite(exp.latitude) && Number.isFinite(exp.longitude) ? <>
                    <iframe title={`Map showing ${exp.meetingPoint || exp.location}`} src={`https://www.google.com/maps?q=${exp.latitude},${exp.longitude}&z=15&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                    <div className="meeting-map-bubble"><MapPin size={15} /><span>{exp.meetingPoint || exp.location}</span></div>
                    <a className="meeting-map-link" href={`https://www.google.com/maps/search/?api=1&query=${exp.latitude},${exp.longitude}`} target="_blank" rel="noreferrer">Open in Google Maps</a>
                  </> : <a className="meeting-map-fallback" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(exp.meetingPoint || exp.location || '')}`} target="_blank" rel="noreferrer"><MapPin size={22} />Open meeting point in Google Maps</a>}
                </div>
              </div>
              {!!exp.requirements?.length && <div className="requirements-block"><div className="meeting-label">Things to know</div><ul className="inc-list yes">{exp.requirements.map(item => <li key={item}><Check size={14} />{item}</li>)}</ul></div>}
            </section>

            <section className="customize-panel customize-panel--compact" ref={customizeRef}>
              <div className="customize-panel__head">
                <div className="customize-panel__icon"><Sparkles size={16} /></div>
                <div>
                  <h3>Customize this experience</h3>
                  <p className="customize-panel__sub">Tell your guide what matters most before you book.</p>
                </div>
              </div>
              <div className="cp-field">
                <label>Focus</label>
                <div className="cp-chip-row">{themeBadges.map(tag => <button key={tag} type="button" className="cp-chip sel">{tag}</button>)}</div>
              </div>
              <div className="cp-field">
                <label>Group type</label>
                <div className="cp-toggle-row"><button type="button" className={`cp-toggle ${customGroupType === 'private' ? 'sel' : ''}`} onClick={() => setCustomGroupType('private')}>Private — just us</button><button type="button" className={`cp-toggle ${customGroupType === 'group' ? 'sel' : ''}`} onClick={() => setCustomGroupType('group')}>Small group OK</button></div>
              </div>
              <div className="cp-field">
                <label>Anything specific you want to see or skip?</label>
                <textarea className="cp-textarea" value={customInquiry} onChange={event => setCustomInquiry(event.target.value)} placeholder="e.g. We'd love to focus more on photography and skip one shopping stop." />
              </div>
              <button type="button" className="cp-submit" onClick={() => navigate(`/app/traveler/requests?destination=${encodeURIComponent(exp.location || exp.meetingPoint || '')}&experience=${encodeURIComponent(exp.title || '')}&group_type=${customGroupType}&inquiry=${encodeURIComponent(customInquiry)}`)}>Send Custom Request to {exp.host.name.split(' ')[0] || 'Guide'}</button>
              <div className="cp-note">Typical reply time: within a few hours — no obligation to book</div>
            </section>

            <section className="section-card">
              <div className="kicker">What Travelers Say</div>
              <h2>Traveller reviews</h2>
              <div className="review-summary">
                <div className="review-score"><strong>{Number(exp.rating || 0).toFixed(1)}</strong><div className="stars">★★★★★</div><span>{exp.reviewCount || 0} reviews</span></div>
                <div className="review-bars">{[88, 9, 2, 1, 0].map((pct, index) => <div key={index} className="review-bar-row"><span className="label">{5 - index} star{index === 4 ? '' : 's'}</span><div className="review-bar-track"><div className="review-bar-fill" style={{ width: `${pct}%` }} /></div><span className="pct">{pct}%</span></div>)}</div>
              </div>
              {leadReview && <div className="pull-quote">“{leadReview.text}”<span>— {leadReview.author || 'Verified traveler'}</span></div>}
              <div>
                {(exp.reviews?.length ? exp.reviews : [{ author: 'Verified traveler', rating: 5, text: 'A thoughtful and memorable experience with a great host.' }]).slice(0, 3).map((review, index) => <div key={`${review.author}-${index}`} className="review-card"><div className="review-card__head"><span className="review-card__author">{review.author || 'Verified traveler'}</span><span className="review-card__date">Recent review</span></div><div className="review-card__stars">{'★'.repeat(Math.max(1, Number(review.rating || 5)))}{'☆'.repeat(Math.max(0, 5 - Number(review.rating || 5)))}</div><p className="review-card__text">{review.text}</p><span className="verified-booking-tag"><Check size={10} />Verified booking</span></div>)}
              </div>
            </section>

            <section className="section-card">
              <div className="kicker">FAQ</div>
              <h2>Frequently asked questions</h2>
              {faqItems.map((item, index) => <div key={item.q} className={`faq-item ${faqOpen === index ? 'open' : ''}`}><button type="button" className="faq-q" onClick={() => setFaqOpen(value => value === index ? -1 : index)}><span>{item.q}</span><ChevronDown size={17} /></button>{faqOpen === index && <div className="faq-a">{item.a}</div>}</div>)}
              <div className="faq-disclaimer">Need something more specific? Message the host before you book.</div>
            </section>
          </div>

          <aside className="booking-ticket">
            <div className="booking-ticket__main">
              <div className={`instant-ribbon ${exp.isInstantBook ? 'instant-ribbon--instant' : 'instant-ribbon--request'}`}>
                {exp.isInstantBook ? <><Zap size={12} /> Instant confirmation</> : <><Clock3 size={12} /> Request to book — provider responds within 24 hours</>}
              </div>
              <div className="bk-price"><span className="bk-price__from">From</span><span className="bk-price__amount">{formatCurrency(exp.currency, basePrice)}</span><span className="bk-price__unit">/ person</span></div>
              <div className="bk-summary">
                <div className="bk-summary__row"><Clock3 size={16} /> {exp.duration}</div>
                <div className="bk-summary__row"><Users size={16} /> Up to {exp.maxGuests} travelers</div>
                <div className="bk-summary__row"><MapPin size={16} /> {exp.location}</div>
              </div>

              <div className="booking-field">
                <label>Date</label>
                <div className="input-icon-wrap"><CalendarDays size={15} /><input type="date" min={new Date().toISOString().slice(0, 10)} value={preferredDate} onChange={event => setPreferredDate(event.target.value)} /></div>
              </div>

              <div className="booking-field">
                <label>Guests</label>
                <div className="guest-stepper"><button type="button" onClick={() => setGuests(value => Math.max(1, value - 1))} disabled={guests <= 1}><Minus size={16} /></button><span>{guests}</span><button type="button" onClick={() => setGuests(value => Math.min(exp.maxGuests || 10, value + 1))} disabled={guests >= (exp.maxGuests || 10)}><Plus size={16} /></button></div>
              </div>

              {!!exp.priceGroups?.length && <div className="price-group-list">{exp.priceGroups.map(group => <div key={group.id} className={`price-group-row ${selectedPriceGroup?.id === group.id ? 'active' : ''}`}><span>{personLabel(group.persons)} travelers</span><strong>{formatCurrency(exp.currency, group.price)} / person</strong></div>)}</div>}

              <div className="booking-total"><span>Total</span><strong>{formatCurrency(exp.currency, totalPrice)}</strong></div>
              <button
                className={`bk-cta ${!preferredDate ? 'bk-cta--hint' : ''}`}
                type="button"
                disabled={!preferredDate}
                onClick={handleReserve}
              >
                {!preferredDate ? 'Choose a date to continue' : `Reserve now · ${formatCurrency(exp.currency, totalPrice)}`}
              </button>
              <div className="bk-host-note">
                {exp.isInstantBook ? <><Zap size={13} /> Instant confirmation available</> : <><MessageCircle size={13} /> Your host usually responds within 2 hours</>}
              </div>
              <button type="button" className="bk-message-host" onClick={scrollToCustomize}><MessageCircle size={14} /> Message host</button>
              <div className="bk-footnote">Free cancellation subject to host policy. Secure checkout powered by GuideVerse.</div>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  )
}