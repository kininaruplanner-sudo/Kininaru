'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, Link2, Settings2, Loader2, CheckCircle2, Info, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CALENDAR_PROVIDERS, type CalendarConnectionRow } from '@/lib/calendar/providers'
import { useCalendarConnections } from '@/lib/use-calendar-connections'

/**
 * Calendriers externes — quick-connect on the Calendar page.
 *
 * Sits ABOVE the keyboard-shortcuts block (connections are more important
 * than shortcuts). Same security model and shared state as the Settings
 * panel (useCalendarConnections): RPC safe-fields only, server config
 * truth, OAuth started via the API route with return_to = this page.
 * Every failure is shown — no dead buttons.
 */
export function CalendarQuickConnect() {
  const { connections, loading, serverConfig, connect } = useCalendarConnections()
  const [error, setError] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)

  const openSettings = () => window.dispatchEvent(new Event('kininaru:open-settings'))

  // Nettoie les paramètres laissés par le callback OAuth (?calendar=…) quand
  // le flux s'est terminé sur cette page.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('calendar')) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handleConnect = async (providerId: string) => {
    setError(null)
    const provider = CALENDAR_PROVIDERS.find((p) => p.id === providerId)
    if (!provider || provider.kind !== 'oauth') return
    const res = await connect(provider)
    if ('error' in res) setError(res.error)
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

  const connectedFor = (providerId: string) =>
    connections.filter((c) => c.provider === providerId)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          Calendriers
        </p>
        <button
          onClick={openSettings}
          className="text-xs font-medium text-primary hover:underline transition-smooth"
        >
          Gérer
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-destructive/10 text-destructive px-3 py-2.5 text-xs leading-snug"
        >
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          <div className="h-9 rounded-lg bg-muted/70 animate-pulse" />
          <div className="h-9 rounded-lg bg-muted/70 animate-pulse" />
        </div>
      ) : (
        <div className="space-y-2">
          {CALENDAR_PROVIDERS.filter((p) => p.kind === 'oauth').map((provider) => {
            const conn = connectedFor(provider.id)[0]
            const configured = serverConfig[provider.id]?.configured
            return (
              <div
                key={provider.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{provider.label}</p>
                  {conn && (
                    <span className="flex items-center gap-1 text-[11px] text-kin-sage font-medium shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      Connecté
                    </span>
                  )}
                </div>
                {conn ? (
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={syncingId === conn.id}
                    onClick={() => void syncNow(conn)}
                  >
                    {syncingId === conn.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <ExternalLink className="w-3 h-3" />
                    )}
                    Synchroniser
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => void handleConnect(provider.id)}
                    className={cn(!configured && 'opacity-70')}
                  >
                    {configured ? <Link2 className="w-3 h-3" /> : <Settings2 className="w-3 h-3" />}
                    {configured ? `Connecter ${provider.label}` : 'Configurer'}
                  </Button>
                )}
              </div>
            )
          })}

          {/* ICS / iCloud subscription — form lives in Settings. */}
          <button
            onClick={openSettings}
            className="w-full flex items-center justify-between gap-2 rounded-xl border border-dashed border-border bg-card/60 px-3 py-2.5 text-left hover:border-primary/40 transition-smooth"
          >
            <span className="text-sm font-medium text-foreground">iCloud / ICS</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Settings2 className="w-3 h-3" /> Configurer
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
