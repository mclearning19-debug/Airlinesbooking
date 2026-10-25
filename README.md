# Airline Booking Portal

React + Vite frontend and a Node.js + Express API, served by **one process**, with Neon Postgres.

Search flights, pick seats on a seat map, book for up to 6 passengers, view and cancel your bookings.

## Setup

1. Create a free project at [neon.tech](https://neon.tech) and copy its **pooled** connection string (Connect → Connection string).
2. `cp .env.example .env` and set `DATABASE_URL` to that string. `.env` is gitignored; never commit or paste it elsewhere.
3. Set `BETTER_AUTH_SECRET` in `.env` to a random value: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
4. `npm install`

On first start the server creates its tables (`server/schema.sql`), loads the airports and generates flights for the next 30 days. This runs on every start and is safe to repeat: existing rows are left alone, and the schedule rolls forward.

## Run

```bash
npm run dev      # development, http://localhost:3000 (Vite hot reload runs inside Express)
npm run build    # build the frontend into dist/
npm start        # production: Express serves the API and dist/ on one port
```

Environment variables: `DATABASE_URL` (required), `PORT` (default `3000`), `BETTER_AUTH_SECRET` (signs sessions; required in production), `BETTER_AUTH_URL` (public origin, e.g. `https://my-app.example.com`; in production it falls back to Render's `RENDER_EXTERNAL_URL`, and the server exits if neither is set; defaults to `http://localhost:PORT` in development).

## Deploy

One artifact, one process: `npm ci && npm run build`, then `npm start` (Node 22+) with `DATABASE_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` set on the host.
### Render

`render.yaml` is a Render Blueprint: push the repo to GitHub, then Render Dashboard -> New -> Blueprint -> select the repo, paste your Neon `DATABASE_URL` when asked, Apply. `BETTER_AUTH_SECRET` is generated for you and the app uses Render's `RENDER_EXTERNAL_URL` as its public URL (set `BETTER_AUTH_URL` only for a custom domain). Free instances sleep after 15 minutes idle; the first request afterwards takes about a minute. Use a separate Neon branch for production.

A `Dockerfile` is also included. The server is stateless (all data lives in Neon), so several instances can run.

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health` | checks the database connection |
| GET | `/api/config` | business rules (fees, tax, cabins, cancellation window) shared with the UI |
| * | `/api/auth/*` | [Better Auth](https://www.better-auth.com): sign up, sign in, sign out, session (email + password) |
| GET | `/api/airports` | |
| GET | `/api/flights?from&to&date&passengers` | future, bookable flights with enough seats; `date` is the local date at the origin |
| GET | `/api/flights/:id` | |
| GET | `/api/flights/:id/seats` | seat map with price and taken flag |
| POST | `/api/bookings` | requires sign-in; the transactional write; 409 if a seat was just taken |
| GET | `/api/bookings`, `/api/bookings/:ref` | requires sign-in; the user's own bookings (404 for anyone else's) |
| POST | `/api/bookings/:ref/cancel` | requires sign-in; frees the seats; 409 inside the cancellation window |

## Business rules

Defined once in `server/config.js`: 12% tax, a $9.99 booking fee per booking, up to 6 passengers, Business fares at 2.5x Economy, free cancellation until 24 hours before departure, no new bookings within 2 hours of departure. Times are stored in UTC and shown in each airport's local timezone.

## Limitations / next steps

- Sign-in is email + password only. Emails are not verified and there is no password reset yet: both need an email provider (Better Auth `sendVerificationEmail` / `sendResetPassword` in `server/auth.js`). Better Auth rate-limits its own routes in production; the rest of `/api` has no rate limiting.
- Bookings made before sign-in was added (anonymous `client_id`) are no longer visible to anyone; their seats stay held until removed from the database.
- No payments and no email: the confirmation page says so. Next steps: payment provider, confirmation emails, admin tools, round trips, per-aircraft seat maps.
