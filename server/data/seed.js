// Seed data, inserted with ON CONFLICT DO NOTHING on startup. Editing this file does not change rows that
// already exist in the database. Flights are generated for the next RULES.searchDays days on every start,
// so the schedule never runs out.
import { RULES, SEAT_CAPACITY } from '../config.js';

export const airports = [
  { code: 'JFK', city: 'New York', name: 'John F. Kennedy International', country: 'US', timezone: 'America/New_York' },
  { code: 'LAX', city: 'Los Angeles', name: 'Los Angeles International', country: 'US', timezone: 'America/Los_Angeles' },
  { code: 'SFO', city: 'San Francisco', name: 'San Francisco International', country: 'US', timezone: 'America/Los_Angeles' },
  { code: 'ORD', city: 'Chicago', name: "O'Hare International", country: 'US', timezone: 'America/Chicago' },
  { code: 'MIA', city: 'Miami', name: 'Miami International', country: 'US', timezone: 'America/New_York' },
  { code: 'SEA', city: 'Seattle', name: 'Seattle-Tacoma International', country: 'US', timezone: 'America/Los_Angeles' },
  { code: 'LHR', city: 'London', name: 'Heathrow', country: 'GB', timezone: 'Europe/London' },
  { code: 'CDG', city: 'Paris', name: 'Charles de Gaulle', country: 'FR', timezone: 'Europe/Paris' },
  { code: 'DXB', city: 'Dubai', name: 'Dubai International', country: 'AE', timezone: 'Asia/Dubai' },
  { code: 'NRT', city: 'Tokyo', name: 'Narita International', country: 'JP', timezone: 'Asia/Tokyo' },
];

// One daily flight per template. `utc` is the departure time of day in UTC; the UI shows airport-local time.
const templates = [
  { no: 'AB101', from: 'JFK', to: 'LAX', utc: '12:00', mins: 380, price: 289, aircraft: 'Airbus A321' },
  { no: 'AB102', from: 'LAX', to: 'JFK', utc: '16:30', mins: 305, price: 279, aircraft: 'Airbus A321' },
  { no: 'AB111', from: 'JFK', to: 'LAX', utc: '21:15', mins: 385, price: 239, aircraft: 'Boeing 737-800' },
  { no: 'AB201', from: 'JFK', to: 'LHR', utc: '23:00', mins: 420, price: 549, aircraft: 'Boeing 787-9' },
  { no: 'AB202', from: 'LHR', to: 'JFK', utc: '10:45', mins: 480, price: 579, aircraft: 'Boeing 787-9' },
  { no: 'AB210', from: 'LHR', to: 'CDG', utc: '07:30', mins: 80, price: 119, aircraft: 'Airbus A320' },
  { no: 'AB211', from: 'CDG', to: 'LHR', utc: '17:20', mins: 80, price: 125, aircraft: 'Airbus A320' },
  { no: 'AB301', from: 'SFO', to: 'SEA', utc: '15:00', mins: 135, price: 149, aircraft: 'Embraer E175' },
  { no: 'AB302', from: 'SEA', to: 'SFO', utc: '20:10', mins: 135, price: 155, aircraft: 'Embraer E175' },
  { no: 'AB401', from: 'ORD', to: 'MIA', utc: '13:40', mins: 185, price: 199, aircraft: 'Boeing 737-800' },
  { no: 'AB402', from: 'MIA', to: 'ORD', utc: '18:05', mins: 190, price: 205, aircraft: 'Boeing 737-800' },
  { no: 'AB501', from: 'DXB', to: 'LHR', utc: '03:15', mins: 445, price: 689, aircraft: 'Airbus A350-900' },
  { no: 'AB601', from: 'SFO', to: 'NRT', utc: '19:25', mins: 645, price: 899, aircraft: 'Boeing 787-9' },
  { no: 'AB602', from: 'NRT', to: 'SFO', utc: '09:50', mins: 565, price: 879, aircraft: 'Boeing 787-9' },
  { no: 'AB701', from: 'JFK', to: 'MIA', utc: '11:10', mins: 195, price: 169, aircraft: 'Airbus A320' },
];

const pad = (n) => String(n).padStart(2, '0');

// Flights from today (UTC) through the next RULES.searchDays days. Past departures are harmless:
// searches only return future flights.
export function generateFlights(now = new Date()) {
  const flights = [];
  for (let day = 0; day <= RULES.searchDays; day++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + day));
    const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
    for (const t of templates) {
      const [h, m] = t.utc.split(':').map(Number);
      const departs = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m));
      // Weekend fares are a bit higher; deterministic so reruns insert identical rows.
      const weekend = [5, 6, 0].includes(departs.getUTCDay());
      flights.push({
        id: `${t.no}-${stamp}`,
        flight_no: t.no,
        origin: t.from,
        destination: t.to,
        departs_at: departs.toISOString(),
        arrives_at: new Date(departs.getTime() + t.mins * 60_000).toISOString(),
        base_price: Math.round(t.price * (weekend ? 1.15 : 1)),
        aircraft: t.aircraft,
        capacity: SEAT_CAPACITY,
      });
    }
  }
  return flights;
}
