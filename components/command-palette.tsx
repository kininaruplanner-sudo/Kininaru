'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Search,
  LayoutDashboard,
  Calendar,
  CheckSquare,
  Timer,
  Repeat,
  BookOpen,
  Users,
  BarChart3,
  Trophy,
  Sparkles,
  Settings,
  Plus,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  Keyboard,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { KEYBOARD_SHORTCUTS, isTypingTarget } from '@/lib/shortcuts'

interface PaletteItem {
  id: string
  label: string
  hint?: string
  icon: React.ElementType
  group: 'Actions rapides' | 'Navigation' | 'Résultats'
  onSelect: () => void
}

const NAV_ITEMS: { label: string; href: string; icon: React.ElementType }[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Calendrier', href: '/calendar', icon: Calendar },
  { label: 'Tâches', href: '/tasks', icon: CheckSquare },
  { label: 'Focus', href: '/focus', icon: Timer },
  { label: 'Habitudes', href: '/habits', icon: Repeat },
  { label: 'Journal', href: '/journal', icon: BookOpen },
  { label: 'Famille', href: '/family', icon: Users },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Succès', href: '/achievements', icon: Trophy },
  { label: 'Assistant IA', href: '/ai', icon: Sparkles },
  { label: 'Réglages', href: '/settings', icon: Settings },
]

