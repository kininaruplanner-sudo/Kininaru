'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlarmClock, Trash2, BellRing, Vibrate, Plus, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cardVariants } from '@/components/ui/card'
import {
  Alarm,
  DAY_LABELS,
  formatDays,
  nextOccurrence,
  ALARM_NOTIFICATION_TAG,
  type AlarmActionMessage,
} from '@/lib/alarms/scheduler'

interface Props {
  alarms: AlarmRow[]
  userId: string
}

export interface AlarmRow extends Alarm {
  last_fired_at?: string | null
  created_at: string
}

const DAY_CHIPS = [0, 1, 2, 3, 4, 5, 6]

/**
 * Joué au déclenchement quand « Son » est activé (réglage réellement
 * utilisé, plus décoratif). Court double bip doux via Web Audio ; la
 * notification système fait le reste (vibration + son du système via
 * `silent: false`).
 */
function playAlarmTone() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    void ctx.resume().catch(() => {})
    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    ;[659.25, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      const t = ctx.currentTime + i * 0.35
      osc.start(t)
      osc.stop(t + 0.3)
    })
  } catch {
    // audio indisponible — la notification elle-même suffit
  }
}

/**
 * Alarms (§15) — distinct from reminders:
 * a reminder says "n'oublie pas", an alarm says "ton créneau commence
 * maintenant". Scheduled LOCALLY (per device, local timezone). Honest
 * platform limits are shown in the UI — a PWA cannot guarantee an alarm
 * when every tab is closed (see lib/alarms/scheduler.ts).
 */
