'use client'

import { useEffect, useState } from 'react'
import {
  CalendarDays,
  Link2,
  Unlink,
  Clock,
  ExternalLink,
  Settings2,
  Loader2,
  Plus,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cardVariants } from '@/components/ui/card'
import {
  CALENDAR_PROVIDERS,
  type CalendarConnectionRow,
  type CalendarProvider,
} from '@/lib/calendar/providers'
import { SITE_URL } from '@/lib/site-url'
import { useCalendarConnections } from '@/lib/use-calendar-connections'

/**
 * Calendriers connectés — Settings section.
 *
 * Security model (supabase/calendar-security.sql): the client NEVER reads
 * the calendar_connections table directly. It only calls the server-side
 * RPC `my_calendar_connections()` (safe fields, no tokens) and every
 * mutation (connect / sync / disconnect / ICS subscribe) goes through the
 * API routes with the session. Every failure is shown — no dead buttons.
 * State is shared with the Calendar page quick-connect via
 * useCalendarConnections.
 */

export function CalendarConnections() {
  const { connections, loading, serverConfig, connect } = useCalendarConnections()
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [icsUrl, setIcsUrl] = useState('')
  const [icsName, setIcsName] = useState('')
  // Ticking clock for the « il y a X min » labels (pure during render).
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(clock)
  }, [])

  // Feedback from the OAuth callback redirect (?calendar=connected|error).
  // The callback returns to the page where the flow started (return_to),
  // so the query params are cleaned from the CURRENT page — not hardcoded.
  useEffect(() => {
    // Deferred: never call setState synchronously inside an effect body.
    const t = setTimeout(() => {
      const params = new URLSearchParams(window.location.search)
      const status = params.get('calendar')
      if (status === 'connected') {
        setInfo('Calendrier connecté. Lancez une synchronisation pour importer vos événements.')
        setError(null)
        window.history.replaceState({}, '', window.location.pathname)
      } else if (status === 'error') {
        setError(decodeURIComponent(params.get('reason') ?? 'Connexion échouée'))
        setInfo(null)
        window.history.replaceState({}, '', window.location.pathname)
      }
    }, 0)
    return () => clearTimeout(t)
  }, [])

  const connected = (providerId: string) => connections.filter((c) => c.provider === providerId)

  const handleConnect = async (provider: CalendarProvider) => {
    if (provider.kind === 'subscription') return // ICS is handled inline below
    setError(null)
    setInfo(null)
    const res = await connect(provider)
    if ('error' in res) setError(res.error)
  }

  const subscribeIcs = async () => {
    const url = icsUrl.trim()
    if (!url) {
      setError('URL ICS requise')
      return
    }
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch('/api/calendar/ics/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, name: icsName.trim() || undefined }),
      })
      const j = (await res.json().catch(() => null)) as { error?: string; events?: number } | null
      if (!res.ok) {
        setError(j?.error ?? "Abonnement impossible")
        return
      }
      setIcsUrl('')
      setIcsName('')
      setInfo(`Flux ICS enregistré (${j?.events ?? 0} événements détectés).`)
    } catch {
      setError('Réseau indisponible — réessayez')
    } finally {
      setBusy(false)
    }
  }

  const syncNow = async (conn: CalendarConnectionRow) => {
    setSyncingId(conn.id)
    setError(null)
    try {
      const res = await fetch(`/api/calendar/${conn.provider}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: conn.id }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null
        setError(j?.error ?? 'Synchronisation impossible')
      }
    } catch {
      setError('Réseau indisponible — réessayez')
    } finally {
      setSyncingId(null)
    }
  }

  const disconnect = async (conn: CalendarConnectionRow) => {
    if (
      !window.confirm(
        'Déconnecter ce calendrier ? Les événements importés seront supprimés de Kininaru.'
      )
    )
      return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/calendar/${conn.provider}/disconnect`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: conn.id }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null
        setError(j?.error ?? 'Déconnexion impossible')
        return
      }
      setInfo('Calendrier déconnecté.')
    } catch {
      setError('Réseau indisponible — réessayez')
    } finally {
      setBusy(false)
    }
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

      {(error || info) && (
        <div
          className={cn(
            'flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm',
            error
              ? 'bg-destructive/10 text-destructive'
              : 'bg-kin-sage/10 text-kin-forest'
          )}
          role={error ? 'alert' : 'status'}
        >
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="leading-snug">{error ?? info}</p>
        </div>
      )}

      <div className="space-y-3">
        {CALENDAR_PROVIDERS.map((provider) => {
          const conns = connected(provider.id)
          const conn = conns[0]
          return (
            <div
              key={provider.id}
              className="flex flex-col gap-3 p-3.5 rounded-xl border border-border bg-card"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{provider.label}</p>
                    {conn ? (
                      <span className="flex items-center gap-1 text-xs text-kin-sage font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-kin-sage" /> Connecté
                      </span>
                    ) : provider.kind === 'oauth' &&
                      serverConfig[provider.id] &&
                      !serverConfig[provider.id].configured ? (
                      <span className="text-xs text-muted-foreground">Non configuré</span>
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
                      {conn.sync_error && (
                        <span className="text-destructive">{conn.sync_error}</span>
                      )}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {conn ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={syncingId === conn.id || busy}
                        onClick={() => void syncNow(conn)}
                      >
                        {syncingId === conn.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                        {syncingId === conn.id ? '…' : 'Synchroniser'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => void disconnect(conn)}
                        aria-label={`Déconnecter ${provider.label}`}
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        Déconnecter
                      </Button>
                    </>
                  ) : provider.kind === 'oauth' ? (
                    <Button variant="outline" size="sm" onClick={() => void handleConnect(provider)}>
                      {serverConfig[provider.id]?.configured ? (
                        <>
                          <Link2 className="w-3.5 h-3.5" /> Connecter
                        </>
                      ) : (
                        <>
                          <Settings2 className="w-3.5 h-3.5" /> Configurer
                        </>
                      )}
                    </Button>
                  ) : null}
                </div>
              </div>

              {provider.kind === 'subscription' && !conn && (
                <form
                  className="flex flex-col sm:flex-row gap-2 border-t border-border pt-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void subscribeIcs()
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <Label htmlFor={`ics-url-${provider.id}`} className="sr-only">
                      URL du flux ICS
                    </Label>
                    <Input
                      id={`ics-url-${provider.id}`}
                      type="url"
                      placeholder="https://…/calendar.ics (calendrier iCloud public, etc.)"
                      value={icsUrl}
                      onChange={(e) => setIcsUrl(e.target.value)}
                      autoComplete="url"
                    />
                  </div>
                  <div className="sm:w-44">
                    <Label htmlFor={`ics-name-${provider.id}`} className="sr-only">
                      Nom de l’abonnement
                    </Label>
                    <Input
                      id={`ics-name-${provider.id}`}
                      placeholder="Nom (optionnel)"
                      value={icsName}
                      onChange={(e) => setIcsName(e.target.value)}
                    />
                  </div>
                  <Button type="submit" size="sm" disabled={busy}>
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    S’abonner
                  </Button>
                </form>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Les événements externes apparaissent dans votre calendrier Kininaru avec leur provenance
        (« Google Calendar »), et ne sont jamais dupliqués (identification par l’ID d’événement
        externe). Pour Apple/iCloud, l’abonnement ICS est la méthode officiellement compatible avec
        une PWA — collez l’URL publique de votre calendrier ci-dessus.
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
