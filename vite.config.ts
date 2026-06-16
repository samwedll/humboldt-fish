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
        theme_color: '#0c4a6e',
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
        // Leave globPatterns to the plugin's smart defaults — @vite-pwa/sveltekit
        // precaches BOTH client/** (app shell + bundled regs/identification) and
        // prerendered/** (the static /rules HTML) under .svelte-kit/output. A flat
        // custom pattern like ['**/*...'] misses those client//prerendered prefixes,
        // so do NOT set globPatterns here.
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
