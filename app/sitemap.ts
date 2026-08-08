import type { MetadataRoute } from 'next'

// [À COMPLÉTER] doit rester identique à SITE_URL dans app/layout.tsx une
// fois le domaine de production connu.
const SITE_URL = 'https://kininaru.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/auth/login`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/auth/sign-up`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/legal/confidentialite`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${SITE_URL}/legal/conditions`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${SITE_URL}/legal/suppression-compte`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ]
}
