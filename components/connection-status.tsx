'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { WifiOff, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  countPending,
  flushQueue,
  SYNC_CHANGED_EVENT,
} from '@/lib/offline/sync-queue'

/**
 * Connection status — §21 (Online / Offline / Syncing / Synced / Error).
 *
 * A small, calm pill (never a big aggressive alert). Shows:
 * - offline + pending ops  → "Hors ligne · modifications enregistrées sur cet appareil"
 * - offline, nothing queued → just "Hors ligne"
 * - coming back online     → flushes the queue, shows "Synchronisation…"
 * - flush OK               → "Synchronisé ✓" then fades away
 * - flush failed           → "Certaines modifications n'ont pas encore été synchronisées." + Réessayer
 */

type SyncState = 'idle' | 'syncing' | 'synced' | 'error'

export function ConnectionStatus() {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  )
  const [pending, setPending] = useState(0)
  const [state, setState] = useState<SyncState>('idle')
  const [conflicts, setConflicts] = useState(0)
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabaseRef = useRef(createClient())

  const refreshCount = useCallback(async () => {
    try {
      setPending(await countPending())
    } catch {
      setPending(0)
    }
  }, [])

  const sync = useCallback(async () => {
    setState('syncing')
    try {
      const {
        data: { user },
      } = await supabaseRef.current.auth.getUser()
      if (!user) {
        setState('idle')
        return
      }
      const result = await flushQueue(supabaseRef.current, user.id)
      if (result.failed > 0) {
        setConflicts(result.failed)
        setState('error')
      } else if (result.applied > 0) {
        setState('synced')
        if (fadeTimer.current) clearTimeout(fadeTimer.current)
        fadeTimer.current = setTimeout(() => setState('idle'), 3500)
      } else {
        setState('idle')
      }
    } catch {
      setState('error')
      setConflicts((c) => c + 1)
    }
  }, [])

  useEffect(() => {
    const onOnline = () => {
      setOnline(true)
      // Connection is back — replay everything queued while offline.
      void sync()
    }
    const onOffline = () => setOnline(false)
    const onQueueChange = () => void refreshCount()

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener(SYNC_CHANGED_EVENT, onQueueChange)

    // Mount-time work is deferred so setState never runs synchronously
    // inside the effect body (react-hooks/set-state-in-effect).
    const mountTimer = setTimeout(() => {
      void refreshCount()
      // Flush anything queued when the app opens back online.
      if (navigator.onLine) {
        void (async () => {
          if ((await countPending().catch(() => 0)) > 0) void sync()
        })()
      }
    }, 0)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener(SYNC_CHANGED_EVENT, onQueueChange)
      clearTimeout(mountTimer)
      if (fadeTimer.current) clearTimeout(fadeTimer.current)
    }
  }, [refreshCount, sync])

  const showPill =
    !online || pending > 0 || state === 'syncing' || state === 'error' || state === 'synced'
  if (!showPill) return null

  const isError = state === 'error' || (!online && pending > 0 && conflicts > 0)

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-[calc(0.5rem+env(safe-area-inset-top))] inset-x-0 z-50 flex justify-center pointer-events-none px-4"
    >
      <div
        className={cn(
          'pointer-events-auto flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium shadow-kin backdrop-blur-xl transition-smooth motion-reduce:transition-none',
          isError
            ? 'border-destructive/30 bg-destructive/10 text-destructive'
            : 'border-border bg-card/95 text-foreground'
        )}
      >
        {isError ? (
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        ) : !online ? (
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
        ) : state === 'syncing' ? (
          <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin motion-reduce:animate-none" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-kin-sage" />
        )}

        {!online ? (
          <span>
            {pending > 0
              ? 'Hors ligne · modifications enregistrées sur cet appareil'
              : 'Hors ligne'}
          </span>
        ) : state === 'syncing' ? (
          <span>Synchronisation…</span>
        ) : state === 'error' ? (
          <>
            <span>Certaines modifications n’ont pas encore été synchronisées.</span>
            <button
              onClick={() => void sync()}
              className="ml-1 font-semibold underline underline-offset-2 hover:opacity-80 min-h-6"
            >
              Réessayer
            </button>
          </>
        ) : (
          <span>Synchronisé ✓</span>
        )}
      </div>
    </div>
  )
}
