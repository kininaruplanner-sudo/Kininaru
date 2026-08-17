'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, X } from 'lucide-react'
import { useAppInstall } from '@/lib/use-app-install'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

const DISMISS_KEY = 'kininaru-install-dismissed'

/**
 * Smart install banner — shows only when a real install is available.
 *
 * Rules:
 * - Never shows once the app is installed / running standalone.
 * - Never shows if the user dismissed it (remembered in localStorage).
 * - Appears after a short delay so it never interrupts the first seconds.
 * - Respects prefers-reduced-motion via MotionConfig (landing) + framer.
 */
export function InstallBanner() {
  const { canInstall, installed, install } = useAppInstall()
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!canInstall || installed || dismissed) return
    if (typeof window !== 'undefined' && window.localStorage.getItem(DISMISS_KEY)) return
    const timer = setTimeout(() => setVisible(true), 1800)
    return () => clearTimeout(timer)
  }, [canInstall, installed, dismissed])

  // `dismissed` fait partie de la garde : sans lui, la croix mettait bien
  // l'état à true mais la bannière restait affichée (le clic semblait mort).
  if (!visible || dismissed || !canInstall || installed) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // localStorage can throw in private mode — the in-memory dismissal is enough.
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="fixed bottom-4 inset-x-4 z-[70] mx-auto max-w-md"
        role="region"
        aria-label={t('install.bannerTitle')}
      >
        <div className="rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-kin p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground leading-snug">
                {t('install.bannerTitle')}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {t('install.bannerDesc')}
              </p>
            </div>
            <button
              onClick={dismiss}
              aria-label={t('install.dismiss')}
              className="shrink-0 min-w-11 min-h-11 sm:min-w-8 sm:min-h-8 size-11 sm:size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <Button
            onClick={() => void install()}
            size="lg"
            className="mt-3 h-12 sm:h-11 gap-2 w-full"
          >
            <Download className="w-4 h-4" />
            {t('settings.installButton')}
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
