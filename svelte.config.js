import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  compilerOptions: {
    // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
    runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
  },
  kit: {
    adapter: adapter({
      routes: { include: ['/*'], exclude: ['<all>'] }
    }),
    prerender: {
      // PWA icon PNGs (pwa-192x192.png, pwa-512x512.png, apple-touch-icon-180x180.png)
      // are generated in Task 13 and don't exist yet — suppress 404s so the build
      // succeeds. Remove this once Task 13 generates the static/ icons.
      handleHttpError: ({ path, message }) => {
        if (/\.(png|ico|svg)$/.test(path)) return;
        throw new Error(message);
      }
    }
  }
};

export default config;
