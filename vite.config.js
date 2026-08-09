import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    sourcemap: false,
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy) => {
          // The API server bounces on file changes (node --watch). Swallow the
          // connection-error stack trace and return 503 so the client can retry.
          proxy.on('error', (err, req, res) => {
            if (res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'upstream_unavailable' }));
            }
            console.log(`[proxy] ${req.method} ${req.url} → upstream down (${err.code || err.message})`);
          });
        },
      },
    }
  },
    server: {
      host: '127.0.0.1',
      port: 5173,
      proxy: {
        '/api': { target: 'http://localhost:3001', changeOrigin: true }
      }
    }
});
