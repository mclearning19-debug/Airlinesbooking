import { test, expect, newUser, signUp, fillSignUp } from './fixtures.js';
import { field, searchFlights, selectFirstFlight, selectLink, freeSeats, seatNumber, bookFirstFreeSeat } from './helpers.js';

test.describe('public browsing', () => {
  test('search leads to flight results', async ({ page }) => {
    await searchFlights(page);
    await expect(page.getByRole('heading', { name: 'JFK → LAX' })).toBeVisible();
    await expect(page.locator('article.flight-card').first()).toContainText('JFK');
  });

  test('same origin and destination blocks the search', async ({ page }) => {
    await page.goto('/');
    await field(page, 'To').selectOption('JFK');
    await expect(page.getByText('Choose different departure and arrival airports.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Search flights' })).toBeDisabled();
  });

  test('SPA deep link loads', async ({ page }) => {
    const res = await page.goto('/flights?from=JFK&to=LAX&passengers=1');
    expect(res.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'JFK → LAX' })).toBeVisible();
  });
});

test.describe('auth', () => {
  test('protected pages redirect to sign-in', async ({ page }) => {
    await page.goto('/bookings');
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('selecting a flight while signed out goes to sign-in and back to the booking page', async ({ page, user }) => {
    await searchFlights(page);
    await selectLink(page).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await fillSignUp(page, user);
    await expect(page).toHaveURL(/\/book\//);
    await expect(page.getByRole('heading', { name: 'Choose seats and traveller details' })).toBeVisible();
  });

  test('sign-up validation, then sign out and back in', async ({ page, user }) => {
    await page.goto('/sign-in');
    await page.getByRole('button', { name: 'Create an account' }).click();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Enter your name')).toBeVisible();
    await expect(page.getByText('Enter a valid email address')).toBeVisible();

    await signUp(page, user);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();

    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill(user.password);
    await page.locator('form').getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  test('wrong password shows an error', async ({ page, user }) => {
    await signUp(page, user);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill('not-the-password');
    await page.locator('form').getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });
});

test.describe('booking', () => {
  test('book, see the confirmation, then cancel', async ({ authedPage: page }) => {
    await searchFlights(page);
    await selectFirstFlight(page);
    const seat = await bookFirstFreeSeat(page);

    await expect(page.locator('.ref')).toHaveText(/\S+/);
    await expect(page.getByRole('cell', { name: seat, exact: true })).toBeVisible();
    await expect(page.locator('.status')).toHaveText('Confirmed');

    page.once('dialog', (d) => d.accept()); // window.confirm
    await page.getByRole('button', { name: 'Cancel booking' }).click();
    await expect(page.locator('.status')).toHaveText('Cancelled');
    await expect(page.getByRole('button', { name: 'Cancel booking' })).toHaveCount(0);

    await page.getByRole('link', { name: 'All my bookings' }).click();
    await expect(page.locator('.booking-card')).toHaveCount(1);
  });

  test('form validation: missing names and seat', async ({ authedPage: page }) => {
    await searchFlights(page);
    await selectFirstFlight(page);
    await page.getByRole('button', { name: 'Confirm booking' }).click();
    await expect(page.getByText('Required')).toHaveCount(2);
    await expect(page.getByText('Choose a seat')).toBeVisible();
    await expect(page).toHaveURL(/\/book\//);
  });

  test('two passengers get separate seats and the price updates', async ({ authedPage: page }) => {
    await searchFlights(page, { passengers: 2 });
    await selectFirstFlight(page);
    await expect(page.locator('.passenger')).toHaveCount(2);

    const total = page.locator('dd.grand');
    const before = await total.textContent();
    await freeSeats(page).nth(0).click(); // assigned to passenger 1; focus moves to passenger 2
    await freeSeats(page).nth(1).click(); // a different seat -> passenger 2 (picked seats still count as free)
    await expect(page.locator('.passenger').nth(0)).not.toContainText('Seat: —');
    await expect(page.locator('.passenger').nth(1)).not.toContainText('Seat: —');
    await expect(total).not.toHaveText(before);
  });

  test('a booked seat shows as taken to other users', async ({ browser, authedPage: page, baseURL }) => {
    await searchFlights(page);
    await selectFirstFlight(page);
    const flightUrl = page.url();
    const seat = await bookFirstFreeSeat(page);

    const ctx = await browser.newContext({ baseURL });
    const other = await ctx.newPage();
    await signUp(other, newUser());
    await other.goto(flightUrl);
    await expect(other.getByRole('button', { name: new RegExp(`^Seat ${seat}, .*, taken$`) })).toBeDisabled();
    await ctx.close();
  });

  test("another user can't see someone else's booking", async ({ browser, authedPage: page, baseURL }) => {
    await searchFlights(page);
    await selectFirstFlight(page);
    await bookFirstFreeSeat(page, 'Alan', 'Turing');
    const bookingUrl = page.url();

    const ctx = await browser.newContext({ baseURL });
    const other = await ctx.newPage();
    await signUp(other, newUser());
    await other.goto(bookingUrl);
    await expect(other.getByRole('heading', { name: 'Booking not found' })).toBeVisible();
    await ctx.close();
  });
});
