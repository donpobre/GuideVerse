import BookingConfirmation from '../BookingConfirmation/BookingConfirmation'

// A trip detail is the booking confirmation for that booking. Reusing the
// confirmation screen keeps both routes backed by the same live booking data.
export default function TripDetail() {
  return <BookingConfirmation />
}