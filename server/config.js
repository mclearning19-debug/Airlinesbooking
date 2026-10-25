// Business rules. Single source of truth: served to the browser by GET /api/config,
// so the UI never duplicates them.
export const RULES = {
  currency: 'USD',
  taxRate: 0.12,
  bookingFee: 9.99, // flat, once per booking
  maxPassengers: 6,
  cancelHoursBefore: 24, // free cancellation until this long before departure
  bookingCutoffHours: 2, // no new bookings this close to departure
  searchDays: 30, // how far ahead flights are generated
  cabins: {
    Business: { fareMultiplier: 2.5, rows: [1, 3], letters: ['A', 'C', 'D', 'F'] },
    Economy: { fareMultiplier: 1, rows: [4, 24], letters: ['A', 'B', 'C', 'D', 'E', 'F'] },
  },
};

// Every aircraft uses this one layout. Returns [{ seat, row, letter, cabin }] in row order.
export function seatMap() {
  const seats = [];
  for (const [cabin, { rows: [from, to], letters }] of Object.entries(RULES.cabins)) {
    for (let row = from; row <= to; row++) {
      for (const letter of letters) seats.push({ seat: `${row}${letter}`, row, letter, cabin });
    }
  }
  return seats;
}

export const SEAT_CAPACITY = seatMap().length;
