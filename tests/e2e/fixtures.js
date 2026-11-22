import { test as base, expect } from '@playwright/test';

export { expect };

// Every test user's email starts with this prefix; global-teardown deletes them (and their bookings).
export const E2E_PREFIX = 'e2e+';
export const PASSWORD = 'E2eTest12345!';

let counter = 0;
export const newUser = () => ({
  name: 'E2E Tester',
  email: `${E2E_PREFIX}${Date.now()}-${process.pid}-${counter++}@example.com`,
  password: PASSWORD,
});

// Local date (YYYY-MM-DD) `days` from now. Flights exist for the next 30 days; 7 days out is
// comfortably outside the 24h cancellation window.
export function dateInDays(days) {
  const d = new Date(Date.now() + days * 86_400_000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function fillSignUp(page, user) {
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Name').fill(user.name);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Create account' }).click();
}

export async function signUp(page, user) {
  await page.goto('/sign-in');
  await fillSignUp(page, user);
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

export const test = base.extend({
  user: async ({}, use) => use(newUser()),
  // A fresh, signed-in user for each test (each test has its own browser context).
  authedPage: async ({ page, user }, use) => {
    await signUp(page, user);
    await use(page);
  },
});
