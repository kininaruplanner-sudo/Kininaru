import type { MetadataRoute } from 'next'

/**
 * Web App Manifest — makes Kininaru installable as a PWA.
 * Served automatically by Next.js at /manifest.webmanifest and linked
 * from the root layout via <link rel="manifest">.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Kininaru',
    short_name: 'Kininaru',
    description:
      'Premium productivity planner with calendar, tasks, habits, focus, journal and an AI coach',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F7F9FC',
    theme_color: '#F7F9FC',
    icons: [
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
