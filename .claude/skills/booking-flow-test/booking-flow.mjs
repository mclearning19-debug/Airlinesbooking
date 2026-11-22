// Full booking-flow check against a live deployment.
// Run from the repo root: node --env-file=.env .claude/skills/booking-flow-test/booking-flow.mjs <baseUrl>
// Creates two throwaway users and test bookings, then deletes them in `finally`.
import { createRequire } from 'node:module';
const require = createRequire(process.cwd() + '/');
const { Pool, neonConfig } = require('@neondatabase/serverless');
neonConfig.webSocketConstructor = WebSocket;

const U = process.argv[2].replace(/\/$/, '');
const stamp = Date.now();
const emails = [`flowtest+a${stamp}@example.com`, `flowtest+b${stamp}@example.com`];
const results = [];
const refs = [];

const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
};

class Client {
  jar = '';
  async req(method, path, body, headers = {}) {
    const res = await fetch(U + path, {
      method,
      headers: { Origin: U, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(this.jar ? { Cookie: this.jar } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.getSetCookie?.() ?? [];
    if (set.length) this.jar = set.map((c) => c.split(';')[0]).join('; ');
    let data = null;
    try { data = await res.json(); } catch {}
    return { status: res.status, data };
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const anon = new Client();
  const a = new Client();
  const b = new Client();

  // 1. Public browsing
  let r = await anon.req('GET', '/api/health');
  check('health', r.status === 200 && r.data.ok === true);
  const cfg = (await anon.req('GET', '/api/config')).data;
  check('config', !!cfg.cabins && typeof cfg.cancelHoursBefore === 'number', `cancelHoursBefore=${cfg.cancelHoursBefore}`);
  r = await anon.req('GET', '/api/airports');
  check('airports', r.status === 200 && r.data.length > 1, `${r.data.length} airports`);

  // Pick a flight comfortably outside the cancellation window (>= 4 days out) so cancel is allowed.
  r = await anon.req('GET', '/api/flights?passengers=3');
  const minDeparture = Date.now() + (cfg.cancelHoursBefore + 72) * 3_600_000;
  const flight = r.data.find((f) => new Date(f.departsAt).getTime() > minDeparture);
  check('flight search', r.status === 200 && !!flight, flight ? `${flight.id} ${flight.origin.code}->${flight.destination.code} ${flight.departsAt}` : 'no suitable flight');
  if (!flight) throw new Error('no flight to test with');
  r = await anon.req('GET', `/api/flights?from=${flight.origin.code}&to=${flight.destination.code}&passengers=1`);
  check('search by route', r.status === 200 && r.data.some((f) => f.id === flight.id));
  r = await anon.req('GET', `/api/flights/${flight.id}`);
  check('flight detail', r.status === 200 && r.data.id === flight.id);

  const seatMap = async () => (await anon.req('GET', `/api/flights/${flight.id}/seats`)).data;
  let seats = await seatMap();
  const free = seats.filter((s) => !s.taken);
  check('seat map', Array.isArray(seats) && free.length >= 6, `${seats.length} seats, ${free.length} free`);
  const [s1, s2, s3, s4] = free.map((s) => s.seat);

  // 2. Auth required
  const body = (pax) => ({ flightId: flight.id, passengers: pax, contact: { email: emails[0], phone: '5551234567' } });
  const pax = (...ss) => ss.map((seat, i) => ({ firstName: 'Test', lastName: ["One", "Two", "Three"][i], seat }));
  r = await anon.req('POST', '/api/bookings', body(pax(s1)));
  check('booking requires sign-in (401)', r.status === 401);
  r = await anon.req('GET', '/api/bookings');
  check('list requires sign-in (401)', r.status === 401);

  // 3. Sign up two users
  for (const [client, email, n] of [[a, emails[0], 'A'], [b, emails[1], 'B']]) {
    r = await client.req('POST', '/api/auth/sign-up/email', { name: `Flow Test ${n}`, email, password: 'FlowTest12345!' });
    check(`sign-up user ${n}`, r.status === 200 && !!r.data?.user?.id);
  }

  // 4. Validation
  r = await a.req('POST', '/api/bookings', { ...body(pax(s1)), contact: { email: 'not-an-email', phone: '' } });
  check('bad email rejected (400)', r.status === 400, r.data?.error);
  r = await a.req('POST', '/api/bookings', body([{ firstName: 'A', lastName: 'B', seat: s1 }, { firstName: 'C', lastName: 'D', seat: s1 }]));
  check('same seat twice rejected (400)', r.status === 400, r.data?.error);
  r = await a.req('POST', '/api/bookings', body([{ firstName: 'A', lastName: 'B', seat: '99Z' }]));
  check('invalid seat rejected (400)', r.status === 400, r.data?.error);
  r = await a.req('POST', '/api/bookings', { ...body(pax(s1)), flightId: 'does-not-exist' });
  check('unknown flight rejected (400)', r.status === 400, r.data?.error);

  // 5. Book two passengers, with client-sent prices/status that must be ignored
  r = await a.req('POST', '/api/bookings', { ...body(pax(s1, s2)), total: 1, subtotal: 1, status: 'Cancelled', passengers: pax(s1, s2).map((p) => ({ ...p, fare: 1 })) });
  const booking = r.data;
  if (booking?.ref) refs.push(booking.ref);
  check('book 2 passengers (201)', r.status === 201 && booking?.status === 'Confirmed', `ref ${booking?.ref}`);
  const fares = booking.passengers.map((p) => p.fare);
  const subtotal = Math.round(fares.reduce((n, x) => n + x, 0) * 100) / 100;
  const expectTotal = Math.round((subtotal + Math.round(subtotal * cfg.taxRate * 100) / 100 + cfg.bookingFee) * 100) / 100;
  check('client price/status ignored, total recomputed', booking.total === expectTotal && booking.total > 1 && fares.every((f) => f > 1), `total ${booking.total}, expected ${expectTotal}`);

  seats = await seatMap();
  check('booked seats now taken', [s1, s2].every((s) => seats.find((x) => x.seat === s).taken));

  // 6. Taken seat -> 409
  r = await b.req('POST', '/api/bookings', body(pax(s1)));
  check('taken seat rejected (409)', r.status === 409, r.data?.error);

  // 7. Seat race: 4 concurrent identical requests for one free seat
  const race = await Promise.all([1, 2, 3, 4].map(() => a.req('POST', '/api/bookings', body(pax(s3)))));
  race.filter((x) => x.status === 201).forEach((x) => refs.push(x.data.ref));
  const codes = race.map((x) => x.status).sort();
  check('seat race -> [201,409,409,409]', JSON.stringify(codes) === '[201,409,409,409]', JSON.stringify(codes));

  // 8. Read back + ownership
  r = await a.req('GET', '/api/bookings');
  check('list own bookings', r.status === 200 && r.data.length === 2 && r.data.some((x) => x.ref === booking.ref), `${r.data.length} bookings`);
  r = await a.req('GET', `/api/bookings/${booking.ref}`);
  check('booking detail', r.status === 200 && r.data.passengers.length === 2 && r.data.cancellable === true);
  r = await b.req('GET', `/api/bookings/${booking.ref}`);
  check("other user can't read it (404)", r.status === 404);
  r = await b.req('GET', '/api/bookings');
  check("other user's list is empty", r.status === 200 && r.data.length === 0);
  r = await b.req('POST', `/api/bookings/${booking.ref}/cancel`);
  check("other user can't cancel it (404)", r.status === 404);

  // 9. Cancel frees the seats
  r = await a.req('POST', `/api/bookings/${booking.ref}/cancel`);
  check('cancel own booking', r.status === 200 && r.data.status === 'Cancelled');
  seats = await seatMap();
  check('cancelled seats freed', [s1, s2].every((s) => !seats.find((x) => x.seat === s).taken));
  r = await a.req('POST', `/api/bookings/${booking.ref}/cancel`);
  check('cancel twice rejected (409)', r.status === 409, r.data?.error);
  r = await b.req('POST', '/api/bookings', body(pax(s1)));
  if (r.status === 201) refs.push(r.data.ref);
  check('freed seat can be rebooked', r.status === 201);

  // 10. Sign out
  r = await a.req('POST', '/api/auth/sign-out', {});
  r = await a.req('GET', '/api/bookings');
  check('signed out -> 401', r.status === 401 || r.status === 200 && false, `status ${r.status}`);
} catch (e) {
  results.push(false);
  console.log('ERROR', e.message);
} finally {
  // Cleanup: passengers -> bookings -> users (sessions/accounts cascade).
  try {
    const { rows } = await pool.query(`SELECT b.ref FROM bookings b JOIN "user" u ON u.id = b.user_id WHERE u.email = ANY($1)`, [emails]);
    const all = [...new Set([...refs, ...rows.map((x) => x.ref)])];
    const p = await pool.query('DELETE FROM booking_passengers WHERE booking_ref = ANY($1)', [all]);
    const bk = await pool.query('DELETE FROM bookings WHERE ref = ANY($1)', [all]);
    const us = await pool.query(`DELETE FROM "user" WHERE email = ANY($1)`, [emails]);
    console.log(`cleanup: passengers ${p.rowCount}, bookings ${bk.rowCount}, users ${us.rowCount}`);
  } catch (e) {
    console.log('CLEANUP FAILED', e.message, 'emails:', emails.join(', '));
  }
  await pool.end();
  console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
  process.exitCode = results.every(Boolean) ? 0 : 1;
}
