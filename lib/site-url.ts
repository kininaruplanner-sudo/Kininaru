/**
 * Kininaru — URL publique du site (source unique).
 *
 * Ordre de priorité :
 *   1. `NEXT_PUBLIC_SITE_URL` si défini (variable d'environnement, utile en
 *      développement pour pointer vers un autre environnement).
 *   2. `VERCEL_PROJECT_PRODUCTION_URL` (défini automatiquement par Vercel,
 *      ex. `kininaru-planner.vercel.app`) — garantit que les URLs générées
 *      (Open Graph, sitemap, robots) sont toujours absolues et publiques en
 *      production, même si la variable NEXT_PUBLIC n'est pas renseignée.
 *   3. Fallback explicite vers l'URL de production du projet.
 *
 * Utilisé par : app/layout.tsx (metadataBase + Open Graph/Twitter),
 * app/sitemap.ts, app/robots.ts, app/opengraph-image.tsx.
 *
 * IMPORTANT : ne JAMAIS retomber sur `http://localhost:3000` pour les
 * métadonnées de partage — les crawlers (WhatsApp, Discord, Facebook,
 * Twitter/X, Slack…) ne peuvent pas récupérer une image sur localhost,
 * ce qui rendait les aperçus de lien vides.
 */
export const SITE_URL: string =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://kininaru-planner.vercel.app')
