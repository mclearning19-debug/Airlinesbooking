import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // HMR_PORT lets a second dev server (e.g. the Playwright one) run next to the main one; default stays 24678.
  server: process.env.HMR_PORT ? { hmr: { port: Number(process.env.HMR_PORT) } } : {},
});
