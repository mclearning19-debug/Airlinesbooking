// Neon serverless Postgres. Pool (WebSocket) is used rather than the HTTP
// driver because writes need interactive transactions.
import fs from 'node:fs';
import { Pool } from '@neondatabase/serverless';
import { airports, generateFlights } from './data/seed.js';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and add your Neon connection string.');
  process.exit(1);
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Run fn inside a transaction on a dedicated connection.
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Create tables and seed the first time. Safe to run on every start: existing rows are
// left untouched, so editing seed.js does NOT change data already in the database.
export async function migrate() {
  const schema = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  await transaction(async (client) => {
    // Serialize migrations if several instances start at once.
    await client.query('SELECT pg_advisory_xact_lock(571011530)');
    await client.query(schema);
    for (const a of airports) {
      await client.query(
        `INSERT INTO airports (code, city, name, country, timezone) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code) DO NOTHING`,
        [a.code, a.city, a.name, a.country, a.timezone]
      );
    }
    // One bulk insert (not a round trip per flight): this runs on every start.
    const f = generateFlights();
    await client.query(
      `INSERT INTO flights (id, flight_no, origin, destination, departs_at, arrives_at, base_price, aircraft, capacity)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::timestamptz[], $6::timestamptz[],
                            $7::numeric[], $8::text[], $9::int[])
       ON CONFLICT (id) DO NOTHING`,
      [
        f.map((x) => x.id), f.map((x) => x.flight_no), f.map((x) => x.origin), f.map((x) => x.destination),
        f.map((x) => x.departs_at), f.map((x) => x.arrives_at), f.map((x) => x.base_price),
        f.map((x) => x.aircraft), f.map((x) => x.capacity),
      ]
    );
  });
}
