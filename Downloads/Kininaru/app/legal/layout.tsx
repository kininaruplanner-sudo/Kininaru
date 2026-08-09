import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Pages légales — Kininaru',
    template: '%s — Kininaru',
  },
}

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-serif font-bold text-lg tracking-tight hover:opacity-80 transition-smooth">
            Kininaru
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-smooth"
          >
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-12">{children}</main>

      <footer className="border-t border-border bg-card">
        <div className="max-w-3xl mx-auto px-6 py-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Kininaru</span>
          <Link href="/legal/conditions" className="hover:text-foreground transition-smooth">
            Conditions d&apos;utilisation
          </Link>
          <Link href="/legal/confidentialite" className="hover:text-foreground transition-smooth">
            Politique de confidentialité
          </Link>
          <Link href="/legal/suppression-compte" className="hover:text-foreground transition-smooth">
            Suppression du compte
          </Link>
        </div>
      </footer>
    </div>
  )
}
