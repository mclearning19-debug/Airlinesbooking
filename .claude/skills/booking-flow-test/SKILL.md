---
name: booking-flow-test
description: End-to-end test of the Airline Booking API on a running deployment (local dev, Render or Azure). Use when asked to test, smoke-test or verify the booking flow, sign-up, seat race or cancellation on a live URL, or after a deploy. Creates throwaway users and bookings and deletes them afterwards.
---

# Booking flow test

Runs 30 checks against any running instance of this app through its HTTP API (not the browser UI):
browsing, auth required (401), sign-up for two users, validation (400), server-side price recompute
(client `total`/`fare`/`status` ignored), taken seat (409), the 4-concurrent-request seat race
(`[201,409,409,409]`), ownership (other user gets 404), cancel frees seats, double cancel (409), rebook,
sign-out.

## Run

From the repo root (it needs `.env` for `DATABASE_URL`, used only for cleanup):

```bash
node --env-file=.env .claude/skills/booking-flow-test/booking-flow.mjs <baseUrl>
```

Base URLs:
- Local dev: `http://localhost:3000` (start `npm run dev` first; on Windows check for a stale `node` holding port 3000)
- Render: `https://airline-booking-to3e.onrender.com`
- Azure: `https://airline-booking.orangestone-ac8d8541.eastus.azurecontainerapps.io`

Free/scale-to-zero hosts cold-start: hit `/api/health` first and wait for `{"ok":true}`.

## Notes

- Exit code 0 means every check passed; each line prints `PASS`/`FAIL`, and the last line is `N/M checks passed`.
- Every deployment shares one Neon database, so the script deletes its own rows in a `finally` block
  (passengers, then bookings, then users). It prints `cleanup: passengers N, bookings N, users N`. If it prints
  `CLEANUP FAILED`, delete the listed `flowtest+...@example.com` users and their bookings by hand, bookings first
  (they reference `"user"`).
- It picks a flight departing more than `cancelHoursBefore + 72` hours out so cancelling is allowed. If the
  schedule has no such flight the first search check fails.
- Sign-up uses `Origin: <baseUrl>`, so it also verifies `BETTER_AUTH_URL` is right for that host (a wrong
  value shows up as a failed sign-up, `INVALID_ORIGIN`).
- When the API changes (routes, validation, rules), update the checks in `booking-flow.mjs` to match; rule
  values such as `cancelHoursBefore`, `taxRate` and `bookingFee` are read from `GET /api/config`, not hardcoded.
- Report failures with the actual output. Don't re-run until it passes without finding out why.
