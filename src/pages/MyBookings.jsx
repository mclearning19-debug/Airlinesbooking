import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cancelBooking, getBookings } from '../services/api';
import useAsync from '../hooks/useAsync';
import AsyncView from '../components/AsyncView';
import BookingCard from '../components/BookingCard';

// Cancel with confirmation; surfaces the server's message (e.g. the 24-hour window) and refreshes the data.
export function useCancel(reload) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function cancel(ref) {
    if (!window.confirm(`Cancel booking ${ref}? Your seats will be released.`)) return;
    setBusy(true);
    setError('');
    try {
      await cancelBooking(ref);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      reload();
    }
  }
  return { cancel, busy, error };
}

export default function MyBookings() {
  const state = useAsync(getBookings);
  const { cancel, busy, error } = useCancel(state.reload);
  return (
    <>
      <h1>My bookings</h1>
      {error && <p className="error-banner" role="alert">{error}</p>}
      <AsyncView state={state}>
        {(bookings) =>
          bookings.length === 0 ? (
            <div className="empty">
              <h3>No bookings yet</h3>
              <Link className="btn btn-primary" to="/">Find a flight</Link>
            </div>
          ) : (
            <div className="stack">
              {bookings.map((b) => (
                <BookingCard key={b.ref} booking={b}>
                  {b.cancellable && <button className="btn" disabled={busy} onClick={() => cancel(b.ref)}>Cancel booking</button>}
                </BookingCard>
              ))}
            </div>
          )
        }
      </AsyncView>
    </>
  );
}
