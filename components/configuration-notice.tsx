import { Database } from 'lucide-react'
import { Card } from '@/components/ui/card'

/**
 * Shown instead of a 500 when the Supabase env vars are missing.
 *
 * Every authenticated route calls `createClient()`, which throws when
 * `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are absent.
 * Without this notice a missing `.env.local` (fresh clone, new environment,
 * or a forgotten production variable) turns the whole app into a blank
 * "Application error" screen with no hint about what is broken.
 */
export function ConfigurationNotice() {
  return (
    <main className="min-h-dvh bg-background flex items-center justify-center p-6">
      <Card padding="lg" className="w-full max-w-lg space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Database className="w-5 h-5" aria-hidden="true" />
          </span>
          <h1 className="text-lg font-semibold">Configuration Supabase requise</h1>
        </div>

        <p className="text-sm text-muted-foreground">
          Kininaru n&apos;arrive pas à se connecter à sa base de données. Renseigne
          ces deux variables dans <code className="text-foreground">.env.local</code>
          {' '}(ou dans les variables d&apos;environnement de ton hébergeur), puis
          relance l&apos;application :
        </p>

        <ul className="space-y-2 text-sm font-mono">
          <li className="rounded-lg bg-muted px-3 py-2 break-all">NEXT_PUBLIC_SUPABASE_URL</li>
          <li className="rounded-lg bg-muted px-3 py-2 break-all">NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
        </ul>

        <p className="text-xs text-muted-foreground">
          Les valeurs se trouvent dans Supabase → Project Settings → API.
          Voir le README pour la configuration complète.
        </p>
      </Card>
    </main>
  )
}
