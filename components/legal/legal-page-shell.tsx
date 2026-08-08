import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { LogoMark } from '@/components/landing/logo-mark'
import { LandingFooter } from '@/components/landing/landing-footer'

interface LegalPageShellProps {
  title: string
  lastUpdated: string
  children: React.ReactNode
}

export function LegalPageShell({ title, lastUpdated, children }: LegalPageShellProps) {
  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <LogoMark />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-smooth"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Retour à l'accueil
          </Link>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
          <h1 className="text-3xl font-serif font-bold text-foreground mb-2">{title}</h1>
          <p className="text-sm text-muted-foreground mb-10">Dernière mise à jour : {lastUpdated}</p>
          <div className="prose-legal space-y-8 text-sm leading-relaxed text-foreground/90">{children}</div>
        </div>
      </main>

      <LandingFooter />
    </div>
  )
}
