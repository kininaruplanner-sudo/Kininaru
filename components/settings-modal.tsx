'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Settings, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SettingsClient } from '@/app/(app)/settings/settings-client'
import { useI18n } from '@/lib/i18n'

interface Memory {
  id: string
  content: string
  category: string
  created_at: string
}

interface SettingsData {
  profile: { id: string; display_name?: string | null } | null
  email: string
  userId: string
  memories: Memory[]
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Paramètres — fenêtre flottante (remplace la page comme expérience
 * principale). Ouverte via l'événement `kininaru:open-settings` (engrenage
 * de la sidebar, palette de commandes, coach…).
 *
 * - centrée, fond assombri + flou ;
 * - fermable avec Échap ou en cliquant à l'extérieur ;
 * - focus envoyé dans la fenêtre, piégé pendant l'ouverture (clavier) ;
 * - scroll interne ; plein écran sur mobile ;
 * - la route /settings reste un repli fonctionnel (liens profonds).
 */
export function SettingsModal() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<SettingsData | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  const close = useCallback(() => {
    setOpen(false)
    setData(null)
  }, [])

  // Open on demand (event fired by the sidebar gear, palette, coach…).
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener('kininaru:open-settings', onOpen)
    return () => window.removeEventListener('kininaru:open-settings', onOpen)
  }, [])

  // Load the same data as the /settings page (client-side) each time the
  // window opens, so the profile/memory sections are always fresh.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const supabase = createClient()
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const [profileRes, memRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name').eq('id', user.id).maybeSingle(),
        supabase
          .from('ai_memories')
          .select('id, content, category, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ])
      if (cancelled) return
      setData({
        profile: (profileRes.data as { id: string; display_name?: string | null } | null) ?? null,
        email: user.email ?? '',
        userId: user.id,
        memories: (memRes.data ?? []) as Memory[],
      })
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  // Focus management: remember what had focus, move it into the panel,
  // trap Tab inside, restore focus on close. Escape closes.
  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement as HTMLElement | null
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel) return
      const first = panel.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? panel).focus()
    })

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // La navigation interne (Paramètres → catégorie) peut intercepter
        // Échap pour revenir d'abord à la liste des catégories.
        const ev = new CustomEvent('kininaru:settings-escape', { cancelable: true })
        const handled = !window.dispatchEvent(ev)
        if (!handled) {
          e.preventDefault()
          close()
        }
        return
      }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    // Lock the page scroll behind the window (harmless — the app shell
    // already scrolls internally, this keeps the backdrop stable).
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      previouslyFocused.current?.focus?.()
      previouslyFocused.current = null
    }
  }, [open, close])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-6"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={t('settings.title')}
        >
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            tabIndex={-1}
            className="w-full h-full sm:h-[min(86vh,760px)] sm:w-[min(94vw,880px)] sm:rounded-3xl bg-card border border-border sm:shadow-kin-hover flex flex-col overflow-hidden outline-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                {t('settings.title')}
              </p>
              <button
                onClick={close}
                className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth"
                aria-label={t('common.close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content — the shared SettingsClient (embedded: no page header) */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {data ? (
                <SettingsClient
                  key={data.userId}
                  profile={data.profile}
                  user={{ email: data.email }}
                  userId={data.userId}
                  memories={data.memories}
                  embedded
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
