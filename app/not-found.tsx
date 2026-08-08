import Link from 'next/link'
import { Compass, Home } from 'lucide-react'
import { LogoMark } from '@/components/landing/logo-mark'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Page introuvable',
}

export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="flex justify-center mb-6">
          <LogoMark />
        </Link>

        <div className="bg-card border border-border rounded-2xl shadow-kin-hover p-8 transition-smooth">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Compass className="w-7 h-7 text-primary" />
          </div>

          <p className="font-serif text-5xl font-bold text-foreground mb-2">404</p>
          <h1 className="text-lg font-serif font-bold text-foreground mb-2">
            Cette page n'existe pas
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Le lien est peut-être incorrect, ou la page a été déplacée.
          </p>

          <Link href="/dashboard">
            <Button className="w-full gap-2">
              <Home className="w-4 h-4" />
              Retour au tableau de bord
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
