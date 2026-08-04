'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Sidebar } from '@/components/sidebar'
import { PageTransition } from '@/components/page-transition'
import { CommandPalette } from '@/components/command-palette'
import { Button } from '@/components/ui/button'

interface AppShellProps {
  displayName?: string
  children: React.ReactNode
}

export function AppShell({ displayName, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // Auto-close the mobile drawer whenever navigation happens
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
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
          <span className="font-serif font-bold text-foreground tracking-tight">Kininaru</span>
        </header>

        <main className="flex-1 overflow-auto">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      <CommandPalette />
    </div>
  )
}
