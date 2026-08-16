'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CalendarConnectionRow, CalendarProvider } from '@/lib/calendar/providers'

export interface ProviderServerConfig {
  configured: boolean
  missing: string[]
}

export type ConnectResult = { ok: true } | { error: string }

/**
 * Shared calendar-connections state (Settings panel AND the Calendar page
 * quick-connect block — one implementation, one behavior).
 *
 * Security model (supabase/calendar-security.sql): the client NEVER reads
 * the calendar_connections table directly. It only calls the server-side
 * RPC `my_calendar_connections()` (safe fields, no tokens), and starting
 * OAuth goes through the API route — which records the current page as
 * `return_to` so the callback brings the user back here.
 */
export function useCalendarConnections() {
  const supabase = createClient()
  const [connections, setConnections] = useState<CalendarConnectionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [serverConfig, setServerConfig] = useState<Record<string, ProviderServerConfig>>({})

  const load = useCallback(async () => {
    try {
      // my_calendar_connections is not part of the generated Database types —
      // narrow local contract, no `any`.
      const rpc = supabase.rpc as unknown as (
        fn: string
      ) => Promise<{ data: unknown[] | null; error: unknown }>
      const { data } = await rpc('my_calendar_connections')
      setConnections((data ?? []) as CalendarConnectionRow[])
    } catch {
      // RPC not deployed yet (SQL not run) — providers shown as unconnected.
      setConnections([])
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Server truth about which providers can actually run OAuth (client id +
  // secret) — never shows a "Connecter" button when the backend cannot start.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/calendar/config')
        if (res.ok) {
          const j = (await res.json()) as {
            providers?: Record<string, ProviderServerConfig>
          }
          if (!cancelled && j.providers) setServerConfig(j.providers)
        }
      } catch {
        // API unreachable — provider states stay unknown; the Connect
        // button will surface the server error honestly on click.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    // Deferred so the initial fetch never calls setState synchronously
    // inside the effect body (react-hooks/set-state-in-effect).
    const t = setTimeout(() => void load(), 0)
    return () => clearTimeout(t)
  }, [load])

  const connect = async (provider: CalendarProvider): Promise<ConnectResult> => {
    if (provider.kind === 'subscription') return { ok: true } // ICS handled inline in Settings
    const cfg = serverConfig[provider.id]
    if (cfg && !cfg.configured) {
      return {
        error: `OAuth ${provider.label} non configuré — ajoutez ${cfg.missing.join(', ')} côté serveur (voir le guide d'intégration).`,
      }
    }
    try {
      // redirect:'manual' lets us read JSON errors (401/503) without leaving
      // the page; a 302 (opaqueredirect) means the flow can start. The
      // current page is recorded server-side so the callback returns here.
      const returnTo = encodeURIComponent(window.location.pathname)
      const endpoint = `/api/calendar/${provider.id}/connect?returnTo=${returnTo}`
      const res = await fetch(endpoint, { redirect: 'manual' })
      if (res.type === 'opaqueredirect') {
        window.location.assign(endpoint)
        return { ok: true }
      }
      const j = (await res.json().catch(() => null)) as { error?: string } | null
      return { error: j?.error ?? 'Connexion impossible' }
    } catch {
      return { error: 'Réseau indisponible — réessayez' }
    }
  }

  return { connections, loading, serverConfig, load, connect }
}
