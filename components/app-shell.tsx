'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, PhoneOff } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { PageTransition } from '@/components/page-transition'
import { CommandPalette } from '@/components/command-palette'
import { SettingsModal } from '@/components/settings-modal'
import { AssistantPanel } from '@/components/assistant-panel'
import { CoachBubble } from '@/components/coach/coach-bubble'
import { MobileNav } from '@/components/mobile-nav'
import { ConnectionStatus } from '@/components/connection-status'
import { useReminderScheduler } from '@/lib/coach/scheduler'
import { KinLogo } from '@/components/kin-logo'
import { Button } from '@/components/ui/button'
import { BetaBadge } from '@/components/beta-badge'
import { BetaNotice } from '@/components/beta-notice'
import { useAiSidePanel } from '@/lib/ai-side-panel-context'
import { AIAssistantClient } from '@/app/(app)/ai/ai-client'
import { cn } from '@/lib/utils'

interface AppShellProps {
  displayName?: string
  children: React.ReactNode
}

export function AppShell({ displayName, children }: AppShellProps) {
  return <AppShellInner displayName={displayName}>{children}</AppShellInner>
}

/**
 * Context object shared between the hidden (voice-keep-alive) AIAssistantClient
 * and the call indicator bar. We use a thin wrapper around the voice state so
 * the indicator can call endCall even when the /ai page is not active.
 */
const VOICE_STATE_EVENT = 'kininaru:voice-state'

interface VoiceStateSnapshot {
  callActive: boolean
  callStatus: string
  callError: string | null
  interim: string
  muted: boolean
  callSeconds: number
  speechSupported: boolean
  startCall: () => void
  endCall: () => void
  toggleMute: () => void
}

// Module-level mutable reference: the hidden AIAssistantClient writes its
// voice state here, and the indicator bar reads it.  Because both are
// rendered by AppShellInner (same tree), React batching keeps them in sync.
let _voiceState: VoiceStateSnapshot | null = null
let _voiceListeners: Set<() => void> = new Set()

function notifyVoiceListeners() {
  _voiceListeners.forEach((l) => l())
}

export function useVoiceIndicator() {
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    const handler = () => forceUpdate((n) => n + 1)
    _voiceListeners.add(handler)
    return () => { _voiceListeners.delete(handler) }
  }, [])

  return _voiceState
}

function AppShellInner({ displayName, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  const sidePanel = useAiSidePanel()

  // Rappels temporels (PLAN → REMIND) : actifs tant que l'app est ouverte.
  useReminderScheduler(true)

  // Auto-close the mobile drawer whenever navigation happens
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const voiceState = useVoiceIndicator()

  return (
    <div className="kin-surface-tint flex h-screen overflow-hidden">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg">
        Aller au contenu principal
      </a>
      {/* Connection pill (hors ligne / synchronisation) */}
      <ConnectionStatus />
      <Sidebar
        displayName={displayName}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile-only top bar */}
        <header className="lg:hidden shrink-0 h-14 flex items-center gap-2 px-3 border-b border-border bg-card/95 backdrop-blur-sm sticky top-0 z-20">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <KinLogo variant="row" markClassName="w-6 h-6" wordmarkClassName="text-sm" />
          <BetaBadge className="ml-1" />
        </header>

        <BetaNotice />

        {/* Persistent voice call indicator — visible on ALL pages when call is active */}
        {voiceState?.callActive && (
          <div className="shrink-0 flex items-center gap-3 px-4 py-2 bg-primary/5 border-b border-primary/20 text-sm">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
            </span>
            <span className="flex-1 text-foreground font-medium truncate">
              Appel IA en cours — {voiceState.callStatus === 'listening' ? "À l'écoute" : voiceState.callStatus === 'speaking' ? 'Le coach répond…' : 'Connexion…'}
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={voiceState.endCall}
              className="gap-1.5 shrink-0 h-7"
            >
              <PhoneOff className="w-3 h-3" />
              Arrêter
            </Button>
          </div>
        )}

        {/* Main content */}
        <main id="main-content" className="flex-1 overflow-auto pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      {/* AI side panel — inline on /ai instead of floating overlay */}
      {sidePanel.active && (
        <div className="hidden lg:flex flex-col w-[420px] shrink-0 border-l border-border bg-card overflow-hidden">
          <AIAssistantClient displayName={displayName ?? 'toi'} embedded />
        </div>
      )}

      {/* Hidden AIAssistantClient — keeps the voice call alive across route changes.
          It's always mounted, never visible, and its voice state is exposed to the
          indicator bar via the module-level _voiceState ref.  The voice call ONLY
          starts when the user explicitly clicks "Start" on /ai, so this hidden
          instance does NOT auto-start anything. */}
      <div className="sr-only" aria-hidden="true" style={{ position: 'fixed', pointerEvents: 'none', width: 0, height: 0, overflow: 'hidden' }}>
        <AIAssistantClient
          displayName={displayName ?? 'toi'}
          onVoiceStateChange={(vs) => { _voiceState = vs; notifyVoiceListeners() }}
        />
      </div>

      <CommandPalette />
      <SettingsModal />
      {!sidePanel.active && <AssistantPanel displayName={displayName} />}
      {!mobileOpen && <MobileNav />}
      <CoachBubble />
    </div>
  )
}
