'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'
import Link from 'next/link'

/**
 * Message bêta — bandeau fin et fermable, affiché une seule fois par
 * navigateur (persistance localStorage). Une fois fermé, il ne réapparaît
 * plus à chaque navigation. Lien discret vers les retours (Réglages).
 */

const STORAGE_KEY = 'kininaru-beta-notice-dismissed'

const BETA_MESSAGE =
  'Kininaru est actuellement en version bêta. Certaines fonctionnalités peuvent encore être améliorées. Vos retours nous aident à rendre l’expérience meilleure.'

export function BetaNotice() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(STORAGE_KEY) !== '1')
    } catch {
      setVisible(true) // stockage indisponible : on l'affiche quand même
    }
  }, [])

  const dismiss = () => {
    setVisible(false)
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* noop */
    }
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden shrink-0"
        >
          <div className="flex items-center gap-2.5 px-3 sm:px-5 py-2 bg-primary/[0.06] border-b border-primary/15 text-xs text-foreground/85">
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden />
            <p className="flex-1 min-w-0 leading-relaxed">
              {BETA_MESSAGE}{' '}
              <Link
                href="/settings"
                className="text-primary font-medium hover:underline underline-offset-2 transition-smooth"
              >
                Donner mon avis
              </Link>
            </p>
            <button
              onClick={dismiss}
              aria-label="Fermer le message bêta"
              className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-smooth"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
