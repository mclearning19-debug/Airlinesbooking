// The only place the UI talks to the server's /api routes. Same-origin, so no base URL needed and the
// Better Auth session cookie is sent automatically. (Sign in/up/out live in services/auth.js.)
// Components call these functions and never call fetch directly.

async function request(path, options = {}) {
  const res = await fetch('/api' + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(body?.error ?? `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body;
}

// A 404 on a single record is a normal "not found" state, not an error.
async function orNull(promise) {
  try {
    return await promise;
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

export const getConfig = () => request('/config');
export const getAirports = () => request('/airports');
export const searchFlights = ({ from, to, date, passengers }) => {
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  if (date) q.set('date', date);
  if (passengers) q.set('passengers', passengers);
  return request(`/flights?${q}`);
};
export const getFlight = (id) => orNull(request(`/flights/${encodeURIComponent(id)}`));
export const getSeats = (id) => request(`/flights/${encodeURIComponent(id)}/seats`);
export const createBooking = (body) => request('/bookings', { method: 'POST', body: JSON.stringify(body) });
export const getBookings = () => request('/bookings');
export const getBooking = (ref) => orNull(request(`/bookings/${encodeURIComponent(ref)}`));
export const cancelBooking = (ref) => request(`/bookings/${encodeURIComponent(ref)}/cancel`, { method: 'POST' });
