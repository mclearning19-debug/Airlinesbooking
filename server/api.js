import crypto from 'node:crypto';
import express, { Router } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './auth.js';
import { pool, transaction } from './db.js';
import { RULES, seatMap } from './config.js';

export const round2 = (n) => Math.round(n * 100) / 100;

// Throw for client errors; the error handler at the bottom turns it into { error }.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// The signed-in user from the Better Auth session cookie, or null.
export async function getUser(req) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  return session?.user ?? null;
}

// Use at the top of every handler that touches per-user data. Scope queries with user.id, never with an id from the body.
export async function requireUser(req) {
  const user = await getUser(req);
  if (!user) throw new HttpError(401, 'Please sign in to continue.');
  return user;
}

const SEATS = new Map(seatMap().map((s) => [s.seat, s]));
const fareFor = (basePrice, cabin) => round2(basePrice * RULES.cabins[cabin].fareMultiplier);

const FLIGHT_SELECT = `
  SELECT f.id, f.flight_no, f.departs_at, f.arrives_at, f.base_price::float8 AS base_price, f.aircraft, f.capacity,
         f.capacity - (SELECT count(*) FROM booking_passengers p WHERE p.flight_id = f.id AND p.active)::int AS seats_left,
         f.origin, o.city AS origin_city, o.name AS origin_name, o.timezone AS origin_tz,
         f.destination, d.city AS destination_city, d.name AS destination_name, d.timezone AS destination_tz
  FROM flights f
  JOIN airports o ON o.code = f.origin
  JOIN airports d ON d.code = f.destination`;

const flightRow = (r) => ({
  id: r.id,
  flightNo: r.flight_no,
  departsAt: r.departs_at,
  arrivesAt: r.arrives_at,
  aircraft: r.aircraft,
  seatsLeft: r.seats_left,
  fares: Object.fromEntries(Object.keys(RULES.cabins).map((c) => [c, fareFor(r.base_price, c)])),
  origin: { code: r.origin, city: r.origin_city, name: r.origin_name, timezone: r.origin_tz },
  destination: { code: r.destination, city: r.destination_city, name: r.destination_name, timezone: r.destination_tz },
});

const api = Router();
// Mounted here (not app-level) so JSON parse errors reach this router's error handler.
api.use(express.json());

api.get('/health', async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});

api.get('/config', (req, res) => res.json(RULES));

api.get('/airports', async (req, res) => {
  const { rows } = await pool.query('SELECT code, city, name, country, timezone FROM airports ORDER BY city');
  res.json(rows);
});

// Search: ?from=JFK&to=LAX&date=2026-11-02&passengers=2. `date` is the local departure date at the origin airport.
api.get('/flights', async (req, res) => {
  const { from, to, date } = req.query;
  const passengers = req.query.passengers === undefined ? 1 : Number(req.query.passengers);
  if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'Invalid date');
  if (!Number.isInteger(passengers) || passengers < 1 || passengers > RULES.maxPassengers) {
    throw new HttpError(400, 'Invalid number of passengers');
  }
  const { rows } = await pool.query(
    `${FLIGHT_SELECT}
     WHERE f.departs_at > now() + make_interval(hours => $1)
       AND ($2::text IS NULL OR f.origin = $2)
       AND ($3::text IS NULL OR f.destination = $3)
       AND ($4::date IS NULL OR (f.departs_at AT TIME ZONE o.timezone)::date = $4::date)
     ORDER BY f.departs_at LIMIT 100`,
    [RULES.bookingCutoffHours, from ? String(from).toUpperCase() : null, to ? String(to).toUpperCase() : null, date ?? null]
  );
  res.json(rows.map(flightRow).filter((f) => f.seatsLeft >= passengers));
});

api.get('/flights/:id', async (req, res) => {
  const { rows } = await pool.query(`${FLIGHT_SELECT} WHERE f.id = $1`, [req.params.id]);
  if (!rows[0]) throw new HttpError(404, 'Flight not found');
  res.json(flightRow(rows[0]));
});

