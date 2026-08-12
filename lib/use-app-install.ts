'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Shared PWA install state (singleton, module-scoped).
 *
 * Several surfaces show an install affordance (sidebar, settings, dashboard,
 * landing banner). `beforeinstallprompt` fires once per page load and
 * `prompt()` must be called only once, so all consumers share a single state
 * through `useSyncExternalStore` instead of each listening independently.
 */

export type DevicePlatform = 'mobile' | 'tablet' | 'desktop'

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

interface InstallState {
  /** Captured `beforeinstallprompt` event — null when not installable yet. */
  deferredPrompt: BeforeInstallPromptEvent | null
  /** True once the app is installed (or already running standalone). */
  installed: boolean
  platform: DevicePlatform
}

let state: InstallState = {
  deferredPrompt: null,
  installed: false,
  platform: 'desktop',
}

// Server render is always "not installed, nothing available".
const SERVER_SNAPSHOT: InstallState = { ...state }

const listeners = new Set<() => void>()
let initialized = false

function emit() {
  for (const listener of listeners) listener()
}

function detectPlatform(): DevicePlatform {
  if (typeof window === 'undefined') return 'desktop'
  const ua = navigator.userAgent
  const hasTouch = navigator.maxTouchPoints > 0
  // iPadOS reports as Mac — large touch screen + touch events → tablet.
  if (/iPad|Tablet|PlayBook|Silk/.test(ua)) return 'tablet'
  if (/Macintosh/.test(ua) && hasTouch && 'ontouchend' in document) return 'tablet'
  if (/Android/.test(ua) && hasTouch) return 'tablet'
  if (/iPhone|iPod|Mobile/.test(ua) && hasTouch) return 'mobile'
  return 'desktop'
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // iOS Safari home-screen web apps.
  return (navigator as unknown as { standalone?: boolean }).standalone === true
}

function init() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  state = { ...state, platform: detectPlatform(), installed: detectStandalone() }
  emit()

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    state = { ...state, deferredPrompt: e as BeforeInstallPromptEvent }
    emit()
  })

  window.addEventListener('appinstalled', () => {
    state = { ...state, deferredPrompt: null, installed: true }
    emit()
  })
}

export function useAppInstall() {
  // Idempotent — only the first call wires the window listeners.
  init()

  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }, [])

  const snapshot = useSyncExternalStore(subscribe, () => state, () => SERVER_SNAPSHOT)

  const install = useCallback(async () => {
    const promptEvent = state.deferredPrompt
    if (!promptEvent) return
    try {
      await promptEvent.prompt()
      await promptEvent.userChoice
    } catch (err) {
      console.error('[Kininaru] Install prompt failed:', err)
    } finally {
      state = { ...state, deferredPrompt: null }
      emit()
    }
  }, [])

  return {
    canInstall: snapshot.deferredPrompt !== null,
    installed: snapshot.installed,
    platform: snapshot.platform,
    install,
  }
}
