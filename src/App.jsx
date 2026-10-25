import { Routes, Route, Link, NavLink, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import Flights from './pages/Flights';
import Book from './pages/Book';
import BookingDetail from './pages/BookingDetail';
import MyBookings from './pages/MyBookings';
import SignIn from './pages/SignIn';
import RequireAuth from './components/RequireAuth';
import { signOut, useSession } from './services/auth';

function UserMenu() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  if (isPending) return null;
  if (!session) return <NavLink to="/sign-in">Sign in</NavLink>;
  return (
    <>
      <span className="muted">{session.user.name}</span>
      <button className="link-button" onClick={() => signOut().then(() => navigate('/'))}>Sign out</button>
    </>
  );
}

export default function App() {
  return (
    <>
      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="logo">✈ Airline Booking Portal</Link>
          <nav className="nav">
            <NavLink to="/" end>Search</NavLink>
            <NavLink to="/bookings">My bookings</NavLink>
            <UserMenu />
          </nav>
        </div>
      </header>
      <main className="container main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/flights" element={<Flights />} />
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/book/:flightId" element={<RequireAuth><Book /></RequireAuth>} />
          <Route path="/bookings" element={<RequireAuth><MyBookings /></RequireAuth>} />
          <Route path="/bookings/:ref" element={<RequireAuth><BookingDetail /></RequireAuth>} />
          <Route path="*" element={<div className="empty"><h2>Page not found</h2><Link to="/">Back home</Link></div>} />
        </Routes>
      </main>
      <footer className="footer">© {new Date().getFullYear()} Airline Booking Portal · Demo app, no real payments</footer>
    </>
  );
}
