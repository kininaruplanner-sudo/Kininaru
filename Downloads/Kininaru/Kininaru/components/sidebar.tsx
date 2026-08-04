'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
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
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/focus', label: 'Focus', icon: Timer },
  { href: '/habits', label: 'Habits', icon: Repeat2 },
  { href: '/journal', label: 'Journal', icon: BookOpen },
  { href: '/family', label: 'Family', icon: Users },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/achievements', label: 'Achievements', icon: Trophy },
  { href: '/ai', label: 'AI Assistant', icon: Sparkles },
]

interface SidebarProps {
  displayName?: string
}

export function Sidebar({ displayName }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-card border-r border-border transition-all duration-300 ease-in-out shrink-0 relative z-10',
        collapsed ? 'w-[68px]' : 'w-[220px]'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center h-16 border-b border-border px-4 transition-all duration-300',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        {!collapsed && (
          <span className="font-serif font-bold text-lg text-foreground tracking-tight">
            Kininaru
          </span>
        )}
        {collapsed && (
          <span className="font-serif font-bold text-xl text-kin-rose-dark">K</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth',
            collapsed && 'mx-auto'
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
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
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-smooth group',
                active
                  ? 'bg-primary/15 text-foreground [&_svg]:text-kin-rose-dark'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                collapsed && 'justify-center px-2'
              )}
            >
              <Icon className={cn('shrink-0', collapsed ? 'w-5 h-5' : 'w-4 h-4')} />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-2 space-y-0.5">
        <Link
          href="/settings"
          title={collapsed ? 'Settings' : undefined}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth',
            collapsed && 'justify-center px-2'
          )}
        >
          <Settings className={cn('shrink-0', collapsed ? 'w-5 h-5' : 'w-4 h-4')} />
          {!collapsed && <span>Settings</span>}
        </Link>

        <button
          onClick={handleLogout}
          title={collapsed ? 'Sign out' : undefined}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-smooth',
            collapsed && 'justify-center px-2'
          )}
        >
          <LogOut className={cn('shrink-0', collapsed ? 'w-5 h-5' : 'w-4 h-4')} />
          {!collapsed && <span>Sign out</span>}
        </button>

        {!collapsed && displayName && (
          <div className="mt-2 px-3 py-2">
            <p className="text-xs text-muted-foreground truncate">{displayName}</p>
          </div>
        )}
      </div>
    </aside>
  )
}