const QUICK_ACTIONS: { label: string; href: string; icon: React.ElementType }[] = [
  { label: 'Nouvelle tâche', href: '/tasks?new=1', icon: Plus },
  { label: 'Nouvel événement', href: '/calendar?new=1', icon: Plus },
  { label: 'Nouvelle habitude', href: '/habits?new=1', icon: Plus },
]

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [results, setResults] = useState<PaletteItem[]>([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const close = useCallback(() => {
    setOpen(false)
    setShowHelp(false)
    setQuery('')
    setResults([])
    setActiveIndex(0)
  }, [])

  // Global shortcuts: Cmd/Ctrl+K toggles the palette, '?' opens the keyboard
  // help (never while typing — writing must stay untouched), Esc closes the
  // help first, then the palette.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return // IME composition (e.g. accents, CJK) — ignore
      if (e.repeat) return // holding a key must not toggle the palette repeatedly
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowHelp(false)
        setOpen((v) => !v)
        return
      }
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target)) {
        e.preventDefault()
        setShowHelp((v) => !v)
        return
      }
      if (e.key === 'Escape') {
        if (showHelp) {
          setShowHelp(false)
        } else {
          close()
        }
      }
    }
    const onExternalOpen = () => {
      setShowHelp(false)
      setOpen(true)
    }
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('kininaru:open-command-palette', onExternalOpen)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('kininaru:open-command-palette', onExternalOpen)
    }
  }, [close, showHelp])

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Live search across tasks / events / habits / journal (RLS scopes results to the current user)
  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    const timeout = setTimeout(async () => {
      const [tasksRes, eventsRes, habitsRes] = await Promise.all([
        supabase.from('tasks').select('id, title').ilike('title', `%${q}%`).limit(4),
        supabase.from('events').select('id, title').ilike('title', `%${q}%`).limit(4),
        supabase.from('habits').select('id, title').ilike('title', `%${q}%`).limit(4),
      ])

      const items: PaletteItem[] = [
        ...(tasksRes.data ?? []).map((t) => ({
          id: `task-${t.id}`,
          label: t.title,
          hint: 'Tâche',
          icon: CheckSquare,
          group: 'Résultats' as const,
          onSelect: () => router.push('/tasks'),
        })),
        ...(eventsRes.data ?? []).map((e) => ({
          id: `event-${e.id}`,
          label: e.title,
          hint: 'Événement',
          icon: Calendar,
          group: 'Résultats' as const,
          onSelect: () => router.push('/calendar'),
        })),
        ...(habitsRes.data ?? []).map((h) => ({
          id: `habit-${h.id}`,
          label: h.title,
          hint: 'Habitude',
          icon: Repeat,
          group: 'Résultats' as const,
          onSelect: () => router.push('/habits'),
        })),
      ]
      setResults(items)
      setSearching(false)
    }, 220)

    return () => clearTimeout(timeout)
  }, [query, open, supabase, router])

  const q = query.trim().toLowerCase()

  const quickActionItems: PaletteItem[] = QUICK_ACTIONS.filter((a) =>
    a.label.toLowerCase().includes(q)
  ).map((a) => ({
    id: `qa-${a.href}`,
    label: a.label,
    icon: a.icon,
    group: 'Actions rapides',
    onSelect: () => router.push(a.href),
  }))

  const navItems: PaletteItem[] = NAV_ITEMS.filter((n) => n.label.toLowerCase().includes(q)).map(
    (n) => ({
      id: `nav-${n.href}`,
      label: n.label,
      hint: 'Aller à',
      icon: n.icon,
      group: 'Navigation',
      onSelect: () => router.push(n.href),
    })
  )

  const allItems = [...quickActionItems, ...navItems, ...results]

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const onKeyDownInput = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, allItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = allItems[activeIndex]
      if (item) {
        item.onSelect()
        close()
      }
    }
  }

  let groupCursor = ''

  return (
    <>
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-start justify-center pt-[12vh] px-4"
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass w-full max-w-xl rounded-3xl border border-border shadow-kin-hover overflow-hidden"
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDownInput}
                placeholder="Rechercher, naviguer, créer..."
                className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
              />
              <kbd className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                Esc
              </kbd>
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-2">
              {allItems.length === 0 && (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  {searching ? 'Recherche...' : 'Aucun résultat'}
                </div>
              )}

              {allItems.map((item, i) => {
                const showGroupLabel = item.group !== groupCursor
                groupCursor = item.group
                return (
                  <div key={item.id}>
                    {showGroupLabel && (
                      <div className="px-3 pt-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {item.group}
                      </div>
                    )}
                    <button
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => {
                        item.onSelect()
                        close()
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-smooth text-left',
                        i === activeIndex
                          ? 'bg-primary/15 text-foreground'
                          : 'text-foreground/90 hover:bg-muted'
                      )}
                    >
                      <item.icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.hint && (
                        <span className="text-xs text-muted-foreground">{item.hint}</span>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center gap-4 px-5 py-3 border-t border-border text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <ArrowUp className="w-3 h-3" />
                <ArrowDown className="w-3 h-3" /> naviguer
              </span>
              <span className="flex items-center gap-1">
                <CornerDownLeft className="w-3 h-3" /> sélectionner
              </span>
              <button
                onClick={() => setShowHelp(true)}
                className="flex items-center gap-1 hover:text-foreground transition-smooth"
              >
                <Keyboard className="w-3 h-3" /> raccourcis
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Keyboard shortcuts help (opened with '?' — never while typing) */}
    <AnimatePresence>
      {showHelp && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] flex items-start justify-center pt-[14vh] px-4"
          onClick={() => setShowHelp(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass w-full max-w-sm rounded-3xl border border-border shadow-kin-hover overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-primary" />
                Raccourcis clavier
              </p>
              <button
                onClick={() => setShowHelp(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ul className="p-3 space-y-1 max-h-[50vh] overflow-y-auto">
              {KEYBOARD_SHORTCUTS.map((s) => (
                <li
                  key={s.keys.join('-')}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-muted transition-smooth"
                >
                  <span className="text-sm text-foreground/90">{s.label}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    {s.keys.map((k) => (
                      <kbd
                        key={k}
                        className="inline-flex items-center justify-center min-w-7 h-7 px-1.5 rounded-lg bg-muted text-xs font-medium text-foreground border border-border"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <div className="px-5 py-3 border-t border-border text-[11px] text-muted-foreground">
              Astuce : <kbd className="inline-flex items-center px-1.5 h-5 rounded-md bg-muted border border-border text-[10px] font-medium">Ctrl</kbd>
              {' + '}
              <kbd className="inline-flex items-center px-1.5 h-5 rounded-md bg-muted border border-border text-[10px] font-medium">K</kbd>{' '}
              ouvre la palette à tout moment.
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  )
}
