'use client'

import { useEffect } from 'react'

/**
 * Registers the Kininaru service worker.
 *
 * Production only: in development the dev server manages its own assets and a
 * service worker would interfere with HMR, so registration is skipped there.
 * Registration is best-effort — it must never break the app, so all failures
 * are caught and logged.
 */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    async function register() {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })

        // When a new SW is found while this page is already controlled,
        // ask it to take over so updates apply as soon as possible
        // (no stale version lingering until the next visit).
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          if (!worker) return
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })
      } catch (err) {
        console.error('[Kininaru] Service worker registration failed:', err)
      }
    }

    void register()
  }, [])

  return null
}
