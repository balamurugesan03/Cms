import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => ({
  // Sub-path the app is served from in production, e.g. /cms/ (see .env.production)
  base: mode === 'production' ? loadEnv(mode, process.cwd(), '').VITE_BASE_PATH || '/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000',
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
}));
