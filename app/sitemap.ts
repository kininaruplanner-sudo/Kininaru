import type { MetadataRoute } from 'next'

/**
 * Sitemap — public routes only.
 * Private routes (dashboard, tasks, journal, family, settings, ...) are
 * intentionally excluded: they require authentication and contain user data.
 */
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

const PUBLIC_ROUTES: { path: string; priority: number }[] = [
  { path: '', priority: 1 },
  { path: '/legal/conditions', priority: 0.4 },
  { path: '/legal/confidentialite', priority: 0.4 },
  { path: '/legal/suppression-compte', priority: 0.4 },
  { path: '/auth/login', priority: 0.2 },
  { path: '/auth/sign-up', priority: 0.2 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map(({ path, priority }) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority,
  }))
}
