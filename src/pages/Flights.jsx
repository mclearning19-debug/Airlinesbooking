import { Link, useSearchParams } from 'react-router-dom';
import { searchFlights } from '../services/api';
import useAsync from '../hooks/useAsync';
import AsyncView from '../components/AsyncView';
import FlightSummary from '../components/FlightSummary';
import { formatPrice } from '../utils';

export default function Flights() {
  // Search criteria live in the URL so results survive refresh and can be shared.
  const [params] = useSearchParams();
  const criteria = { from: params.get('from'), to: params.get('to'), date: params.get('date'), passengers: params.get('passengers') || '1' };
  const state = useAsync(() => searchFlights(criteria), [params.toString()]);

  return (
    <>
      <h1>{criteria.from && criteria.to ? `${criteria.from} → ${criteria.to}` : 'Flights'}</h1>
      <p className="muted"><Link to="/">← Change search</Link></p>
      <AsyncView state={state}>
        {(flights) =>
          flights.length === 0 ? (
            <div className="empty">
              <h3>No flights found</h3>
              <p className="muted">Try another date or fewer passengers.</p>
              <Link className="btn" to="/">New search</Link>
            </div>
          ) : (
            <div className="stack">
              {flights.map((f) => (
                <article key={f.id} className="card flight-card">
                  <FlightSummary flight={f} />
                  <div className="flight-price">
                    <div className="muted small">Economy from</div>
                    <div className="price">{formatPrice(f.fares.Economy)}</div>
                    <div className="muted small">{f.seatsLeft <= 10 ? `Only ${f.seatsLeft} seats left` : `${f.seatsLeft} seats left`}</div>
                    <Link className="btn btn-primary" to={`/book/${encodeURIComponent(f.id)}?passengers=${criteria.passengers}`}>Select</Link>
                  </div>
                </article>
              ))}
            </div>
          )
        }
      </AsyncView>
    </>
  );
}
