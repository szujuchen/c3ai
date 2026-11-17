import { defineConfig } from 'vite';

// In dev, /api is proxied to the backend so the browser sees one origin (no CORS setup needed).
export default defineConfig({
  server: {
    port: 5173,
    proxy: { '/api': process.env.VITE_PROXY_TARGET || 'http://localhost:3001' },
  },
});
