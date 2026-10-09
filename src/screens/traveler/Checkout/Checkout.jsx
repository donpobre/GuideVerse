import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CheckCircle2, CreditCard, LoaderCircle, Shield } from 'lucide-react'
import TravelerTabs from '../../../components/TravelerTabs/TravelerTabs'
import { completePayPalCheckout, completeStripeCheckout, getCheckoutQuote, startCheckoutPayment } from '../../../services/checkoutService'
import './Checkout.css'

const STEPS = ['Experience', 'Details', 'Payment', 'Confirmation']

export default function Checkout() {
  const { id } = useParams()
  const navigate = useNavigate()
  const params = new URLSearchParams(window.location.search)
  const date = params.get('date') || ''
  const guests = Number(params.get('guests') || 0)
  const approvedBookingId = params.get('booking') || ''
  const [quote, setQuote] = useState(null)
  const [provider, setProvider] = useState('paypal')
  const [state, setState] = useState('reviewing')
  const [error, setError] = useState('')
  const [agreedPolicy, setAgreedPolicy] = useState(false)

  useEffect(() => {
    if (!date || !guests) { setError('Return to the experience and choose a date and group size.'); return }
    getCheckoutQuote(id, date, guests, approvedBookingId).then(nextQuote => {
      setQuote(nextQuote)
      setProvider(nextQuote.providers?.paypal ? 'paypal' : nextQuote.providers?.stripe ? 'stripe' : 'paypal')
    }).catch(e => setError(e.message))
    const bookingId = params.get('booking'); const orderId = params.get('token'); const sessionId = params.get('session_id')
    if (params.get('payment') === 'paypal-return' && bookingId && orderId) {
      setState('processing'); completePayPalCheckout(bookingId, orderId).then(() => navigate(`/app/traveler/bookings/${bookingId}/confirmation`)).catch(e => { setError(e.message); setState('failed') })
    }
    if (params.get('payment') === 'stripe-return' && bookingId && sessionId) {
      setState('processing'); completeStripeCheckout(bookingId, sessionId).then(() => navigate(`/app/traveler/bookings/${bookingId}/confirmation`)).catch(e => { setError(e.message); setState('failed') })
    }
    if (params.get('payment') === 'cancelled') {
      setError('Payment was cancelled — your booking has not been charged.')
    }
  }, [id, date, guests, approvedBookingId])

  const pay = async () => {
    setState('processing'); setError('')
    try { const result = await startCheckoutPayment(id, { date, guests, provider, booking_id: approvedBookingId || undefined }); window.location.assign(result.redirect_url) }
    catch (e) { setError(e.message); setState('failed') }
  }

  const noProvider = quote && !quote.providers[provider]
  const canPay = state !== 'processing' && state !== 'confirmed' && !noProvider && agreedPolicy

  if (!quote) return (
    <main className="portal-page booking-page">
      <div className="container booking-shell">
        <div className="portal-card booking-payment-card">
          {error
            ? <div className="inline-banner"><AlertCircle size={16} /> {error}<button className="btn btn-sm btn-outline" style={{ marginLeft: '12px' }} onClick={() => navigate(`/experience/${id}`)}>Return to experience</button></div>
            : <><LoaderCircle className="spinner" /> Loading checkout…</>}
        </div>
      </div>
      <TravelerTabs />
    </main>
  )

  const money = value => `${quote.currency} ${Number(value).toFixed(2)}`
  const pricePerPerson = quote.guests > 0 ? Number(quote.subtotal) / quote.guests : Number(quote.subtotal)

  return (
    <main className="portal-page booking-page">
      <div className="container booking-shell">

        {/* Step indicator */}
        <div className="checkout-steps">
          {STEPS.map((step, i) => (
            <div key={step} className={`checkout-step ${i === 2 ? 'active' : i < 2 ? 'done' : ''}`}>
              <div className="checkout-step__dot">{i < 2 ? <CheckCircle2 size={14} /> : i + 1}</div>
              <span>{step}</span>
              {i < STEPS.length - 1 && <div className="checkout-step__line" />}
            </div>
          ))}
          <button className="checkout-back-btn" onClick={() => navigate(`/experience/${id}`)}><ArrowLeft size={15} /> Back</button>
        </div>

        <h1 className="checkout-page-title">Booking &amp; Checkout</h1>

        <div className="booking-summary-card">
          <div className="portal-card card order-summary">
            <h3>{quote.experience.title}</h3>
            <p>{new Date(`${quote.date}T00:00:00`).toLocaleDateString()} · {quote.guests} guest{quote.guests === 1 ? '' : 's'}</p>
            <p><strong>Meeting point:</strong> {quote.experience.meeting_address}</p>
            <div className="order-summary-meta"><span>Date</span><strong>{quote.date}</strong></div>
            <div className="order-summary-meta"><span>Start time</span><strong>9:00 AM</strong></div>
            <div className="order-summary-meta"><span>Price per person</span><strong>{money(pricePerPerson)}</strong></div>
          </div>
          <div className="escrow-notice"><Shield size={18} /> Funds held in escrow until 24h after your trip</div>
        </div>

        <aside className="portal-card booking-payment-card">
          <div className="breakdown price">
            <div className="breakdown-row"><span>Total for {quote.guests} guest{quote.guests === 1 ? '' : 's'}</span><span>{money(quote.subtotal)}</span></div>
            <div className="breakdown-row"><span>Service fee ({Number(quote.service_fee_percent).toFixed(2).replace(/\.00$/, '')}%)</span><span>{money(quote.service_fee)}</span></div>
            <div className="breakdown-row breakdown-total"><span>Total due</span><span>{money(quote.total)}</span></div>
          </div>

          <div className="payment-method-group">
            <p className="input-label">Secure payment provider</p>
            <label className={`payment-method-option ${provider === 'stripe' ? 'selected' : ''}`}>
              <input type="radio" name="provider" checked={provider === 'stripe'} onChange={() => setProvider('stripe')} />
              <CreditCard size={18} /><span>Stripe · Card</span>
            </label>
            <label className={`payment-method-option ${provider === 'paypal' ? 'selected' : ''}`}>
              <input type="radio" name="provider" checked={provider === 'paypal'} onChange={() => setProvider('paypal')} />
              <span>PayPal</span>
            </label>
            {import.meta.env.DEV && provider === 'paypal' && (
              <div className="paypal-sandbox-help">
                <a href="https://sandbox.paypal.com" target="_blank" rel="noreferrer">Open PayPal Sandbox</a>
                <span>Test buyer: sb-txzjq52771768@business.example.com</span>
              </div>
            )}
          </div>

          {quote.payment_methods.length > 0 && (
            <div className="settings-empty">
              <strong>Your saved methods</strong>
              {quote.payment_methods.map(method => <p key={method.id}>{method.display_label || method.brand} · {method.provider}</p>)}
              <small>Your provider will offer eligible saved methods on its secure checkout page.</small>
            </div>
          )}

          {noProvider && (
            <div className="inline-banner">
              <AlertCircle size={16} /> Online payment is temporarily unavailable. Please try again later or contact support.
            </div>
          )}

          {/* Cancellation policy acknowledgement */}
          <label className="checkout-policy-check">
            <input type="checkbox" checked={agreedPolicy} onChange={e => setAgreedPolicy(e.target.checked)} />
            <span>I agree to the cancellation policy and understand that refunds are subject to host terms.</span>
          </label>

          {error && <div className="inline-banner"><AlertCircle size={16} /> {error}</div>}
          {state === 'confirmed' && <div className="inline-banner success"><CheckCircle2 size={16} /> Payment received. Your booking is confirmed.</div>}

          <button className="btn btn-primary btn-full btn-lg booking-confirm-btn" onClick={pay} disabled={!canPay}>
            {state === 'processing'
              ? <><LoaderCircle size={16} className="spinner" /> Connecting securely…</>
              : state === 'confirmed'
                ? 'Booking confirmed'
                : `Pay ${money(quote.total)} with ${provider === 'stripe' ? 'Stripe' : 'PayPal'}`}
          </button>

          {state === 'failed' && (
            <div className="checkout-recovery">
              <button className="btn btn-outline btn-full" onClick={() => { setState('reviewing'); setError('') }}>Try payment again</button>
              <button className="btn btn-ghost btn-full" onClick={() => navigate(`/experience/${id}`)}>Return to experience</button>
            </div>
          )}

          {state === 'processing' && (
            <p className="checkout-processing-note">
              <LoaderCircle size={12} className="spinner" /> Checking payment status — please do not close this window.
            </p>
          )}
        </aside>
      </div>
      <TravelerTabs />
    </main>
  )
}
