import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Second entry point, built and deployed separately from the main app.
//
// The point is that the wizard's bundle contains ONLY the wizard. Club presidents are
// sent here from a cold outreach message, and the main app is not launch-ready — so the
// isolation is a build boundary rather than a runtime check on hostname. There is no
// import path from src/onboard/ into App.jsx, ClubDataProvider or NavBar, so none of it
// can be reached, downloaded, or accidentally rendered here.
//
// Deliberately no Tailwind plugin: this surface is a handful of screens with its own
// stylesheet, and pulling in the app's utility layer would cost more than it saves.
export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist-onboard',
        sourcemap: false,
        rollupOptions: {
            input: resolve(process.cwd(), 'onboard.html'),
        },
    },
    server: {
        host: '127.0.0.1',
        port: 5174,
        open: '/onboard.html',
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
});