// Seat map with taken seats. The UI greys out taken seats and still handles a 409 from POST /bookings.
api.get('/flights/:id/seats', async (req, res) => {
  const { rows: [flight] } = await pool.query('SELECT base_price::float8 AS base_price FROM flights WHERE id = $1', [req.params.id]);
  if (!flight) throw new HttpError(404, 'Flight not found');
  const { rows } = await pool.query('SELECT seat FROM booking_passengers WHERE flight_id = $1 AND active', [req.params.id]);
  const taken = new Set(rows.map((r) => r.seat));
  res.json(
    [...SEATS.values()].map((s) => ({ ...s, price: fareFor(flight.base_price, s.cabin), taken: taken.has(s.seat) }))
  );
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME = /^[\p{L}][\p{L} '.-]*$/u;

function validateBooking(body) {
  const { flightId, passengers, contact } = body ?? {};
  if (typeof flightId !== 'string' || !flightId) throw new HttpError(400, 'Choose a flight');
  if (!Array.isArray(passengers) || passengers.length < 1) throw new HttpError(400, 'Add at least one passenger');
  if (passengers.length > RULES.maxPassengers) throw new HttpError(400, `At most ${RULES.maxPassengers} passengers per booking`);
  const seen = new Set();
  const clean = passengers.map((p, i) => {
    const firstName = String(p?.firstName ?? '').trim();
    const lastName = String(p?.lastName ?? '').trim();
    const seat = String(p?.seat ?? '');
    const who = `Passenger ${i + 1}`;
    if (!NAME.test(firstName) || firstName.length > 50) throw new HttpError(400, `${who}: enter a valid first name`);
    if (!NAME.test(lastName) || lastName.length > 50) throw new HttpError(400, `${who}: enter a valid last name`);
    if (!SEATS.has(seat)) throw new HttpError(400, `${who}: choose a seat`);
    if (seen.has(seat)) throw new HttpError(400, `Seat ${seat} is selected twice`);
    seen.add(seat);
    return { firstName, lastName, seat };
  });
  const email = String(contact?.email ?? '').trim();
  const phone = String(contact?.phone ?? '').trim();
  if (!EMAIL.test(email) || email.length > 120) throw new HttpError(400, 'Enter a valid email address');
  if (phone.length > 30) throw new HttpError(400, 'Enter a valid phone number');
  return { flightId, passengers: clean, contact: { email, phone } };
}

// 6 characters, no look-alikes (0/O, 1/I).
const newRef = () =>
  Array.from(crypto.randomBytes(6), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');

// The server ignores any client-sent price, total or status: fares come from the flight row and RULES.
// Seats can't be double-booked: passengers_seat_unique is a unique index, so racing requests for the same
// seat can't both commit and the loser gets 409.
api.post('/bookings', async (req, res) => {
  const user = await requireUser(req);
  const { flightId, passengers, contact } = validateBooking(req.body);
  try {
    const ref = await transaction(async (client) => {
      const { rows: [flight] } = await client.query(
        `SELECT base_price::float8 AS base_price, departs_at > now() + make_interval(hours => $2) AS open
         FROM flights WHERE id = $1`,
        [flightId, RULES.bookingCutoffHours]
      );
      if (!flight) throw new HttpError(400, 'Unknown flight');
      if (!flight.open) throw new HttpError(409, 'This flight is no longer open for booking');

      const lines = passengers.map((p) => {
        const cabin = SEATS.get(p.seat).cabin;
        return { ...p, cabin, fare: fareFor(flight.base_price, cabin) };
      });
      const subtotal = round2(lines.reduce((n, l) => n + l.fare, 0));
      const tax = round2(subtotal * RULES.taxRate);
      const fee = RULES.bookingFee;
      const total = round2(subtotal + tax + fee);

      for (let attempt = 0; ; attempt++) {
        const ref = newRef();
        const { rowCount } = await client.query(
          `INSERT INTO bookings (ref, user_id, flight_id, contact, subtotal, tax, fee, total)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (ref) DO NOTHING`,
          [ref, user.id, flightId, contact, subtotal, tax, fee, total]
        );
        if (rowCount) {
          for (const l of lines) {
            await client.query(
              `INSERT INTO booking_passengers (booking_ref, flight_id, first_name, last_name, seat, cabin, fare)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [ref, flightId, l.firstName, l.lastName, l.seat, l.cabin, l.fare]
            );
          }
          return ref;
        }
        if (attempt >= 4) throw new Error('Could not allocate a booking reference');
      }
    });
    res.status(201).json(await loadBooking(ref, user.id));
  } catch (err) {
    if (err.constraint === 'passengers_seat_unique') {
      const seat = /=\(.*?, (\w+)\)/.exec(err.detail ?? '')?.[1];
      throw new HttpError(409, `${seat ? `Seat ${seat} was` : 'A selected seat was'} just taken. Please choose another seat.`);
    }
    throw err;
  }
});

const BOOKING_SELECT = `
  SELECT b.ref, b.status, b.created_at, b.contact, b.subtotal::float8 AS subtotal, b.tax::float8 AS tax,
         b.fee::float8 AS fee, b.total::float8 AS total, b.flight_id
  FROM bookings b`;

async function loadBookings(where, params) {
  const { rows } = await pool.query(`${BOOKING_SELECT} ${where}`, params);
  if (!rows.length) return [];
  const refs = rows.map((r) => r.ref);
  const [{ rows: pax }, { rows: fl }] = await Promise.all([
    pool.query(
      `SELECT booking_ref, first_name, last_name, seat, cabin, fare::float8 AS fare
       FROM booking_passengers WHERE booking_ref = ANY($1) ORDER BY id`,
      [refs]
    ),
    pool.query(`${FLIGHT_SELECT} WHERE f.id = ANY($1)`, [rows.map((r) => r.flight_id)]),
  ]);
  const flights = new Map(fl.map((r) => [r.id, flightRow(r)]));
  return rows.map((r) => ({
    ref: r.ref,
    status: r.status,
    createdAt: r.created_at,
    contact: r.contact,
    subtotal: r.subtotal,
    tax: r.tax,
    fee: r.fee,
    total: r.total,
    // Computed here so the UI doesn't repeat the cancellation rule.
    cancellable:
      r.status === 'Confirmed' &&
      new Date(flights.get(r.flight_id).departsAt) > new Date(Date.now() + RULES.cancelHoursBefore * 3_600_000),
    flight: flights.get(r.flight_id),
    passengers: pax
      .filter((p) => p.booking_ref === r.ref)
      .map((p) => ({ firstName: p.first_name, lastName: p.last_name, seat: p.seat, cabin: p.cabin, fare: p.fare })),
  }));
}

async function loadBooking(ref, userId) {
  const [booking] = await loadBookings('WHERE b.ref = $1 AND b.user_id = $2', [ref, userId]);
  return booking ?? null;
}

api.get('/bookings', async (req, res) => {
  const user = await requireUser(req);
  res.json(await loadBookings('WHERE b.user_id = $1 ORDER BY b.created_at DESC', [user.id]));
});

api.get('/bookings/:ref', async (req, res) => {
  const user = await requireUser(req);
  const booking = await loadBooking(req.params.ref.toUpperCase(), user.id);
  if (!booking) throw new HttpError(404, 'Booking not found');
  res.json(booking);
});

// Cancel: only your own, only before the window closes. Frees the seats.
api.post('/bookings/:ref/cancel', async (req, res) => {
  const user = await requireUser(req);
  const ref = req.params.ref.toUpperCase();
  await transaction(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE bookings b SET status = 'Cancelled'
       FROM flights f
       WHERE f.id = b.flight_id AND b.ref = $1 AND b.user_id = $2 AND b.status = 'Confirmed'
         AND f.departs_at > now() + make_interval(hours => $3)`,
      [ref, user.id, RULES.cancelHoursBefore]
    );
    if (!rowCount) {
      const { rows } = await client.query('SELECT 1 FROM bookings WHERE ref = $1 AND user_id = $2', [ref, user.id]);
      if (!rows[0]) throw new HttpError(404, 'Booking not found');
      throw new HttpError(409, `This booking can no longer be cancelled (free cancellation ends ${RULES.cancelHoursBefore} hours before departure).`);
    }
    await client.query('UPDATE booking_passengers SET active = false WHERE booking_ref = $1', [ref]);
  });
  res.json(await loadBooking(ref, user.id));
});

api.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Express 5 forwards rejected promises from async handlers here.
api.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

export default api;
