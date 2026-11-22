import { expect, dateInDays } from './fixtures.js';

// A <select>/<input> inside a label.field whose text starts with the label (selects' labels also contain their options).
export const field = (page, label) => page.locator('label.field', { hasText: new RegExp('^' + label) }).locator('select, input');

// Search JFK -> LAX a week out through the home page form and land on the results.
export async function searchFlights(page, { passengers = 1 } = {}) {
  await page.goto('/');
  await field(page, 'From').selectOption('JFK');
  await field(page, 'To').selectOption('LAX');
  await page.getByLabel('Date').fill(dateInDays(7));
  await page.getByLabel('Passengers').selectOption(String(passengers));
  await page.getByRole('button', { name: 'Search flights' }).click();
  await expect(page).toHaveURL(/\/flights\?/);
  await expect(page.locator('article.flight-card').first()).toBeVisible();
}

export const selectLink = (page) => page.locator('article.flight-card').first().getByRole('link', { name: 'Select' });

// Pick the first flight in the results and wait for the seat map.
export async function selectFirstFlight(page) {
  await selectLink(page).click();
  await expect(page.getByRole('group', { name: 'Seat map' })).toBeVisible();
}

// Free economy seats (the aria-label of a taken seat ends with ", taken").
export const freeSeats = (page) => page.getByRole('button', { name: /^Seat \w+, Economy, [^,]+$/ });

export const seatNumber = async (seatButton) => (await seatButton.getAttribute('aria-label')).match(/^Seat (\w+),/)[1];

// Fill passenger 1, choose the first free seat, confirm. Returns the seat number.
export async function bookFirstFreeSeat(page, first = 'Ada', last = 'Lovelace') {
  await page.getByLabel('First name').fill(first);
  await page.getByLabel('Last name').fill(last);
  const seat = freeSeats(page).first();
  const number = await seatNumber(seat);
  await seat.click();
  await page.getByRole('button', { name: 'Confirm booking' }).click();
  await expect(page.getByRole('heading', { name: /You're booked/ })).toBeVisible();
  return number;
}