export function AlarmClient({ alarms: initial, userId }: Props) {
  const supabase = createClient()
  const [alarms, setAlarms] = useState<AlarmRow[]>(initial)
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('18:30')
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [sound, setSound] = useState(true)
  const [vibrate, setVibrate] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  )
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const showAlarm = useCallback(
    async (alarm: AlarmRow) => {
      // Note: `vibrate` is not part of this lib's NotificationOptions — the
      // untyped object stays structurally compatible with showNotification.
      // « Son » est réellement appliqué : silent:false laisse le système
      // émettre un son, et un bip local est joué quand la page est visible.
      if (alarm.sound) playAlarmTone()
      const options = {
        body: 'Ton créneau commence maintenant.',
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: `${ALARM_NOTIFICATION_TAG}-${alarm.id}`,
        vibrate: alarm.vibrate ? [200, 100, 200, 100, 400] : [],
        silent: !alarm.sound,
        requireInteraction: true,
        actions: [
          { action: 'snooze', title: `Reposer ${alarm.snooze_minutes} min` },
          { action: 'stop', title: 'Arrêter' },
        ],
        data: { kind: 'alarm', alarmId: alarm.id, snoozeMinutes: alarm.snooze_minutes },
      }
      // Route through the service worker so taps are handled even if this
      // page is not focused anymore.
      const reg = await navigator.serviceWorker?.getRegistration().catch(() => null)
      if (reg) {
        await reg.showNotification(`${alarm.title} — il est ${alarm.time}`, options)
      } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(`${alarm.title} — il est ${alarm.time}`, options)
      }
    },
    []
  )

  // Hoisted function declaration: fires the alarm, marks it, then rolls to
  // the next regular occurrence via its own setTimeout chain (no TDZ issue).
  function scheduleNext(alarm: AlarmRow) {
    const target = nextOccurrence(alarm.time, alarm.days)
    if (!target) return
    const t = setTimeout(() => {
      void (async () => {
        await showAlarm(alarm)
        // mark fired (best-effort), then roll to the next occurrence
        try {
          await supabase
            .from('alarms')
            .update({ last_fired_at: new Date().toISOString() })
            .eq('id', alarm.id)
        } catch {
          // offline / table missing — the local schedule still works
        }
        scheduleNext(alarm)
      })()
    }, Math.max(0, target.getTime() - Date.now()))
    timersRef.current.set(alarm.id, t)
  }

  const scheduleAlarm = useCallback(
    (alarm: AlarmRow, snoozeMinutes?: number) => {
      if (timersRef.current.has(alarm.id)) {
        clearTimeout(timersRef.current.get(alarm.id))
      }
      if (snoozeMinutes) {
        // One-shot snooze, then back to the regular schedule.
        const t = setTimeout(() => {
          void (async () => {
            await showAlarm(alarm)
            scheduleNext(alarm)
          })()
        }, snoozeMinutes * 60_000)
        timersRef.current.set(alarm.id, t)
      } else {
        scheduleNext(alarm)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scheduleNext is a hoisted function declaration, not reactive state
    [showAlarm, supabase]
  )

  // (Re)schedule everything whenever the alarm list changes.
  useEffect(() => {
    for (const t of timersRef.current.values()) clearTimeout(t)
    timersRef.current.clear()
    for (const alarm of alarms) {
      if (alarm.enabled) scheduleAlarm(alarm)
    }
    return () => {
      const timers = timersRef.current
      for (const t of timers.values()) clearTimeout(t)
      timers.clear()
    }
  }, [alarms, scheduleAlarm])

  // Snooze / stop messages coming back from the service worker.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as AlarmActionMessage | null
      if (!data || data.type !== 'KIN_ALARM_ACTION') return
      if (data.action === 'snooze' && data.alarmId) {
        const alarm = alarms.find((a) => a.id === data.alarmId)
        if (alarm) scheduleAlarm(alarm, data.snoozeMinutes ?? alarm.snooze_minutes)
      }
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage)
  }, [alarms, scheduleAlarm])

  const ensurePermission = async () => {
    if (typeof Notification === 'undefined') return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    const result = await Notification.requestPermission()
    setPermission(result)
    return result === 'granted'
  }

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))

  const createAlarm = async () => {
    const trimmed = title.trim()
    if (!trimmed || !time) return
    const ok = await ensurePermission()
    if (!ok && permission !== 'unsupported') return
    const { data, error: insertErr } = await supabase
      .from('alarms')
      .insert({
        user_id: userId,
        title: trimmed.slice(0, 60),
        time,
        days,
        sound,
        vibrate,
        snooze_minutes: 5,
      })
      .select()
      .single()
    if (insertErr) {
      setError(
        "Impossible d'enregistrer l'alarme (table non initialisée ?). Exécutez supabase/alarms.sql dans Supabase, puis réessayez."
      )
      return
    }
    if (data) {
      setError(null)
      setAlarms((prev) => [...prev, data as AlarmRow])
      setTitle('')
      setAdding(false)
    }
  }

  const toggleEnabled = async (alarm: AlarmRow) => {
    const next = !alarm.enabled
    if (next) {
      const ok = await ensurePermission()
      if (!ok && permission !== 'unsupported') return
    }
    const { error: toggleErr } = await supabase
      .from('alarms')
      .update({ enabled: next })
      .eq('id', alarm.id)
    if (toggleErr) {
      setError("Impossible de modifier l'alarme. Réessayez dans un instant.")
      return
    }
    setError(null)
    setAlarms((prev) => prev.map((a) => (a.id === alarm.id ? { ...a, enabled: next } : a)))
  }

  const deleteAlarm = async (id: string) => {
    const { error: deleteErr } = await supabase.from('alarms').delete().eq('id', id)
    if (deleteErr) {
      setError("Impossible de supprimer l'alarme. Réessayez dans un instant.")
      return
    }
    setError(null)
    setAlarms((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div className="space-y-5">
      {error && (
        <div
          className={cn(
            cardVariants({ padding: 'md' }),
            'flex items-start gap-3 border-destructive/30 bg-destructive/10'
          )}
          role="alert"
        >
          <Info className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive leading-relaxed">{error}</p>
        </div>
      )}

      {/* Honest platform limits — never over-promise an alarm while closed. */}
      <div
        className={cn(
          cardVariants({ padding: 'md' }),
          'flex items-start gap-3 border-primary/20 bg-primary/5'
        )}
      >
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Les alarmes sonnent à l’heure locale de cet appareil dès que l’application (ou un
          onglet du site) est ouvert, ou via les notifications système si elles sont autorisées.
          Comme toute PWA, Kininaru ne peut pas garantir qu’une alarme sonne si le navigateur est
          complètement fermé — c’est une limite de la plateforme, pas un réglage manquant.
        </p>
      </div>

      {/* List */}
      <div className="space-y-3">
        {alarms.length === 0 && !adding ? (
          <div className={cn(cardVariants({ padding: 'lg' }), 'text-center py-10')}>
            <AlarmClock className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-sm text-muted-foreground">Aucune alarme pour le moment.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setAdding(true)}
            >
              <Plus className="w-4 h-4" /> Créer une alarme
            </Button>
          </div>
        ) : (
          <>
            {alarms.map((alarm) => (
              <div
                key={alarm.id}
                className={cn(
                  cardVariants({ padding: 'md' }),
                  'flex items-center gap-4',
                  !alarm.enabled && 'opacity-60'
                )}
              >
                <div className="text-2xl font-bold text-foreground tabular-nums w-16 shrink-0">
                  {alarm.time}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{alarm.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDays(alarm.days)}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                  {alarm.sound && <BellRing className="w-4 h-4" aria-label="Son activé" />}
                  {alarm.vibrate && <Vibrate className="w-4 h-4" aria-label="Vibration activée" />}
                </div>
                <button
                  onClick={() => toggleEnabled(alarm)}
                  aria-pressed={alarm.enabled}
                  aria-label={alarm.enabled ? 'Désactiver l’alarme' : 'Activer l’alarme'}
                  className={cn(
                    'relative w-11 h-6 rounded-full transition-colors shrink-0',
                    alarm.enabled ? 'bg-primary' : 'bg-muted'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all',
                      alarm.enabled ? 'left-[22px]' : 'left-0.5'
                    )}
                  />
                </button>
                <button
                  onClick={() => deleteAlarm(alarm.id)}
                  aria-label={`Supprimer l’alarme ${alarm.title}`}
                  className="p-2.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-smooth shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <Plus className="w-4 h-4" /> Nouvelle alarme
            </Button>
          </>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <div className={cn(cardVariants({ padding: 'lg' }), 'space-y-4')}>
          <div className="grid sm:grid-cols-[1fr_auto] gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="alarm-title">Titre</Label>
              <Input
                id="alarm-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Révision, sport, dîner…"
                maxLength={60}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alarm-time">Heure</Label>
              <Input
                id="alarm-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Jours</Label>
            <div className="flex flex-wrap gap-1.5">
              {DAY_CHIPS.map((d) => {
                const active = days.includes(d)
                return (
                  <button
                    key={d}
                    onClick={() => toggleDay(d)}
                    aria-pressed={active}
                    className={cn(
                      'min-w-11 min-h-11 px-3 rounded-xl text-xs font-medium transition-smooth',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70'
                    )}
                  >
                    {DAY_LABELS[d]}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSound((v) => !v)}
              aria-pressed={sound}
              className={cn(
                'flex items-center gap-1.5 px-3 min-h-11 rounded-xl text-xs font-medium transition-smooth',
                sound ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              )}
            >
              <BellRing className="w-3.5 h-3.5" /> Son
            </button>
            <button
              onClick={() => setVibrate((v) => !v)}
              aria-pressed={vibrate}
              className={cn(
                'flex items-center gap-1.5 px-3 min-h-11 rounded-xl text-xs font-medium transition-smooth',
                vibrate ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              )}
            >
              <Vibrate className="w-3.5 h-3.5" /> Vibration
            </button>
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={() => void createAlarm()}>
              <Plus className="w-4 h-4" /> Ajouter l’alarme
            </Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      {permission === 'denied' && (
        <p className="text-xs text-destructive">
          Les notifications sont bloquées pour ce site — autorisez-les pour que les alarmes
          puissent sonner.
        </p>
      )}
    </div>
  )
}
