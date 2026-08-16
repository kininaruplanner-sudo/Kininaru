import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site-url'

/**
 * robots.txt — the private (authenticated) routes are not meant to be
 * indexed and are disallowed here.
 *
 * NOTE: robots.txt is NOT a security measure. The real protection for
 * these routes is authentication (Supabase session) plus the database
 * Row Level Security policies.
 */
const baseUrl = SITE_URL

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard',
        '/tasks',
        '/habits',
        '/calendar',
        '/family',
        '/journal',
        '/settings',
        '/focus',
        '/analytics',
        '/ai',
        '/api/', // API routes (AI coach included)
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
