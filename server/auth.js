// Better Auth (email + password). It runs inside this same Express process: server/index.js mounts its
// handler at /api/auth/*, and server/api.js reads the session cookie through requireUser().
// Tables (user, session, account, verification) are created by server/schema.sql, not by a Better Auth CLI.
import { betterAuth } from 'better-auth';
import { pool } from './db.js';
import { isProd, PORT } from './env.js';

// Public origin: explicit BETTER_AUTH_URL (needed for custom domains), else the URL Render injects, else localhost.
const baseURL = process.env.BETTER_AUTH_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

// Outside production a missing secret falls back to Better Auth's insecure dev default; in production fail loudly.
if (isProd && (!process.env.BETTER_AUTH_SECRET || baseURL.startsWith('http://localhost'))) {
  console.error('BETTER_AUTH_SECRET and BETTER_AUTH_URL (or the host-provided RENDER_EXTERNAL_URL) must be set in production.');
  process.exit(1);
}

export const auth = betterAuth({
  // The Neon Pool is pg-compatible, so Better Auth shares the app's connection pool.
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Flip to true once an email provider exists (sendResetPassword / sendVerificationEmail); see README next steps.
    requireEmailVerification: false,
  },
});
