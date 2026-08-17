'use client'

import { Download, MonitorSmartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppInstall } from '@/lib/use-app-install'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

interface InstallAppButtonProps {
  /**
   * 'card' renders the full install card (icon + title + description + CTA)
   * and falls back to a small honest per-browser hint when no install prompt
   * is available. 'button' stays compact and renders nothing when the
   * browser cannot install the PWA (nav/sidebar stay clean).
   */
  variant?: 'card' | 'button'
  className?: string
  buttonClassName?: string
}

/**
 * “📲 Installer Kininaru” — the single reusable install affordance.
 *
 * - Shows the button only when a real `beforeinstallprompt` is available.
 * - Hides itself once the app is installed or running standalone.
 * - Card variant falls back to a short per-browser hint instead of a dead
 *   button; button variant renders nothing.
 *
 * All surfaces (landing, sidebar, settings, dashboard) share one install
 * state through `useAppInstall`, so calling `prompt()` never happens twice.
 */
export function InstallAppButton({
  variant = 'button',
  className,
  buttonClassName,
}: InstallAppButtonProps) {
  const { canInstall, installed, install } = useAppInstall()
  const { t } = useI18n()

  // Installed (or running standalone) — nothing to offer here.
  if (installed) return null

  if (variant === 'card') {
    return (
      <div
        className={cn(
          'rounded-2xl border border-border bg-card/80 shadow-kin p-4 sm:p-5',
          className
        )}
      >
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <MonitorSmartphone className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-snug">
              {t('install.cardTitle')}
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {t('install.cardDesc')}
            </p>
            {canInstall ? (
              <Button
                onClick={() => void install()}
                size="lg"
                className={cn('mt-3.5 h-11 sm:h-11 gap-2 w-full sm:w-auto', buttonClassName)}
              >
                <Download className="w-4 h-4" />
                {t('settings.installButton')}
              </Button>
            ) : (
              <p className="mt-3.5 text-xs text-muted-foreground/80 leading-relaxed">
                {t('install.browserHint')}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Compact button — only rendered when an install is actually possible.
  if (!canInstall) return null

  return (
    <Button
      onClick={() => void install()}
      variant="outline"
      className={cn('gap-2 h-11 w-full', className, buttonClassName)}
      title={t('settings.installButton')}
    >
      <Download className="w-4 h-4" />
      {t('settings.installButton')}
    </Button>
  )
}
