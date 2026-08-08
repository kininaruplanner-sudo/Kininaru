'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { LogoMark } from '@/components/landing/logo-mark'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Logged for local/server debugging. Swap for a proper error-reporting
    // call (Sentry, etc.) if one is added to the project later.
    console.error(error)
  }, [error])

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="flex justify-center mb-6">
          <LogoMark />
        </Link>

        <div className="bg-card border border-border rounded-2xl shadow-kin-hover p-8 transition-smooth">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>

          <h1 className="text-lg font-serif font-bold text-foreground mb-2">
            Une erreur est survenue
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Quelque chose s'est mal passé de notre côté. Vous pouvez réessayer, ou revenir à
            l'accueil.
          </p>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 gap-2" onClick={() => reset()}>
              <RefreshCw className="w-4 h-4" />
              Réessayer
            </Button>
            <Link href="/dashboard" className="flex-1">
              <Button className="w-full gap-2">
                <Home className="w-4 h-4" />
                Accueil
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
