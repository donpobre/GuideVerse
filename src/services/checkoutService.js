const headers = () => {
  const user = JSON.parse(localStorage.getItem('tgm_user') || 'null')
  if (!user?.id) throw new Error('Please sign in before checkout.')
  return { Accept: 'application/json', 'Content-Type': 'application/json', 'X-User-Id': user.id }
}
async function request(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { ...headers(), ...options.headers } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Checkout could not be loaded')
  return body
}
export const getCheckoutQuote = (id, date, guests, bookingId) => request(`/api/traveler/checkout/${encodeURIComponent(id)}?date=${encodeURIComponent(date)}&guests=${guests}${bookingId ? `&booking_id=${encodeURIComponent(bookingId)}` : ''}`)
export const startCheckoutPayment = (id, payload) => request(`/api/traveler/checkout/${encodeURIComponent(id)}/pay`, { method: 'POST', body: JSON.stringify(payload) })
export const completePayPalCheckout = (bookingId, orderId) => request(`/api/traveler/bookings/${bookingId}/paypal/complete`, { method: 'POST', body: JSON.stringify({ order_id: orderId }) })
export const completeStripeCheckout = (bookingId, sessionId) => request(`/api/traveler/bookings/${bookingId}/stripe/complete`, { method: 'POST', body: JSON.stringify({ session_id: sessionId }) })
export const getBookingConfirmation = bookingId => request(`/api/traveler/bookings/${encodeURIComponent(bookingId)}/confirmation`)
