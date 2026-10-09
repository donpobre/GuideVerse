import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, LoaderCircle, MapPin, MessageCircle, Ticket, UserRound, Users } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import ProviderSidebar from '../../../components/ProviderSidebar/ProviderSidebar'
import { getProviderBooking, getProviderBookings } from '../../../services/providerOperationsService'

const money = (currency, value) => `${currency === 'PHP' ? 'Php' : currency} ${Number(value || 0).toFixed(2)}`

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Date pending'
}

function formatTime(start, end) {
  if (!start || !end) return 'Time pending'
  return `${new Date(start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${new Date(end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

function statusLabel(value) {
  return String(value || 'pending').replaceAll('_', ' ')
}

export default function ProviderBookings() {
  const navigate = useNavigate()
  const { bookingId } = useParams()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    const load = bookingId ? getProviderBooking(bookingId).then(item => { setBookings([item]); return item }) : getProviderBookings().then(items => { setBookings(Array.isArray(items) ? items : []); return items })
    load.catch(caught => setError(caught.message || 'Could not load provider bookings.')).finally(() => setLoading(false))
  }, [bookingId])

  const selected = bookingId ? bookings[0] : null
  const confirmedCount = useMemo(() => bookings.filter(item => item.status === 'confirmed').length, [bookings])

  return (
    <div className="portal-page provider-layout provider-bookings-page">
      <ProviderSidebar />
      <main className="provider-bookings-main">
        <header className="provider-bookings-header">
          <div>
            <p className="settings-eyebrow">Traveler reservations</p>
            <h1>{selected ? 'Booking details' : 'Bookings'}</h1>
            <span>{selected ? 'Review the traveler, schedule, and payment status for this reservation.' : `${confirmedCount} confirmed booking${confirmedCount === 1 ? '' : 's'} in your provider account.`}</span>
          </div>
          {selected && <button className="btn btn-outline" type="button" onClick={() => navigate('/app/provider/bookings')}><ArrowLeft size={16} /> All bookings</button>}
        </header>

        {error && <div className="inline-banner" role="alert">{error}<button type="button" onClick={() => window.location.reload()}>Retry</button></div>}
        {loading ? <div className="provider-profile-state"><LoaderCircle className="spinner" /> Loading bookings…</div> : selected ? <BookingDetail booking={selected} /> : bookings.length ? <div className="provider-bookings-grid">{bookings.map(booking => <BookingCard key={booking.id} booking={booking} onOpen={() => navigate(`/app/provider/bookings/${booking.id}`)} />)}</div> : <div className="provider-bookings-empty"><CalendarDays size={32} /><h2>No bookings yet</h2><p>Confirmed traveler reservations will appear here after payment is completed.</p><button className="btn btn-primary" type="button" onClick={() => navigate('/app/provider/bids')}>View bids</button></div>}
      </main>
    </div>
  )
}

function BookingCard({ booking, onOpen }) {
  const traveler = [booking.traveler_first_name, booking.traveler_last_name].filter(Boolean).join(' ') || 'Traveler'
  return <button className="provider-booking-card" type="button" onClick={onOpen}><div className="provider-booking-card-top"><div><span className="provider-booking-reference">{booking.booking_reference}</span><h2>{booking.title}</h2></div><span className={`provider-booking-status ${booking.status}`}>{statusLabel(booking.status)}</span></div><div className="provider-booking-card-meta"><span><UserRound size={15} />{traveler}</span><span><CalendarDays size={15} />{formatDate(booking.start_time)}</span><span><Users size={15} />{booking.participant_count} guest{Number(booking.participant_count) === 1 ? '' : 's'}</span></div><div className="provider-booking-card-bottom"><strong>{money(booking.currency, booking.net_provider_payout)} provider payout</strong><span>View details →</span></div></button>
}

function BookingDetail({ booking }) {
  const traveler = [booking.traveler_first_name, booking.traveler_last_name].filter(Boolean).join(' ') || 'Traveler'
  return <section className="provider-booking-detail">
    <div className="provider-booking-detail-hero"><div><span className="provider-booking-reference">{booking.booking_reference}</span><h2>{booking.title}</h2><span className={`provider-booking-status ${booking.status}`}>{statusLabel(booking.status)}</span></div><CheckCircle2 size={30} /></div>
    <div className="provider-booking-detail-grid">
      <div className="provider-booking-detail-item"><UserRound size={18} /><div><small>Traveler</small><strong>{traveler}</strong><span>{booking.traveler_email}</span></div></div>
      <div className="provider-booking-detail-item"><CalendarDays size={18} /><div><small>Date</small><strong>{formatDate(booking.start_time)}</strong><span>{formatTime(booking.start_time, booking.end_time)}</span></div></div>
      <div className="provider-booking-detail-item"><Users size={18} /><div><small>Party size</small><strong>{booking.participant_count} traveler{Number(booking.participant_count) === 1 ? '' : 's'}</strong></div></div>
      <div className="provider-booking-detail-item"><MapPin size={18} /><div><small>Meeting point</small><strong>{booking.meeting_address || 'Confirm with traveler'}</strong></div></div>
    </div>
    <div className="provider-booking-financials"><div><span>Traveler paid</span><strong>{money(booking.currency, booking.gross_amount)}</strong></div><div><span>Platform fee</span><strong>-{money(booking.currency, booking.platform_fee)}</strong></div><div><span>Your payout</span><strong>{money(booking.currency, booking.net_provider_payout)}</strong></div><div><span>Payment</span><strong>{statusLabel(booking.payment_status)}</strong></div><div><span>Escrow</span><strong>{statusLabel(booking.escrow_status)}</strong></div></div>
    <div className="provider-booking-detail-actions"><div className="provider-booking-detail-note"><Clock3 size={16} /><span>Use the booking reference when coordinating this traveler’s experience.</span></div><div style={{ display: 'flex', gap: '8px' }}>{booking.status === 'confirmed' && <button className="btn btn-outline" type="button" onClick={() => window.open(`/app/provider/bookings/${booking.id}/ticket`, '_blank')}><Ticket size={16} /> View ticket</button>}<button className="btn btn-primary" type="button" onClick={() => window.location.assign(`/app/provider/messages?booking=${encodeURIComponent(booking.id)}`)}><MessageCircle size={16} /> Message traveler</button></div></div>
  </section>
}