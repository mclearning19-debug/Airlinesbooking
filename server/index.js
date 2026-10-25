// Single entry point: serves the API and the React app from one process.
// Development: Vite runs as middleware (hot reload, no separate dev server).
// Production:  serves the prebuilt dist/ folder.
import express from 'express';
import path from 'node:path';
import { toNodeHandler } from 'better-auth/node';
import { migrate } from './db.js';
import { isProd, PORT } from './env.js';

try {
  await migrate();
} catch (err) {
  console.error('Database setup failed. Check DATABASE_URL and that the database is reachable.');
  console.error(err);
  process.exit(1);
}

// Imported only after migrate(): Better Auth checks for its tables as soon as auth.js loads, so a static
// import (which runs first) fails on a fresh database and every auth request would then return 500.
const { auth } = await import('./auth.js');
const { default: api } = await import('./api.js');

const app = express();
// Better Auth owns /api/auth/*. It reads the raw request body itself, so it must be mounted before any
// body parser (express.json lives inside the api router below, which is fine). Express 5 needs "*splat".
app.all('/api/auth/*splat', toNodeHandler(auth));
app.use('/api', api);

if (isProd) {
  const dist = path.resolve('dist');
  app.use(express.static(dist, { index: false }));
  // SPA fallback so client-side routes work on refresh. /api is handled above and never reaches here.
  app.use((req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.listen(PORT, () => {
  console.log(`Airline Booking Portal running at http://localhost:${PORT} (${isProd ? 'production' : 'development'})`);
});
