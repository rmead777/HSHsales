import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Generates favicon, apple-touch, and 192/512 (+ maskable) PNGs from the source SVG at
      // build time and injects them into the manifest + <head>. Requires @vite-pwa/assets-generator.
      pwaAssets: {
        image: 'public/favicon.svg',
        overrideManifestIcons: true,
      },
      // devOptions: { enabled: true }, // uncomment to exercise the service worker in `npm run dev`
      manifest: {
        name: 'High Score Host — Sales',
        short_name: 'HSH Sales',
        description: 'Your attributed sales links, QR codes, and checkout — anywhere.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        // Never serve the SPA shell for API calls (the Stripe webhook lives at /api/*).
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
})
