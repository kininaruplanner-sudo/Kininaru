'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { PageTransition } from '@/components/page-transition'
import { CommandPalette } from '@/components/command-palette'
import { CoachBubble } from '@/components/coach/coach-bubble'
import { MobileNav } from '@/components/mobile-nav'
import { ConnectionStatus } from '@/components/connection-status'
import { useReminderScheduler } from '@/lib/coach/scheduler'
import { KinLogo } from '@/components/kin-logo'
import { Button } from '@/components/ui/button'
import { BetaBadge } from '@/components/beta-badge'
import { BetaNotice } from '@/components/beta-notice'

interface AppShellProps {
  displayName?: string
  children: React.ReactNode
}

export function AppShell({ displayName, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // Rappels temporels (PLAN → REMIND) : actifs tant que l'app est ouverte.
  // Même anti-spam que le coach (heures silencieuses, fréquence, pause) ;
  // quand l'app est fermée, le cron serveur /api/cron/reminders prend le relais
  // via Web Push pour les appareils abonnés.
  useReminderScheduler(true)

  // Auto-close the mobile drawer whenever navigation happens
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Connection pill (hors ligne / synchronisation) — app-wide, calm. */}
      <ConnectionStatus />
      <Sidebar
        displayName={displayName}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile-only top bar: the sidebar is off-screen below lg, so this is
            what gives small screens a persistent, fixed "header" with access
            to navigation. Hidden entirely on desktop to avoid a redundant
            second header stacked above each page's own title bar. */}
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

        {/* Bottom padding clears the fixed mobile nav bar (incl. the AI
            composer and the end of every page) without affecting desktop. */}
        <main className="flex-1 overflow-auto pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      <CommandPalette />
      {/* Bottom tab bar on phones — hidden while the drawer is open so the
          two navigations never stack. */}
      {!mobileOpen && <MobileNav />}
      <CoachBubble />
    </div>
  )
}
