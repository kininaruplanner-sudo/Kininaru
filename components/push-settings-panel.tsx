'use client'

import { useCallback, useEffect, useState } from 'react'
import { BellRing, BellOff, Loader2, Send, ShieldCheck, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  pushSupported,
  fetchPushConfig,
  subscribePush,
  unsubscribePush,
  sendTestPush,
  isPushEnabled,
  DEFAULT_PUSH_PREFS,
  type PushPrefs,
} from '@/lib/web-push/client'

/**
 * Settings → Notifications — real Web Push (ÉTAPE 15.5 §9-10).
 *
 * Permission is requested ONLY here, from an explicit click. The user can
 * choose which brief types they want, set quiet hours, and test the whole
 * pipeline. Everything degrades gracefully when the browser or the server
 * configuration doesn't support push.
 */

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground leading-snug mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative w-10 h-6 rounded-full transition-smooth shrink-0 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
          checked ? 'bg-primary' : 'bg-muted'
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

const HOURS = Array.from({ length: 24 }, (_, i) => i)

export function PushSettingsPanel() {
  const [supported, setSupported] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [checking, setChecking] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState<null | 'enable' | 'disable' | 'test'>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<PushPrefs>({ ...DEFAULT_PUSH_PREFS })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      // Browser support is decided client-side; server config decides whether
      // push can actually be delivered.
      setSupported(pushSupported())
      const config = await fetchPushConfig()
      if (cancelled) return
      setConfigured(config.enabled)
      setEnabled(isPushEnabled())
      setChecking(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const enable = useCallback(async () => {
    setBusy('enable')
    setError(null)
    setNote(null)
    const res = await subscribePush(prefs)
    setBusy(null)
    if (res.ok) {
      setEnabled(true)
      setNote('Push activé sur cet appareil.')
    } else {
      const messages: Record<string, string> = {
        unsupported: 'Les notifications push ne sont pas prises en charge par ce navigateur.',
        'not-configured':
          'Le serveur n’est pas configuré pour le push (clés VAPID manquantes). Activez-les pour continuer.',
        'permission-denied':
          'Permission refusée par le navigateur. Autorisez les notifications dans les réglages du site.',
        server: 'Le serveur n’a pas pu enregistrer l’abonnement. Réessaie dans un instant.',
      }
      setError(messages[res.error ?? 'unknown'] ?? 'Impossible d’activer les notifications push.')
    }
  }, [prefs])

  const disable = useCallback(async () => {
    setBusy('disable')
    setError(null)
    const res = await unsubscribePush()
    setBusy(null)
    if (res.ok) {
      setEnabled(false)
      setNote('Notifications push désactivées sur cet appareil.')
    } else {
      setError('Impossible de désactiver les notifications push.')
    }
  }, [])

  const updatePrefs = useCallback(
    (patch: Partial<PushPrefs>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...patch }
        // Keep preferences in sync with the server immediately (upsert).
        if (enabled) void subscribePush(next)
        return next
      })
    },
    [enabled]
  )

  const test = useCallback(async () => {
    setBusy('test')
    setError(null)
    const res = await sendTestPush()
    setBusy(null)
    if (res.ok) setNote('Notification de test envoyée. Vérifie ton écran !')
    else setError('Impossible d’envoyer la notification de test.')
  }, [])

  if (checking) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin motion-reduce:hidden" />
        Vérification du support…
      </div>
    )
  }

  if (!supported) {
    return (
      <div className="rounded-xl bg-muted/60 border border-border p-4 flex gap-2.5">
        <BellOff className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Ce navigateur ne prend pas en charge les notifications push. Les notifications
          internes (cloche) restent disponibles.
        </p>
      </div>
    )
  }

  if (!configured) {
    return (
      <div className="rounded-xl bg-muted/60 border border-border p-4 flex gap-2.5">
        <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Le push n’est pas encore configuré sur le serveur. Ajoutez les clés VAPID
          (NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY) pour
          activer les vraies notifications Web Push.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-primary/5 border border-primary/15 p-4">
        <div className="flex items-start gap-2.5">
          <Smartphone className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Notifications Web Push {enabled ? '· activées' : '· désactivées'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {enabled
                ? 'Cet appareil recevra les briefs et rappels même quand l’application est fermée.'
                : 'Autorisez les notifications pour recevoir vos briefs même quand l’application est fermée.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {!enabled ? (
            <Button size="sm" onClick={() => void enable()} disabled={busy === 'enable'} className="gap-1.5">
              {busy === 'enable' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:hidden" />
              ) : (
                <BellRing className="w-3.5 h-3.5" />
              )}
              Activer les notifications push
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => void test()} disabled={busy === 'test'} className="gap-1.5">
                {busy === 'test' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:hidden" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Envoyer un test
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void disable()} disabled={busy === 'disable'} className="gap-1.5 text-muted-foreground">
                <BellOff className="w-3.5 h-3.5" />
                Désactiver
              </Button>
            </>
          )}
        </div>
        {error && <p className="text-xs text-destructive mt-2">{error}</p>}
        {note && <p className="text-xs text-kin-sage mt-2">{note}</p>}
      </div>

      {enabled && (
        <div className="space-y-1 border-t border-border pt-2">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide pt-1">
            Types de notifications
          </p>
          <ToggleRow
            label="Brief du matin"
            description="Un récapitulatif de ta journée (priorités, événements, habitudes)"
            checked={prefs.morning}
            onChange={(v) => updatePrefs({ morning: v })}
          />
          <ToggleRow
            label="Brief du soir"
            description="Le bilan de ta journée (tâches, focus, habitudes)"
            checked={prefs.evening}
            onChange={(v) => updatePrefs({ evening: v })}
          />
          <ToggleRow
            label="Bilan hebdomadaire"
            description="Ton analyse de la semaine (le lundi)"
            checked={prefs.weekly}
            onChange={(v) => updatePrefs({ weekly: v })}
          />
          <ToggleRow
            label="Aides du coach"
            description="Rappels et encouragements ciblés du coach"
            checked={prefs.coach}
            onChange={(v) => updatePrefs({ coach: v })}
          />
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Heures silencieuses — début</label>
              <select
                value={prefs.quietStart}
                onChange={(e) => updatePrefs({ quietStart: Number(e.target.value) })}
                className="w-full h-9 px-2 text-sm bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring transition-smooth"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Heures silencieuses — fin</label>
              <select
                value={prefs.quietEnd}
                onChange={(e) => updatePrefs({ quietEnd: Number(e.target.value) })}
                className="w-full h-9 px-2 text-sm bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring transition-smooth"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground/80 leading-snug pt-1">
            Aucune notification pendant les heures silencieuses, maximum 6 par jour, jamais de
            doublon, et rien pour une tâche déjà terminée.
          </p>
        </div>
      )}
    </div>
  )
}
