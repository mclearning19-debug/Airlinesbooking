import { formatPrice } from '../utils';
import FlightSummary from './FlightSummary';

// Booking details: reference, flight, passengers and the price breakdown. `children` renders actions.
export default function BookingCard({ booking, children }) {
  return (
    <article className="card pad booking-card">
      <div className="booking-head">
        <div>
          <div className="muted small">Confirmation code</div>
          <div className="ref">{booking.ref}</div>
        </div>
        <span className={`status ${booking.status === 'Cancelled' ? 'cancelled' : ''}`}>{booking.status}</span>
      </div>
      <FlightSummary flight={booking.flight} />
      <table className="table">
        <thead><tr><th>Passenger</th><th>Seat</th><th>Cabin</th><th className="num">Fare</th></tr></thead>
        <tbody>
          {booking.passengers.map((p) => (
            <tr key={p.seat}>
              <td>{p.firstName} {p.lastName}</td><td>{p.seat}</td><td>{p.cabin}</td><td className="num">{formatPrice(p.fare)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="totals">
        <dt>Taxes</dt><dd>{formatPrice(booking.tax)}</dd>
        <dt>Booking fee</dt><dd>{formatPrice(booking.fee)}</dd>
        <dt className="grand">Total</dt><dd className="grand">{formatPrice(booking.total)}</dd>
      </dl>
      <p className="muted small">Confirmation sent to {booking.contact.email} (email delivery is not implemented in this demo).</p>
      {children}
    </article>
  );
}
