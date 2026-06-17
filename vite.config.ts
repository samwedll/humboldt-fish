import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Humboldt Fish',
        short_name: 'Fish',
        description: 'Should I fish tomorrow? Live North Coast go/no-go + catch rules.',
        theme_color: '#0b2b40',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Explicit globPatterns required to include woff2 (offline fonts) — the
        // plugin default extension list omits woff2. We mirror the SvelteKit-PWA
        // default coverage (client/** app shell + prerendered/** static HTML/JSON)
        // and add woff2 so self-hosted fonts are available offline.
        globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,webmanifest,woff2}', 'prerendered/**/*.{html,json}'],
        navigateFallback: '/',
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // The live verdict — best-effort offline (serve last good response).
            urlPattern: /\/api\/verdict/,
            handler: 'NetworkFirst',
            options: { cacheName: 'verdict', expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 } }
          }
        ]
      }
    })
  ]
});
