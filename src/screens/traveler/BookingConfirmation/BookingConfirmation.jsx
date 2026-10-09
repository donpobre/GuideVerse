import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Check, Clock3, Globe, MapPin, Printer, ShieldCheck, Users } from 'lucide-react'
import { getBookingConfirmation } from '../../../services/checkoutService'
import TravelerTabs from '../../../components/TravelerTabs/TravelerTabs'
import './BookingConfirmation.css'

const money = (currency, value) => `${currency === 'PHP' ? 'Php' : currency} ${Number(value || 0).toFixed(2)}`

export default function BookingConfirmation() {
  const { bookingId, id } = useParams()
  const resolvedBookingId = bookingId || id
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!resolvedBookingId) {
      setError('Booking ID is missing from this URL.')
      return undefined
    }
    getBookingConfirmation(resolvedBookingId).then(setData).catch(caught => setError(caught.message))
  }, [resolvedBookingId])

  if (error) return <main className="portal-page confirmation-page"><div className="confirmation-shell"><div className="confirmation-card"><h1>Confirmation unavailable</h1><p>{error}</p><button className="btn btn-primary" onClick={() => navigate('/app/traveler/trips')}>View my trips</button></div></div></main>
  if (!data) return <main className="portal-page confirmation-page"><div className="confirmation-shell"><div className="confirmation-card"><p>Loading your booking confirmation…</p></div></div></main>

  const { booking, experience, payment } = data
  const start = new Date(booking.start_time)
  const end = new Date(booking.end_time)
  const dateLabel = start.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const timeLabel = `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`

  return (
    <main className="portal-page confirmation-page">
      <div className="confirmation-shell">
        <div className="confirmation-actions no-print">
          <Link to="/app/traveler/trips" className="confirmation-back"><ArrowLeft size={16} /> My trips</Link>
          <button type="button" className="btn btn-outline" onClick={() => window.print()}><Printer size={16} /> Print confirmation</button>
        </div>

        <div className="confirmation-print-brand" aria-hidden="true">
          <span className="confirmation-print-brand-icon"><Globe size={20} /></span>
          <span>GuideVerse</span>
        </div>

        <article className="confirmation-card">
          <header className="confirmation-header">
            <div className="confirmation-success"><span><Check size={20} /></span><div><p className="eyebrow">Booking confirmed</p><h1>Your experience is reserved</h1><p>Keep this confirmation for your trip.</p></div></div>
            <div className="confirmation-reference"><span>Booking reference</span><strong>{booking.booking_reference}</strong></div>
          </header>

          <section className="confirmation-hero">
            {experience.images?.[0] ? <img src={experience.images[0]} alt={experience.title} /> : <div className="confirmation-image-fallback">GuideVerse</div>}
            <div><p className="eyebrow">Experience</p><h2>{experience.title}</h2><p>{experience.category} · {experience.location || experience.meeting_address}</p></div>
          </section>

          <section className="confirmation-grid">
            <div className="confirmation-info-block"><CalendarDays size={18} /><div><span>Date</span><strong>{dateLabel}</strong></div></div>
            <div className="confirmation-info-block"><Clock3 size={18} /><div><span>Time</span><strong>{timeLabel}</strong></div></div>
            <div className="confirmation-info-block"><Users size={18} /><div><span>Guests</span><strong>{booking.participant_count} traveler{booking.participant_count === 1 ? '' : 's'}</strong></div></div>
            <div className="confirmation-info-block"><MapPin size={18} /><div><span>Meeting point</span><strong>{experience.meeting_address}</strong></div></div>
          </section>

          <section className="confirmation-section"><div className="section-heading"><p className="eyebrow">Your guide</p><h2>{experience.provider.name}</h2></div><p>{experience.provider.bio || 'Your local host will share final meeting instructions before the experience.'}</p></section>

          <section className="confirmation-section"><div className="section-heading"><p className="eyebrow">Itinerary</p><h2>Where you’ll go</h2></div>{experience.itinerary?.length ? <div className="confirmation-timeline">{experience.itinerary.map((stop, index) => <div key={stop.id || index} className="confirmation-stop"><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{stop.title}</strong>{stop.description && <p>{stop.description}</p>}{stop.duration_minutes && <small>{stop.duration_minutes} minutes</small>}</div></div>)}</div> : <p>Your guide will confirm the detailed route before the experience.</p>}</section>

          <section className="confirmation-section confirmation-two-column">
            <div><div className="section-heading"><p className="eyebrow">Included</p><h2>What’s included</h2></div><ul className="confirmation-list">{(experience.inclusions || []).length ? experience.inclusions.map(item => <li key={item}><Check size={14} />{item}</li>) : <li><Check size={14} />Details confirmed by your guide</li>}</ul></div>
            <div><div className="section-heading"><p className="eyebrow">Other details</p><h2>Good to know</h2></div><dl className="confirmation-details"><div><dt>Activity level</dt><dd>{experience.activity_level || 'Moderate'}</dd></div><div><dt>Group type</dt><dd>{experience.group_type || 'Both'}</dd></div><div><dt>Accessibility</dt><dd>{experience.is_accessible ? 'Accessible experience' : 'Ask your guide'}</dd></div><div><dt>Languages</dt><dd>{(experience.languages || ['English']).join(', ')}</dd></div></dl></div>
          </section>

          <section className="confirmation-section confirmation-payment"><div><div className="section-heading"><p className="eyebrow">Payment</p><h2>Booking total</h2></div><p><ShieldCheck size={15} /> Payment status: <strong>{payment.status === 'paid' ? 'Paid' : booking.status}</strong> via {payment.provider || 'GuideVerse'}</p></div><div className="confirmation-total"><span>Total paid</span><strong>{money(booking.currency, booking.gross_amount)}</strong></div></section>

          <footer className="confirmation-footer"><p>Arrive 10–15 minutes early and keep this confirmation available.</p><p>GuideVerse · Secure booking confirmation</p></footer>
        </article>
      </div>
      <TravelerTabs />
    </main>
  )
}