import { formatDate, formatDuration, formatTime } from '../utils';

// Route, local times and duration for one flight. Used on results, booking and confirmation screens.
export default function FlightSummary({ flight }) {
  const { origin, destination } = flight;
  return (
    <div className="flight-summary">
      <div className="endpoint">
        <div className="time">{formatTime(flight.departsAt, origin.timezone)}</div>
        <div><strong>{origin.code}</strong> {origin.city}</div>
        <div className="muted small">{formatDate(flight.departsAt, origin.timezone)}</div>
      </div>
      <div className="leg muted small">
        <div>{formatDuration(flight.departsAt, flight.arrivesAt)}</div>
        <div className="line" />
        <div>{flight.flightNo} · {flight.aircraft}</div>
      </div>
      <div className="endpoint">
        <div className="time">{formatTime(flight.arrivesAt, destination.timezone)}</div>
        <div><strong>{destination.code}</strong> {destination.city}</div>
        <div className="muted small">{formatDate(flight.arrivesAt, destination.timezone)}</div>
      </div>
    </div>
  );
}
