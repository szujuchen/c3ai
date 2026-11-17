import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Bundles the web app as one script that jsdom can run, pointed at the API the UI test starts on port 3111.
export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  logLevel: 'warn',
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://localhost:3111/api') },
  build: {
    outDir: fileURLToPath(new URL('./.build', import.meta.url)),
    emptyOutDir: true,
    minify: false,
    lib: { entry: fileURLToPath(new URL('../src/main.js', import.meta.url)), formats: ['iife'], name: 'CrunchCalendar', fileName: () => 'bundle.js' },
  },
});
