import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Plus_Jakarta_Sans, Inter } from 'next/font/google'
import { SITE_URL } from '@/lib/site-url'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { LocaleProvider } from '@/lib/i18n'
import { SwRegister } from '@/components/sw-register'

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var t = window.localStorage.getItem('kininaru-theme');
    if (t) document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
`

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

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['500', '700'],
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
  title: 'Kininaru — Organisez votre vie avec curiosité',
  description:
    'Le planificateur chaleureux qui réunit tâches, habitudes, focus, journal, espace famille et un coach IA — pour avancer chaque jour, seul ou en famille.',
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Kininaru',
    title: 'Kininaru — Organisez votre vie avec curiosité',
    description:
      'Tâches, habitudes, focus, journal, famille et coach IA dans un seul espace chaleureux.',
    // Image 1200×630 dédiée (app/opengraph-image.tsx), résolue en URL absolue
    // via metadataBase → https://kininaru-planner.vercel.app/opengraph-image
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Kininaru — Organisez votre vie avec curiosité' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kininaru — Organisez votre vie avec curiosité',
    description:
      'Tâches, habitudes, focus, journal, famille et coach IA dans un seul espace chaleureux.',
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
  icons: {
    icon: [
      {
        url: '/favicon.ico',
        sizes: 'any',
      },
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: ['/apple-icon.png', '/apple-touch-icon.png'],
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#F7F9FC',
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
      className={`${jakarta.variable} ${inter.variable} bg-background`}
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
        {/* next/script (beforeInteractive) injects the theme init in the
            initial HTML <head>, so the theme applies before first paint —
            without React's raw <script> hoisting warning. */}
        <Script id="kininaru-theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <ThemeProvider>
          <LocaleProvider>{children}</LocaleProvider>
        </ThemeProvider>
        <SwRegister />
      </body>
    </html>
  )
}
