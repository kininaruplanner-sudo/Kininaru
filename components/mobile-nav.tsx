'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CheckSquare, Timer, BookOpen, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Mobile bottom navigation (Phase 1 — Android/TWA).
 *
 * The five primary destinations (Accueil / Tâches / Focus / Journal / Coach)
 * get a thumb-friendly bottom bar on phones, while the sidebar drawer keeps
 * the secondary sections (calendrier, habitudes, famille, analytics…).
 * Hidden on desktop (≥ lg) where the sidebar is visible.
 */
const TABS = [
  { href: '/dashboard', label: 'Accueil', icon: Home },
  { href: '/tasks', label: 'Tâches', icon: CheckSquare },
  { href: '/focus', label: 'Focus', icon: Timer },
  { href: '/journal', label: 'Journal', icon: BookOpen },
  { href: '/ai', label: 'Coach', icon: Sparkles },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navigation principale mobile"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-stretch">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 min-h-16 py-2 text-[10px] font-medium transition-smooth',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
