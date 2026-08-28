'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CheckSquare, Timer, BookOpen, Sparkles } from 'lucide-react'
import { CoachMascot } from '@/components/coach-mascot'
import { cn } from '@/lib/utils'

/**
 * Mobile bottom navigation (Phase 1 — Android/TWA).
 *
 * The five primary destinations (Accueil / Tâches / Focus / Journal / Coach)
 * get a thumb-friendly bottom bar on phones, while the sidebar drawer keeps
 * the secondary sections (calendrier, habitudes, famille…). The Coach tab
 * opens the floating conversational assistant instead of a page.
 * Hidden on desktop (≥ lg) where the sidebar is visible.
 */
const TABS = [
  { kind: 'link', href: '/dashboard', label: 'Accueil', icon: Home },
  { kind: 'link', href: '/tasks', label: 'Tâches', icon: CheckSquare },
  { kind: 'link', href: '/focus', label: 'Focus', icon: Timer },
  { kind: 'link', href: '/journal', label: 'Journal', icon: BookOpen },
  { kind: 'link', href: '/ai', label: 'IA', icon: Sparkles },
  { kind: 'assistant', label: 'Coach', icon: CoachMascot },
] as const

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navigation principale mobile"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-stretch">
        {TABS.map((tab) => {
          const Icon = tab.icon
          if (tab.kind === 'assistant') {
            return (
              <button
                key="assistant"
                onClick={() => window.dispatchEvent(new Event('kininaru:open-assistant'))}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 min-h-14 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-smooth"
                aria-label="Ouvrir l'assistant"
              >
                <Icon className="w-4.5 h-4.5" />
                {tab.label}
              </button>
            )
          }
          const href = tab.href
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 min-h-14 py-1.5 text-[10px] font-medium transition-smooth',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              <Icon className="w-4.5 h-4.5" strokeWidth={active ? 2.4 : 2} />
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
