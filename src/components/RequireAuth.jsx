import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../services/auth';

// Wrap a route element to require a signed-in user; others are sent to /sign-in and returned afterwards.
// This is UX only. The server's requireUser() is what actually protects the data.
export default function RequireAuth({ children }) {
  const { data: session, isPending, error, refetch } = useSession();
  const location = useLocation();

  if (isPending) return <p className="muted">Loading…</p>;
  if (error) {
    return (
      <div className="empty">
        <p className="error-banner">Could not check your session. {error.message ?? ''}</p>
        <button className="btn" onClick={() => refetch()}>Try again</button>
      </div>
    );
  }
  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search }} />;
  return children;
}
