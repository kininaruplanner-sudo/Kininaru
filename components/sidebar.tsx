'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { LogoMark } from '@/components/landing/logo-mark'
import {
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  Timer,
  Repeat2,
  BookOpen,
  BarChart3,
  Sparkles,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Users,
  Trophy,
  Search,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/theme-toggle'
import { resetAnalytics } from '@/lib/analytics'

const navItems = [
  { href: '/dashboard', label: 'Aperçu', icon: LayoutDashboard },
  { href: '/calendar', label: 'Calendrier', icon: CalendarDays },
  { href: '/tasks', label: 'Tâches', icon: CheckSquare },
  { href: '/focus', label: 'Focus', icon: Timer },
  { href: '/habits', label: 'Habitudes', icon: Repeat2 },
  { href: '/journal', label: 'Journal', icon: BookOpen },
  { href: '/family', label: 'Famille', icon: Users },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/achievements', label: 'Succès', icon: Trophy },
  { href: '/ai', label: 'Assistant IA', icon: Sparkles },
]

interface SidebarProps {
  displayName?: string
  collapsed: boolean
  onToggleCollapsed: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({
  displayName,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    resetAnalytics()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden"
            onClick={onMobileClose}
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          // Mobile: fixed off-canvas drawer, full label width, slides in/out.
          'fixed inset-y-0 left-0 z-40 flex flex-col bg-card border-r border-border shrink-0',
          'w-[260px] transition-transform duration-300 ease-in-out',
          'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: back to normal flow, always visible, width reacts to collapse.
          'lg:static lg:z-10 lg:translate-x-0 lg:transition-[width] lg:duration-300 lg:pt-0 lg:pb-0 lg:pl-0',
          collapsed ? 'lg:w-[68px]' : 'lg:w-[220px]'
        )}
      >
        {/* Logo */}
        <div className={cn(
          'flex items-center h-16 border-b border-border px-4 shrink-0',
          collapsed ? 'lg:justify-center' : 'justify-between'
        )}>
          <span className={cn(collapsed && 'lg:hidden')}>
            <LogoMark />
          </span>
          <span className={cn('hidden', collapsed && 'lg:inline')}>
            <LogoMark iconOnly />
          </span>

          {/* Desktop collapse toggle */}
          <button
            onClick={onToggleCollapsed}
            className={cn(
              'hidden lg:flex p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth',
              collapsed && 'lg:mx-auto'
            )}
            aria-label={collapsed ? 'Déplier le menu' : 'Réduire le menu'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {/* Mobile close button */}
          <button
            onClick={onMobileClose}
            className="lg:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth"
            aria-label="Fermer le menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search / Command Palette trigger */}
        <div className="px-2 pt-3 shrink-0">
          <button
            onClick={() => window.dispatchEvent(new Event('kininaru:open-command-palette'))}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-muted-foreground bg-muted/60 hover:bg-muted transition-smooth border border-border/60',
              collapsed && 'lg:justify-center lg:px-2'
            )}
            title="Rechercher (⌘K)"
          >
            <Search className="w-4 h-4 shrink-0" />
            <span className={cn('flex-1 text-left', collapsed && 'lg:hidden')}>Rechercher...</span>
            <kbd className={cn('text-[10px] px-1.5 py-0.5 rounded-md bg-card border border-border', collapsed && 'lg:hidden')}>
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-0.5 px-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-smooth group',
                  active
                    ? 'text-foreground [&_svg]:text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted hover:translate-x-0.5',
                  collapsed && 'lg:justify-center lg:px-2'
                )}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active-pill"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    className="absolute inset-0 rounded-xl bg-primary/15"
                  />
                )}
                <Icon className={cn('relative shrink-0 transition-smooth', collapsed ? 'lg:w-5 lg:h-5 w-4 h-4' : 'w-4 h-4', active && 'scale-105')} />
                <span className={cn('relative truncate', collapsed && 'lg:hidden')}>{label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-2 space-y-0.5 shrink-0">
          <ThemeToggle collapsed={collapsed} />

          <Link
            href="/settings"
            title={collapsed ? 'Réglages' : undefined}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted hover:translate-x-0.5 transition-smooth',
              collapsed && 'lg:justify-center lg:px-2'
            )}
          >
            <Settings className={cn('shrink-0', collapsed ? 'lg:w-5 lg:h-5 w-4 h-4' : 'w-4 h-4')} />
            <span className={cn(collapsed && 'lg:hidden')}>Réglages</span>
          </Link>

          <button
            onClick={handleLogout}
            title={collapsed ? 'Se déconnecter' : undefined}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:translate-x-0.5 transition-smooth',
              collapsed && 'lg:justify-center lg:px-2'
            )}
          >
            <LogOut className={cn('shrink-0', collapsed ? 'lg:w-5 lg:h-5 w-4 h-4' : 'w-4 h-4')} />
            <span className={cn(collapsed && 'lg:hidden')}>Se déconnecter</span>
          </button>

          {displayName && (
            <div className={cn('mt-2 px-3 py-2', collapsed && 'lg:hidden')}>
              <p className="text-xs text-muted-foreground truncate">{displayName}</p>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
