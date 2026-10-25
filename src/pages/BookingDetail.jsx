import { Link, useLocation, useParams } from 'react-router-dom';
import { getBooking } from '../services/api';
import useAsync from '../hooks/useAsync';
import AsyncView from '../components/AsyncView';
import BookingCard from '../components/BookingCard';
import { useCancel } from './MyBookings';

export default function BookingDetail() {
  const { ref } = useParams();
  const { state: nav } = useLocation();
  const state = useAsync(() => getBooking(ref), [ref]);
  return (
    <AsyncView state={state}>
      {(booking) =>
        booking ? (
          <Detail booking={booking} justBooked={!!nav?.justBooked} reload={state.reload} />
        ) : (
          <div className="empty">
            <h2>Booking not found</h2>
            <p className="muted">Bookings are only visible to the account that made them.</p>
            <Link to="/">Back to search</Link>
          </div>
        )
      }
    </AsyncView>
  );
}

function Detail({ booking, justBooked, reload }) {
  const { cancel, busy, error } = useCancel(reload);
  return (
    <>
      {justBooked && <h1>You're booked! 🎉</h1>}
      <BookingCard booking={booking}>
        {error && <p className="error-banner" role="alert">{error}</p>}
        {booking.cancellable && (
          <button className="btn" disabled={busy} onClick={() => cancel(booking.ref)}>{busy ? 'Cancelling…' : 'Cancel booking'}</button>
        )}
      </BookingCard>
      <p><Link to="/bookings">All my bookings</Link></p>
    </>
  );
}
