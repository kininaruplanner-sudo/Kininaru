import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Plus_Jakarta_Sans, Inter } from 'next/font/google'
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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'Kininaru Planner',
  description:
    'Premium productivity planner with calendar, tasks, habits, focus, journal and an AI coach',
  openGraph: {
    title: 'Kininaru Planner',
    description:
      'Premium productivity planner with calendar, tasks, habits, focus, journal and an AI coach',
    type: 'website',
    siteName: 'Kininaru',
    images: ['/icon-512x512.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Kininaru Planner',
    description:
      'Premium productivity planner with calendar, tasks, habits, focus, journal and an AI coach',
    images: ['/icon-512x512.png'],
  },
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
