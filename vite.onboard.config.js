import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { existsSync, renameSync } from 'fs';

// Vite names the emitted HTML after its input file, so this build produced
// dist-onboard/onboard.html and no index.html at all. Static hosts serve index.html at
// '/', so the deployed site 404'd on its own root — and, with the SPA rewrite in
// vercel.json pointing at /index.html, every /claim/<token> link would have 404'd too.
//
// Renaming after the bundle is written is the least invasive fix: the source entry stays
// onboard.html (which keeps `npm run dev:onboard` and the two-entry layout readable) and
// only the deployed artifact is normalised.
// In dev, Vite's SPA fallback serves the project root's index.html for any unmatched
// path — which is the MAIN app. So `npm run dev:onboard` then visiting /claim/<token>
// silently rendered the wrong application, making it impossible to test this surface
// locally. Production is unaffected (there, index.html IS the wizard, per the rename
// below), which is exactly why it went unnoticed.
//
// This rewrites non-asset requests to onboard.html so dev matches production.
function serveOnboardEntry() {
    return {
        name: 'onboard-dev-entry',
        configureServer(server) {
            server.middlewares.use((req, _res, next) => {
                const url = req.url || '';
                const isInternal = url.startsWith('/@') || url.startsWith('/src/')
                    || url.startsWith('/node_modules/') || url.startsWith('/api');
                const looksLikeFile = url.split('?')[0].includes('.');
                if (!isInternal && !looksLikeFile) req.url = '/onboard.html';
                next();
            });
        },
    };
}

function emitAsIndexHtml(outDir) {
    return {
        name: 'onboard-emit-index-html',
        closeBundle() {
            const from = resolve(process.cwd(), outDir, 'onboard.html');
            const to = resolve(process.cwd(), outDir, 'index.html');
            if (existsSync(from)) renameSync(from, to);
        },
    };
}

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
export default defineConfig(({ command }) => {
    const env = loadEnv('development', process.cwd(), '');
    // Railway when VITE_API_URL is set, otherwise a local backend.
    const apiTarget = env.VITE_API_URL?.replace(/\/$/, '') || 'http://localhost:3001';

    return {
        plugins: [react(), serveOnboardEntry(), emitAsIndexHtml('dist-onboard')],

        // In dev only, blank out VITE_API_URL so api.js falls back to a relative '/api'
        // and the request goes through the proxy below — same-origin, so no CORS.
        //
        // Without this, api.js calls Railway directly from 127.0.0.1 and every request
        // is blocked, because FRONTEND_URL cannot list a port that changes per machine.
        // That made this surface impossible to develop against real data. Production is
        // untouched: the build keeps whatever VITE_API_URL the host provides.
        define: command === 'serve' ? { 'import.meta.env.VITE_API_URL': '""' } : {},

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
                    target: apiTarget,
                    changeOrigin: true,
                },
            },
        },
    };
});
