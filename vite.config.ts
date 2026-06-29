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
      includeAssets: ['hshlogo.png', 'hshlogocube.png', 'apple-touch-icon.png'],
      // devOptions: { enabled: true }, // uncomment to exercise the service worker in `npm run dev`
      manifest: {
        name: 'High Score Host - Sales',
        short_name: 'HSH Sales',
        description: 'Your attributed sales links, QR codes, and checkout - anywhere.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        // Never serve the SPA shell for API calls (the Stripe webhook lives at /api/*).
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
})
