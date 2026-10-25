// Shared runtime flags. Imported by server/index.js and server/auth.js.
export const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
export const PORT = Number(process.env.PORT) || 3000;
