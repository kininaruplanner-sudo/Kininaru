'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { KinLogoMark } from '@/components/kin-logo'
import { cn } from '@/lib/utils'

/**
 * Messages qui défilent pendant que « le coach » travaille — toujours des
 * étapes réelles de Kininaru (jamais de promesse de résultat).
 */
const MESSAGES = [
  'Lecture de votre journée…',
  'Analyse de vos priorités…',
  'Préparation de votre plan…',
  'Découpage en étapes concrètes…',
]

const DOTS = ['#00C2E0', '#FF6B35', '#6A2B05']

/**
 * AILoadingState — état de chargement « coach IA », adapté à l'identité
 * Kininaru : halo pulsant autour du logo, points dansants aux couleurs de la
 * palette, message qui défile et barre de progression en shimmer.
 *
 * - `prefers-reduced-motion` : tout est figé (logo + premier message, pas de
 *   défilement, pas de pulsation).
 */
export default function AILoadingState({ className }: { className?: string }) {
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (reduced) return
    const id = setInterval(() => setIndex((i) => (i + 1) % MESSAGES.length), 2600)
    return () => clearInterval(id)
  }, [reduced])

  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-6 py-12 sm:py-16', className)}>
      {/* Logo + halo pulsant */}
      <div className="relative mb-7">
        {!reduced && (
          <motion.span
            aria-hidden
            animate={{ scale: [1, 1.35], opacity: [0.35, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
            className="absolute inset-0 rounded-3xl bg-primary/40"
          />
        )}
        <motion.div
          animate={reduced ? undefined : { scale: [1, 1.04, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          className="relative w-16 h-16 rounded-3xl kin-gradient-brand shadow-kin-hover flex items-center justify-center"
        >
          <KinLogoMark className="w-8 h-8 fill-white" />
        </motion.div>
      </div>

      {/* Points dansants — couleurs de la palette */}
      <div className="flex items-center gap-2 mb-5" aria-hidden>
        {DOTS.map((c, i) => (
          <motion.span
            key={c}
            animate={reduced ? undefined : { y: [0, -6, 0], opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.16 }}
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      {/* Message qui défile */}
      <div className="min-h-7 mb-6 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="text-sm sm:text-base text-muted-foreground flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            {MESSAGES[index]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Barre de progression shimmer */}
      <div className="w-56 h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden>
        {reduced ? (
          <div className="h-full w-1/2 rounded-full kin-gradient-brand opacity-70" />
        ) : (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '200%' }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            className="h-full w-1/2 rounded-full kin-gradient-brand"
          />
        )}
      </div>

      <p className="text-[11px] text-muted-foreground/70 mt-4">
        Votre coach travaille sur vos vraies données — rien n&apos;est inventé.
      </p>
    </div>
  )
}
