import { Pool, neonConfig } from '@neondatabase/serverless';

neonConfig.webSocketConstructor = WebSocket;

// Deletes every e2e user and their bookings (passengers -> bookings -> users; sessions/accounts cascade).
// The database is shared with production, so this must not be skipped.
export default async function globalTeardown() {
  if (!process.env.DATABASE_URL) {
    console.warn('e2e cleanup skipped: DATABASE_URL is not set. Delete users matching e2e+%@example.com by hand.');
    return;
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const like = 'e2e+%@example.com';
    const refs = (await pool.query(`SELECT b.ref FROM bookings b JOIN "user" u ON u.id = b.user_id WHERE u.email LIKE $1`, [like])).rows.map((r) => r.ref);
    const p = await pool.query('DELETE FROM booking_passengers WHERE booking_ref = ANY($1)', [refs]);
    const b = await pool.query('DELETE FROM bookings WHERE ref = ANY($1)', [refs]);
    const u = await pool.query(`DELETE FROM "user" WHERE email LIKE $1`, [like]);
    console.log(`e2e cleanup: passengers ${p.rowCount}, bookings ${b.rowCount}, users ${u.rowCount}`);
  } catch (e) {
    console.error('E2E CLEANUP FAILED:', e.message, '- delete users matching e2e+%@example.com by hand (bookings first).');
  } finally {
    await pool.end();
  }
}
