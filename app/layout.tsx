import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Plus_Jakarta_Sans, Inter, Pacifico } from 'next/font/google'
import { SITE_URL } from '@/lib/site-url'
import './globals.css'
import { LocaleProvider } from '@/lib/i18n'
import { SwRegister } from '@/components/sw-register'
import { AnalyticsPageViews } from '@/components/analytics-page-views'
import { MemphisBackdrop } from '@/components/memphis-background'

// Google Tag Manager — identifiant PUBLIC du conteneur (il apparaît dans le
// code source de chaque page par conception, ce n'est pas un secret). Surcharge
// possible via NEXT_PUBLIC_GTM_ID (optionnel) ; GTM-PVDG6TFF est la valeur par
// défaut fournie par Google.
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || 'GTM-PVDG6TFF'

const GTM_SCRIPT = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`

// Google tag (gtag.js) — GA4 `G-1LELPWQS5D` fourni par le compte Google
// (identifiant PUBLIC par conception, visible dans le code source de chaque
// page). Surcharge possible via NEXT_PUBLIC_GA4_ID (optionnel). Le dataLayer
// est partagé avec GTM. next/script injecte le script dans le <head> initial
// (avantInteractive) et l'init juste après l'hydratation (afterInteractive),
// pour ne jamais bloquer le rendu.
const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID || 'G-1LELPWQS5D'

const GA4_SCRIPT = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
// Confidentialité : send_page_view:false + anonymize_ip. Les vues de page
// sont envoyées par le composant AnalyticsPageViews avec le chemin UNIQUEMENT
// (jamais les query strings — elles contiennent des données personnelles
// comme taskId ou les titres de tâches).
gtag('config', '${GA4_ID}', { send_page_view: false, anonymize_ip: true });
`

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['500', '700'],
  display: 'swap',
})

// Pacifico — accent manuscrit réservé à un mot du hero (landing). Chargée
// côté serveur comme les autres polices ; exposée via --font-pacifico.
const pacifico = Pacifico({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-pacifico',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '700'],
  display: 'swap',
})

// Vérification Google Search Console — méthode officielle : les balises
// <meta name="google-site-verification" content="…"/> sont générées par Next.js
// via la propriété `verification.google`. Le code fourni par Google (propriété
// « URL-prefix ») est ajouté directement : c'est un identifiant PUBLIC, visible
// dans le code source de la page. Un code supplémentaire peut être passé via la
// variable d'environnement NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION (non requise).
const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION

// Tous les codes actifs, sans doublon.
const googleVerificationCodes = [
  'nltjYyoYZCKVQtSrmkSUZw9NLIHX3RKir7g770YdAJc',
  googleSiteVerification,
].filter((code): code is string => Boolean(code))

export const metadata: Metadata = {
  // metadataBase garantit que toutes les URLs relatives (og:image, twitter:image,
  // canonical…) sont résolues en URLs ABSOLUES publiques — sinon les crawlers
  // (WhatsApp, Discord, Facebook, Twitter/X…) ne peuvent pas récupérer l'image
  // de partage. En production : https://kininaru-planner.vercel.app.
  metadataBase: new URL(SITE_URL),
  title: 'Kininaru — Ton coach pour savoir quoi faire maintenant',
  description:
    "Tu as déjà une liste de choses à faire. Kininaru t'aide à choisir laquelle faire maintenant — tâches, habitudes, focus, journal, famille et un coach IA qui guide ta journée.",
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Kininaru',
    title: 'Kininaru — Ton coach pour savoir quoi faire maintenant',
    description:
      'Choisis quoi faire maintenant : tâches, habitudes, focus, journal, famille et un coach IA qui observe tes vraies données.',
    // Image 1200×630 dédiée (app/opengraph-image.tsx), résolue en URL absolue
    // via metadataBase → https://kininaru-planner.vercel.app/opengraph-image
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Kininaru — Ton coach pour savoir quoi faire maintenant' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kininaru — Ton coach pour savoir quoi faire maintenant',
    description:
      'Choisis quoi faire maintenant : tâches, habitudes, focus, journal, famille et un coach IA qui guide ta journée.',
    images: ['/opengraph-image'],
  },
  // Balises Google Search Console (codes actifs uniquement).
  verification: { google: googleVerificationCodes },
  applicationName: 'Kininaru',
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Kininaru',
  },
  // Identité unique : thème clair blanc — une seule icône, pas de variante
  // sombre (l'application ne gère plus plusieurs thèmes).
  icons: {
    icon: [
      {
        url: '/favicon.ico',
        sizes: 'any',
      },
      {
        url: '/icon-light-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: ['/apple-icon.png'],
  },
}

export const viewport: Viewport = {
  // Charte unique : fond blanc épuré, barres de statut mobiles et fenêtres
  // PWA standalone alignées sur #FFFFFF.
  themeColor: '#FFFFFF',
  // Mobile: let the layout reach the physical edges (home-bar safe areas) and
  // let the browser resize the layout when the soft keyboard opens, so the AI
  // composer stays visible above the keyboard instead of being covered.
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${jakarta.variable} ${inter.variable} ${pacifico.variable} bg-background`}
    >
      <body className={`${inter.className} antialiased`}>
        {/* Google Tag Manager (noscript) — placé juste après l'ouverture de
            <body>, comme demandé par Google (fallback pour les navigateurs
            sans JavaScript). */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {/* Google Tag Manager — next/script (beforeInteractive) injecte ce
            script dans le <head> initial de chaque page, le plus haut
            possible (avant le script d'init du thème). */}
        <Script id="kininaru-gtm" strategy="beforeInteractive">
          {GTM_SCRIPT}
        </Script>
        {/* Google tag (gtag.js) — chargé en async juste après l'hydratation,
            une seule balise, présente sur toutes les pages via ce layout. */}
        <Script
          id="kininaru-ga4"
          src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
          strategy="afterInteractive"
        />
        <Script id="kininaru-ga4-init" strategy="afterInteractive">
          {GA4_SCRIPT}
        </Script>
        {/* Fond géométrique « Memphis » — formes discrètes derrière toutes
            les pages (z-index négatif, pointer-events-none). */}
        <MemphisBackdrop />
        <LocaleProvider>{children}</LocaleProvider>
        <AnalyticsPageViews />
        <SwRegister />
      </body>
    </html>
  )
}
