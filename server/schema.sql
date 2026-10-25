-- Idempotent schema; applied automatically on every server start.
-- Rules: only CREATE ... IF NOT EXISTS / ALTER TABLE ... ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.

-- Better Auth core tables (email + password). Column names are camelCase and quoted because Better Auth
-- queries them that way; do not rename them. "user" is a reserved word, so it is always quoted.
CREATE TABLE IF NOT EXISTS "user" (
  "id"            text PRIMARY KEY,
  "name"          text NOT NULL,
  "email"         text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  "image"         text,
  "createdAt"     timestamptz NOT NULL DEFAULT now(),
  "updatedAt"     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "session" (
  "id"        text PRIMARY KEY,
  "expiresAt" timestamptz NOT NULL,
  "token"     text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "ipAddress" text,
  "userAgent" text,
  "userId"    text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS session_user_id ON "session" ("userId");

CREATE TABLE IF NOT EXISTS "account" (
  "id"                    text PRIMARY KEY,
  "accountId"             text NOT NULL,
  "providerId"            text NOT NULL,
  "userId"                text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken"           text,
  "refreshToken"          text,
  "idToken"               text,
  "accessTokenExpiresAt"  timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope"                 text,
  "password"              text,
  "createdAt"             timestamptz NOT NULL DEFAULT now(),
  "updatedAt"             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_user_id ON "account" ("userId");

CREATE TABLE IF NOT EXISTS "verification" (
  "id"         text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value"      text NOT NULL,
  "expiresAt"  timestamptz NOT NULL,
  "createdAt"  timestamptz NOT NULL DEFAULT now(),
  "updatedAt"  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_identifier ON "verification" ("identifier");

CREATE TABLE IF NOT EXISTS airports (
  code     text PRIMARY KEY,
  city     text NOT NULL,
  name     text NOT NULL,
  country  text NOT NULL,
  timezone text NOT NULL -- IANA zone, used to show local times and to match the search date
);

CREATE TABLE IF NOT EXISTS flights (
  id          text PRIMARY KEY, -- e.g. AB101-20261101
  flight_no   text NOT NULL,
  origin      text NOT NULL REFERENCES airports(code),
  destination text NOT NULL REFERENCES airports(code),
  departs_at  timestamptz NOT NULL,
  arrives_at  timestamptz NOT NULL,
  base_price  numeric(10, 2) NOT NULL CHECK (base_price >= 0), -- economy fare per passenger
  aircraft    text NOT NULL,
  capacity    integer NOT NULL CHECK (capacity > 0),
  CHECK (arrives_at > departs_at),
  CHECK (origin <> destination)
);
CREATE INDEX IF NOT EXISTS flights_route ON flights (origin, destination, departs_at);

CREATE TABLE IF NOT EXISTS bookings (
  ref        text PRIMARY KEY, -- 6-character confirmation code
  client_id  text,
  flight_id  text NOT NULL REFERENCES flights(id),
  contact    jsonb NOT NULL,
  subtotal   numeric(10, 2) NOT NULL,
  tax        numeric(10, 2) NOT NULL,
  fee        numeric(10, 2) NOT NULL,
  total      numeric(10, 2) NOT NULL,
  status     text NOT NULL DEFAULT 'Confirmed' CHECK (status IN ('Confirmed', 'Cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Bookings belong to a signed-in user. Rows made before sign-in existed have only the old anonymous client_id
-- (user_id NULL): nobody can see them any more, and the column is kept so no data is deleted.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS user_id text REFERENCES "user"("id");
CREATE INDEX IF NOT EXISTS bookings_user ON bookings (user_id, created_at DESC);

-- One row per traveller. Fare and cabin are snapshotted so history survives later price edits.
CREATE TABLE IF NOT EXISTS booking_passengers (
  id          bigserial PRIMARY KEY,
  booking_ref text NOT NULL REFERENCES bookings(ref) ON DELETE CASCADE,
  flight_id   text NOT NULL REFERENCES flights(id),
  first_name  text NOT NULL,
  last_name   text NOT NULL,
  seat        text NOT NULL,
  cabin       text NOT NULL,
  fare        numeric(10, 2) NOT NULL,
  active      boolean NOT NULL DEFAULT true -- false once the booking is cancelled, which frees the seat
);
-- The no-double-booking guarantee: a seat can be active on only one passenger per flight.
CREATE UNIQUE INDEX IF NOT EXISTS passengers_seat_unique ON booking_passengers (flight_id, seat) WHERE active;
CREATE INDEX IF NOT EXISTS passengers_booking ON booking_passengers (booking_ref);
