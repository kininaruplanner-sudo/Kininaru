import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { ToastProvider } from '@/components/ui/toast-provider'
import { ConfirmProvider } from '@/components/ui/confirm-provider'
import { AnalyticsProvider } from '@/components/analytics-provider'

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var t = window.localStorage.getItem('kininaru-theme');
    if (t) document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
`

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

// [À COMPLÉTER] une fois le domaine de production connu — nécessaire pour
// que les URLs Open Graph/canonical se résolvent correctement.
const SITE_URL = 'https://kininaru.app'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Kininaru Planner — Organisez votre vie, sereinement',
    template: '%s · Kininaru',
  },
  description:
    'Calendrier, tâches, habitudes, focus et journal réunis dans un espace calme et personnalisable.',
  alternates: {
    canonical: '/',
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
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
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'Kininaru Planner — Organisez votre vie, sereinement',
    description:
      'Calendrier, tâches, habitudes, focus et journal réunis dans un espace calme et personnalisable.',
    url: SITE_URL,
    siteName: 'Kininaru',
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kininaru Planner — Organisez votre vie, sereinement',
    description:
      'Calendrier, tâches, habitudes, focus et journal réunis dans un espace calme et personnalisable.',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: '#F7F9FC',
  viewportFit: 'cover',
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
      className={`${jakarta.variable} ${inter.variable} bg-background scroll-smooth`}
    >
      <body className={`${inter.className} antialiased`}>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[300] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-kin-hover"
        >
          Aller au contenu principal
        </a>
        <ThemeProvider>
          <AnalyticsProvider>
            <ToastProvider>
              <ConfirmProvider>{children}</ConfirmProvider>
            </ToastProvider>
          </AnalyticsProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
