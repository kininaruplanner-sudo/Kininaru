'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, Link2, Unlink, Clock, ExternalLink, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cardVariants } from '@/components/ui/card'
import {
  CALENDAR_PROVIDERS,
  type CalendarConnectionRow,
  type CalendarProvider,
} from '@/lib/calendar/providers'
import { SITE_URL } from '@/lib/site-url'

/**
 * Calendriers connectés (§28.11) — Settings section.
 *
 * Each provider shows its real state: connected (with last sync + sync mode),
 * connectable, or "to configure" when the app has no OAuth credentials yet.
 * Nothing is faked: a provider without credentials shows exactly what to do.
 */
export function CalendarConnections() {
  const supabase = createClient()
  const [connections, setConnections] = useState<CalendarConnectionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  // Ticking clock for the “il y a X min” labels (pure during render).
  const [now, setNow] = useState(() => Date.now())

  const load = async () => {
    try {
      const { data } = await supabase
        .from('calendar_connections')
        .select('id, provider, display_name, sync_mode, enabled, last_sync_at, sync_error, created_at')
        .order('created_at', { ascending: true })
      setConnections((data ?? []) as CalendarConnectionRow[])
    } catch {
      // Table may not exist yet (SQL not run) — show all providers as unconnected.
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Deferred so the initial fetch never calls setState synchronously
    // inside the effect body (react-hooks/set-state-in-effect).
    const t = setTimeout(() => void load(), 0)
    const clock = setInterval(() => setNow(Date.now()), 60_000)
    return () => {
      clearTimeout(t)
      clearInterval(clock)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const connected = (providerId: string) =>
    connections.filter((c) => c.provider === providerId)

  const disconnect = async (id: string) => {
    await supabase.from('calendar_connections').delete().eq('id', id)
    await load()
  }

  const syncNow = async (providerId: string, id: string) => {
    setSyncingId(id)
    try {
      // Server-side sync — refreshes last_sync_at / sync_error honestly.
      const res = await fetch(`/api/calendar/${providerId}/sync`, { method: 'POST' })
      if (!res.ok) {
        await supabase
          .from('calendar_connections')
          .update({ sync_error: 'Synchronisation indisponible (voir configuration).' })
          .eq('id', id)
      }
    } catch {
      // offline — banner handles it
    } finally {
      setSyncingId(null)
      await load()
    }
  }

  const connect = async (provider: CalendarProvider) => {
    if (provider.kind === 'subscription') {
      // ICS: manual subscription — document the official method.
      window.open(provider.docsUrl, '_blank', 'noopener,noreferrer')
      return
    }
    if (!provider.configured) {
      window.open(provider.docsUrl, '_blank', 'noopener,noreferrer')
      return
    }
    window.location.assign(`/api/calendar/${provider.id}/connect`)
  }

  const lastSyncLabel = (c: CalendarConnectionRow) => {
    if (!c.last_sync_at) return 'Jamais synchronisé'
    const mins = Math.max(0, Math.round((now - new Date(c.last_sync_at).getTime()) / 60_000))
    if (mins < 1) return 'à l’instant'
    if (mins < 60) return `il y a ${mins} min`
    const hours = Math.round(mins / 60)
    if (hours < 24) return `il y a ${hours} h`
    return `il y a ${Math.round(hours / 24)} j`
  }

  if (loading) {
    return (
      <div className={cn(cardVariants({ padding: 'lg' }), 'space-y-2')}>
        <div className="h-4 w-40 rounded bg-muted/70 animate-pulse" />
        <div className="h-4 w-64 rounded bg-muted/70 animate-pulse" />
      </div>
    )
  }

  return (
    <div className={cn(cardVariants({ padding: 'lg' }), 'space-y-4')}>
      <div className="flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-primary" />
        <h2 className="kin-h3 text-foreground">Calendriers connectés</h2>
      </div>

      <div className="space-y-3">
        {CALENDAR_PROVIDERS.map((provider) => {
          const conns = connected(provider.id)
          const conn = conns[0]
          return (
            <div
              key={provider.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-xl border border-border bg-card"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{provider.label}</p>
                  {conn ? (
                    <span className="flex items-center gap-1 text-xs text-kin-sage font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-kin-sage" /> Connecté
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Non connecté</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {provider.description}
                </p>
                {conn && (
                  <p className="text-xs text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Dernière synchronisation : {lastSyncLabel(conn)}
                    </span>
                    <span>
                      {conn.sync_mode === 'read_write' ? 'Lecture + écriture' : 'Lecture seule'}
                    </span>
                    {conn.sync_error && <span className="text-destructive">{conn.sync_error}</span>}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {conn ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={syncingId === conn.id}
                      onClick={() => void syncNow(provider.id, conn.id)}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      {syncingId === conn.id ? '…' : 'Synchroniser'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void disconnect(conn.id)}
                      aria-label={`Déconnecter ${provider.label}`}
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      Déconnecter
                    </Button>
                  </>
                ) : provider.kind === 'oauth' && !provider.configured ? (
                  <Button variant="outline" size="sm" onClick={() => void connect(provider)}>
                    <Settings2 className="w-3.5 h-3.5" /> Configurer
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => void connect(provider)}>
                    <Link2 className="w-3.5 h-3.5" /> Connecter
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Les événements externes apparaissent dans votre calendrier Kininaru avec leur provenance
        (« Google Calendar »), et ne sont jamais dupliqués (identification par l’ID d’événement
        externe). Pour Apple/iCloud, l’abonnement ICS est la méthode officiellement compatible avec
        une PWA.
        <a
          href={`${SITE_URL}${CALENDAR_PROVIDERS[0].docsUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-primary hover:underline ml-1"
        >
          Guide d’intégration <ExternalLink className="w-3 h-3" />
        </a>
      </p>
    </div>
  )
}
