'use client'

import { useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { X } from 'lucide-react'
import { CoachMascot } from '@/components/coach-mascot'
import { AIAssistantClient } from '@/app/(app)/ai/ai-client'
import { useI18n } from '@/lib/i18n'

/**
 * Assistant Kininaru — panneau conversationnel flottant.
 *
 * Ouvert par le bouton flottant (CoachBubble) via l'événement
 * `kininaru:open-assistant`. Réutilise LE VRAI chat existant
 * (AIAssistantClient) : /api/chat, streaming Groq, conversations
 * persistées, mémoire, actions avec confirmation — aucune duplication.
 *
 * - Desktop : drawer fixe à droite (slide + fade, aucun effet excessif).
 * - Mobile : drawer quasi plein écran.
 * - Échap / clic sur le fond / bouton X ferment ; la page /ai reste un
 *   repli pour les liens profonds (briefs hebdo, coach).
 */
export function AssistantPanel({ displayName }: { displayName?: string }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener('kininaru:open-assistant', onOpen)
    return () => window.removeEventListener('kininaru:open-assistant', onOpen)
  }, [])

  // Échap ferme ; le fond de page est verrouillé pendant l'ouverture.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
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
          className="fixed inset-0 z-[85] bg-black/40 backdrop-blur-sm md:bg-black/25"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Assistant Kininaru"
        >
          <motion.div
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: 'tween', duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-y-0 right-0 w-full md:w-[420px] bg-card border-l border-border flex flex-col shadow-kin-hover"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border shrink-0 bg-background/60">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <CoachMascot mood="calm" className="w-5 h-5" />
                </span>
                Kininaru
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                  Assistant
                </span>
              </p>
              <button
                onClick={close}
                className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth"
                aria-label={t('common.close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Le vrai chat — embedded : sans en-tête de page ni sidebar, les
                puces de conversation suffisent dans ce format. */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <AIAssistantClient key={displayName ?? 'assistant'} displayName={displayName ?? 'toi'} embedded />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
