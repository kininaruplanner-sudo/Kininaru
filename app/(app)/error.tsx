'use client'

import { useEffect } from 'react'
import { ConfigurationNotice } from '@/components/configuration-notice'

const CONFIG_ERROR_MARKER = 'Configuration Supabase manquante'

/**
 * Error boundary for the authenticated segment.
 *
 * Pages call `createClient()` themselves (in addition to the layout), so a
 * missing Supabase configuration can still throw here. Show the setup notice
 * for that specific case and keep the generic fallback for anything else.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  if (error.message.includes(CONFIG_ERROR_MARKER)) {
    return <ConfigurationNotice />
  }

  return (
    <main className="min-h-dvh bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-4 text-center">
        <h1 className="text-lg font-semibold">Une erreur est survenue</h1>
        <p className="text-sm text-muted-foreground">
          Cette page n&apos;a pas pu être chargée. Tu peux réessayer.
        </p>
        <button
          type="button"
          onClick={reset}
          className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium transition-smooth hover:opacity-90"
        >
          Réessayer
        </button>
      </div>
    </main>
  )
}
