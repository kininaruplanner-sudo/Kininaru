'use client'

import { useState } from 'react'
import { BellRing, PauseCircle, RotateCcw, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useI18n, type TranslationKey } from '@/lib/i18n'
import { useCoachPrefs } from '@/lib/coach/preferences'
import { COACH_STYLES, type CoachStyle } from '@/lib/coach/rules'

const STYLE_LABEL_KEYS: Record<CoachStyle, TranslationKey> = {
  calm: 'settings.coachStyleCalm',
  encouraging: 'settings.coachStyleEncouraging',
  direct: 'settings.coachStyleDirect',
  concise: 'settings.coachStyleConcise',
}
import {
  getNotificationPermission,
  requestNotificationPermission,
} from '@/lib/notifications'

/**
 * Coach IA settings — ÉTAPE 14 §8, 19, 36.
 * Master switch, proactive comments, notifications (permission is only ever
 * requested here, never on first load), briefs, style, pause and reset.
 */

function SwitchRow({
  checked,
  onChange,
  disabled,
  label,
  description,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  label: string
  description?: string
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 py-2',
        disabled && 'opacity-50'
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground leading-snug mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-10 h-6 rounded-full transition-smooth shrink-0 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
          checked ? 'bg-primary' : 'bg-muted',
          disabled && 'cursor-not-allowed'
        )}
        aria-label={label}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
            checked && 'translate-x-4'
          )}
        />
      </button>
    </div>
  )
}

export function CoachSettingsPanel() {
  const { t } = useI18n()
  const { prefs, update, reset, pauseFor } = useCoachPrefs()
  const [permNote, setPermNote] = useState<string | null>(null)
  // Mirrors `prefs.pausedUntil` for the UI; the actual gate is the timestamp.
  const [paused, setPaused] = useState(false)

  const handlePause = () => {
    pauseFor(24)
    setPaused(true)
  }

  const handleResume = () => {
    update({ pausedUntil: null })
    setPaused(false)
  }

  const handleReset = () => {
    reset()
    setPaused(false)
  }

  const toggleNotifications = async (next: boolean) => {
    if (!next) {
      update({ notifications: false })
      return
    }
    const current = getNotificationPermission()
    if (current === 'unsupported') {
      setPermNote(t('settings.coachNotifUnsupported'))
      return
    }
    if (current === 'denied') {
      // System notifications are blocked by the browser, but the in-app bell
      // still works — enable it and explain.
      update({ notifications: true })
      setPermNote(t('settings.coachNotifBlocked'))
      return
    }
    if (current === 'default') {
      // Request permission from this user gesture, with the explanation shown
      // first (the requirement to never ask on first load is enforced by the
      // fact that this only happens on an explicit click here).
      const granted = await requestNotificationPermission()
      if (granted === 'granted') {
        update({ notifications: true })
        setPermNote(null)
      } else if (granted === 'denied') {
        update({ notifications: true })
        setPermNote(t('settings.coachNotifBlocked'))
      } else {
        setPermNote(t('settings.coachNotifExplain'))
      }
      return
    }
    // granted
    update({ notifications: true })
    setPermNote(null)
  }

  return (
    <div className="space-y-4">
      <SwitchRow
        checked={prefs.enabled}
        onChange={(v) => update({ enabled: v })}
        label={t('settings.coachEnabled')}
        description={t('settings.coachEnabledDesc')}
      />

      <div className={cn('space-y-1', !prefs.enabled && 'opacity-60 pointer-events-none')}>
        <SwitchRow
          checked={prefs.proactive}
          onChange={(v) => update({ proactive: v })}
          label={t('settings.coachProactive')}
          description={t('settings.coachProactiveDesc')}
        />
        <SwitchRow
          checked={prefs.notifications}
          onChange={(v) => void toggleNotifications(v)}
          label={t('settings.coachNotif')}
          description={t('settings.coachNotifDesc')}
        />
        {permNote && (
          <p className="text-xs text-muted-foreground bg-muted/60 rounded-lg px-3 py-2 leading-snug">
            {permNote}
          </p>
        )}
        <SwitchRow
          checked={prefs.dailyBrief}
          onChange={(v) => update({ dailyBrief: v })}
          label={t('settings.coachDaily')}
          description={t('settings.coachDailyDesc')}
        />
        <SwitchRow
          checked={prefs.weeklyReview}
          onChange={(v) => update({ weeklyReview: v })}
          label={t('settings.coachWeekly')}
          description={t('settings.coachWeeklyDesc')}
        />
      </div>

      {/* Style (§8 / §20) — changes tone only, never rules or safety */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">{t('settings.coachStyle')}</p>
        <div className="grid grid-cols-2 gap-2">
          {COACH_STYLES.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => update({ style })}
              className={cn(
                'px-3 py-2 rounded-xl border-2 text-sm font-medium transition-smooth',
                prefs.style === style
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
              )}
            >
              {t(STYLE_LABEL_KEYS[style])}
            </button>
          ))}
        </div>
      </div>

      {/* Pause / reset */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={handlePause} className="gap-1.5">
          <PauseCircle className="w-3.5 h-3.5" />
          {t('settings.coachPause')}
        </Button>
        {paused && (
          <Button variant="ghost" size="sm" onClick={handleResume} className="gap-1.5">
            <BellRing className="w-3.5 h-3.5" />
            {t('settings.coachResume')}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5 text-muted-foreground">
          <RotateCcw className="w-3.5 h-3.5" />
          {t('settings.coachReset')}
        </Button>
      </div>

      {/* Privacy note (§36) */}
      <div className="rounded-xl bg-muted/50 border border-border p-3.5 flex gap-2.5">
        <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">{t('settings.coachPrivacy')}</p>
      </div>
    </div>
  )
}
