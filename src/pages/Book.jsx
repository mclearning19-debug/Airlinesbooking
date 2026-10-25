import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createBooking, getConfig, getFlight, getSeats } from '../services/api';
import useAsync from '../hooks/useAsync';
import AsyncView from '../components/AsyncView';
import FlightSummary from '../components/FlightSummary';
import SeatMap from '../components/SeatMap';
import { useSession } from '../services/auth';
import { formatPrice } from '../utils';

export default function Book() {
  const { flightId } = useParams();
  const state = useAsync(() => Promise.all([getFlight(flightId), getSeats(flightId), getConfig()]), [flightId]);
  return (
    <AsyncView state={state}>
      {([flight, seats, config]) =>
        flight ? (
          <BookingForm flight={flight} seats={seats} config={config} reloadSeats={state.reload} />
        ) : (
          <div className="empty">
            <h2>Flight not found</h2>
            <Link to="/">Back to search</Link>
          </div>
        )
      }
    </AsyncView>
  );
}

const blankPassenger = () => ({ firstName: '', lastName: '', seat: '' });

function BookingForm({ flight, seats, config, reloadSeats }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const count = Math.min(Math.max(parseInt(params.get('passengers'), 10) || 1, 1), config.maxPassengers);
  const [passengers, setPassengers] = useState(() => Array.from({ length: count }, blankPassenger));
  const { data: session } = useSession();
  const [contact, setContact] = useState({ email: session?.user.email ?? '', phone: '' });
  const [active, setActive] = useState(0);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Seat data can go stale while the user fills in the form: drop picks that have since been taken.
  useEffect(() => {
    const taken = new Set(seats.filter((s) => s.taken).map((s) => s.seat));
    setPassengers((ps) => (ps.some((p) => taken.has(p.seat)) ? ps.map((p) => (taken.has(p.seat) ? { ...p, seat: '' } : p)) : ps));
  }, [seats]);

  const price = new Map(seats.map((s) => [s.seat, s.price]));
  const mine = new Map(passengers.flatMap((p, i) => (p.seat ? [[p.seat, i]] : [])));
  const subtotal = passengers.reduce((n, p) => n + (price.get(p.seat) ?? 0), 0);
  const tax = Math.round(subtotal * config.taxRate * 100) / 100;
  const total = subtotal + tax + config.bookingFee;

  const updatePassenger = (i, patch) => setPassengers((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const toggleSeat = (seat) => {
    const owner = mine.get(seat);
    if (owner !== undefined) {
      updatePassenger(owner, { seat: '' });
      setActive(owner);
      return;
    }
    updatePassenger(active, { seat });
    const next = passengers.findIndex((p, i) => i !== active && !p.seat);
    if (next !== -1) setActive(next);
  };

  function validate() {
    const e = {};
    passengers.forEach((p, i) => {
      if (!p.firstName.trim()) e[`first${i}`] = 'Required';
      if (!p.lastName.trim()) e[`last${i}`] = 'Required';
      if (!p.seat) e[`seat${i}`] = 'Choose a seat';
    });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) e.email = 'Enter a valid email address';
    return e;
  }

  async function submit(ev) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const booking = await createBooking({ flightId: flight.id, passengers, contact });
      navigate(`/bookings/${booking.ref}`, { state: { justBooked: true } });
    } catch (err) {
      setSubmitError(err.message);
      if (err.status === 409) reloadSeats(); // refresh the seat map so the taken seat is greyed out
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1>Choose seats and traveller details</h1>
      <div className="card pad"><FlightSummary flight={flight} /></div>
      <form className="two-col book-layout" onSubmit={submit} noValidate>
        <div className="stack">
          <section className="card pad">
            <h2>Passengers</h2>
            {passengers.map((p, i) => (
              <fieldset key={i} className={`passenger ${active === i ? 'active' : ''}`} onClick={() => setActive(i)}>
                <legend>Passenger {i + 1}</legend>
                <div className="row">
                  <label className="field">First name
                    <input className={`input ${errors[`first${i}`] ? 'invalid' : ''}`} value={p.firstName} maxLength={50}
                      onChange={(e) => updatePassenger(i, { firstName: e.target.value })} />
                    {errors[`first${i}`] && <span className="error">{errors[`first${i}`]}</span>}
                  </label>
                  <label className="field">Last name
                    <input className={`input ${errors[`last${i}`] ? 'invalid' : ''}`} value={p.lastName} maxLength={50}
                      onChange={(e) => updatePassenger(i, { lastName: e.target.value })} />
                    {errors[`last${i}`] && <span className="error">{errors[`last${i}`]}</span>}
                  </label>
                </div>
                <p className="small">
                  Seat: <strong>{p.seat || '—'}</strong>
                  {p.seat && <span className="muted"> ({formatPrice(price.get(p.seat))})</span>}
                  {errors[`seat${i}`] && <span className="error"> {errors[`seat${i}`]}</span>}
                </p>
              </fieldset>
            ))}
          </section>
          <section className="card pad">
            <h2>Contact</h2>
            <div className="row">
              <label className="field">Email
                <input className={`input ${errors.email ? 'invalid' : ''}`} type="email" value={contact.email}
                  onChange={(e) => setContact({ ...contact, email: e.target.value })} />
                {errors.email && <span className="error">{errors.email}</span>}
              </label>
              <label className="field">Phone (optional)
                <input className="input" type="tel" value={contact.phone} maxLength={30}
                  onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
              </label>
            </div>
          </section>
          <section className="card pad">
            <h2>Seats</h2>
            <p className="muted small">Selecting a seat for <strong>Passenger {active + 1}</strong>. Click a seat to assign it, click it again to release it.</p>
            <SeatMap seats={seats} mine={mine} onToggle={toggleSeat} />
          </section>
        </div>

        <aside className="card pad summary">
          <h2>Price</h2>
          <dl className="totals">
            <dt>Fares ({passengers.length})</dt><dd>{formatPrice(subtotal)}</dd>
            <dt>Taxes ({Math.round(config.taxRate * 100)}%)</dt><dd>{formatPrice(tax)}</dd>
            <dt>Booking fee</dt><dd>{formatPrice(config.bookingFee)}</dd>
            <dt className="grand">Total</dt><dd className="grand">{formatPrice(total)}</dd>
          </dl>
          {submitError && <p className="error-banner" role="alert">{submitError}</p>}
          <button className="btn btn-primary btn-block" disabled={submitting}>{submitting ? 'Booking…' : 'Confirm booking'}</button>
          <p className="muted small">The final price is calculated by the server when you confirm. Free cancellation until {config.cancelHoursBefore} hours before departure.</p>
        </aside>
      </form>
    </>
  );
}
