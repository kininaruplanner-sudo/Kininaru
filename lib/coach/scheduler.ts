'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { canCoachIntervene, recordCoachIntervention } from './frequency'
import { loadCoachPrefs } from './preferences'
import { deviceTimezone } from '@/lib/time'
import { format } from 'date-fns'

/**
 * Reminder scheduler — boucle proactive PLAN → REMIND (côté client).
 *
 * Honest design: this only fires while the app is OPEN. When the app is
 * closed, the server cron (`/api/cron/reminders`, Web Push) takes over for
 * subscribed devices. The two share the same rules (heures silencieuses,
 * fréquence, déduplication) so l'utilisateur n'est jamais harcelé :
 *  - tâche du jour avec heure planifiée : « commence dans 10 minutes » /
 *    « était prévue à HH:MM » (une seule fois par tâche et par jour) ;
 *  - événement du jour : « commence dans 10 minutes ».
 *
 * FUSEAUX (cf. lib/time.ts) : scheduled_time est une heure mur locale
 * (l'appareil qui saisit l'heure EST la référence locale) et due_date est
 * un jour mur local — on compare donc avec l'heure/date locales de
 * l'appareil, jamais avec des valeurs UTC. Le fuseau de l'appareil est
 * aussi enregistré une fois dans profiles.timezone pour que le cron serveur
 * convertisse correctement quand l'app est fermée.
 *
 * Les données viennent de la base RLS (jamais inventées). La notification
 * se fait dans la cloche in-app + Notification API navigateur si la
 * permission est accordée.
 */

const CHECK_INTERVAL_MS = 45_000
const SCHEDULE_REFRESH_MS = 5 * 60_000
const LEAD_MINUTES = 10
const LATE_WINDOW_MINUTES = 35 // après le début planifié, on rappelle une seule fois

interface ScheduledTask {
  id: string
  title: string
  status: string
  due_date: string | null
  scheduled_time: string | null
}

interface ScheduledEvent {
  id: string
  title: string
  start_at: string
}

function minutesNow(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Déduplication locale : une seule notification par (type, id, jour). */
function keyFor(kind: string, id: string): string {
  return `kininaru-remind:${kind}:${id}:${format(new Date(), 'yyyy-MM-dd')}`
}

function wasNotified(kind: string, id: string): boolean {
  try {
    return window.localStorage.getItem(keyFor(kind, id)) === '1'
  } catch {
    return false
  }
}

function markNotified(kind: string, id: string) {
  try {
    window.localStorage.setItem(keyFor(kind, id), '1')
  } catch {
    // storage unavailable — worst case, one duplicate per session
  }
}

async function pushInApp(title: string, body: string, link: string) {
  try {
    const supabase = createClient()
    await supabase.from('notifications').insert({
      type: 'reminder',
      title: title.slice(0, 120),
      body: body.slice(0, 500),
      link: link.startsWith('/') ? link.slice(0, 200) : null,
    })
  } catch {
    // fire-and-forget : la cloche reste le canal principal
  }
}

async function maybeBrowserNotification(title: string, body: string) {
  try {
    if (!('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    // Quand l'app est ouverte ET visible, la cloche suffit ; le navigateur
    // affiche sa propre notification quand l'onglet est en arrière-plan.
    if (document.visibilityState === 'visible') return
    const n = new Notification(title, { body, tag: `kininaru-remind-${Date.now()}`, silent: false })
    n.onclick = () => window.focus()
  } catch {
    // notifications bloquées — canal in-app uniquement
  }
}

function dueReminders(
  tasks: ScheduledTask[],
  events: ScheduledEvent[],
  nowMin: number
): { kind: 'task' | 'event'; id: string; title: string; body: string; link: string }[] {
  const out: { kind: 'task' | 'event'; id: string; title: string; body: string; link: string }[] = []
  const today = format(new Date(), 'yyyy-MM-dd')

  for (const t of tasks) {
    if (t.status === 'done' || t.due_date !== today || !t.scheduled_time) continue
    const start = parseTime(t.scheduled_time)
    const diff = nowMin - start
    if (diff >= -LEAD_MINUTES && diff <= LATE_WINDOW_MINUTES && !wasNotified('task', t.id)) {
      const label = format(new Date(), 'HH:mm')
      if (diff < 0) {
        out.push({
          kind: 'task',
          id: t.id,
          title: `🎯 « ${t.title} » commence dans ${Math.abs(diff)} min`,
          body: `Prévu à ${t.scheduled_time.slice(0, 5)}. On s'y met ?`,
          link: `/focus?taskId=${t.id}&task=${encodeURIComponent(t.title)}`,
        })
      } else if (diff <= 5) {
        out.push({
          kind: 'task',
          id: t.id,
          title: `🎯 C'est l'heure : ${t.title}`,
          body: `Prévu à ${t.scheduled_time.slice(0, 5)} — il est ${label}.`,
          link: `/focus?taskId=${t.id}&task=${encodeURIComponent(t.title)}`,
        })
      } else {
        out.push({
          kind: 'task',
          id: t.id,
          title: `⏰ ${t.title} était prévu·e à ${t.scheduled_time.slice(0, 5)}`,
          body: 'On commence maintenant ou on le déplace ?',
          link: `/focus?taskId=${t.id}&task=${encodeURIComponent(t.title)}`,
        })
      }
    }
  }

  for (const e of events) {
    const startMin = new Date(e.start_at).getHours() * 60 + new Date(e.start_at).getMinutes()
    const diff = startMin - nowMin
    if (diff >= 0 && diff <= LEAD_MINUTES && !wasNotified('event', e.id)) {
      out.push({
        kind: 'event',
        id: e.id,
        title: `📅 ${e.title} commence dans ${diff === 0 ? 'quelques instants' : `${diff} min`}`,
        body: "Place à cet événement — le coach peut t'aider à préparer la suite.",
        link: '/calendar',
      })
    }
  }
  return out
}

export function useReminderScheduler(enabled = true) {
  const scheduleRef = useRef<{ tasks: ScheduledTask[]; events: ScheduledEvent[] }>({
    tasks: [],
    events: [],
  })
  const lastRefreshRef = useRef(0)
  const tzWrittenRef = useRef(false)

  useEffect(() => {
    if (!enabled) return
    const supabase = createClient()

    // Enregistre une fois le fuseau de l'appareil (IANA) pour que le cron
    // serveur convertisse scheduled_time correctement quand l'app est fermée.
    const ensureTimezone = async () => {
      if (tzWrittenRef.current) return
      tzWrittenRef.current = true
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return
        const { data: prof } = await supabase
          .from('profiles')
          .select('timezone')
          .eq('id', user.id)
          .maybeSingle()
        if (!prof?.timezone) {
          await supabase
            .from('profiles')
            .update({ timezone: deviceTimezone() })
            .eq('id', user.id)
        }
      } catch {
        // non critique — le fuseau sera réessayé à la prochaine session
      }
    }

    const refreshSchedule = async () => {
      try {
        // Jour mur LOCAL de l'appareil (scheduled_time est une heure mur locale).
        const today = format(new Date(), 'yyyy-MM-dd')
        const now = new Date().toISOString()
        const soon = new Date(Date.now() + 60 * 60_000).toISOString()
        const [{ data: tasks }, { data: events }] = await Promise.all([
          supabase
            .from('tasks')
            .select('id, title, status, due_date, scheduled_time')
            .eq('due_date', today)
            .in('status', ['todo', 'in_progress']),
          supabase
            .from('events')
            .select('id, title, start_at')
            .gte('start_at', now)
            .lte('start_at', soon)
            .order('start_at', { ascending: true })
            .limit(20),
        ])
        scheduleRef.current = {
          tasks: (tasks ?? []) as ScheduledTask[],
          events: (events ?? []) as ScheduledEvent[],
        }
      } catch {
        // hors ligne ou erreur — on garde le dernier cache, on réessaiera
      }
    }

    const tick = () => {
      const prefs = loadCoachPrefs()
      // Même anti-spam que le coach : heures silencieuses, fréquence, pause.
      const gate = canCoachIntervene(prefs)
      if (!gate.allowed) return

      void ensureTimezone()

      if (Date.now() - lastRefreshRef.current > SCHEDULE_REFRESH_MS) {
        lastRefreshRef.current = Date.now()
        void refreshSchedule()
      }

      const reminders = dueReminders(
        scheduleRef.current.tasks,
        scheduleRef.current.events,
        minutesNow()
      )
      for (const r of reminders.slice(0, 2)) {
        recordCoachIntervention()
        markNotified(r.kind, r.id)
        void pushInApp(r.title, r.body, r.link)
        void maybeBrowserNotification(r.title, r.body)
      }
    }

    // Premier rafraîchissement immédiat, puis ticks réguliers.
    lastRefreshRef.current = Date.now()
    void ensureTimezone()
    void refreshSchedule()
    const timer = window.setInterval(tick, CHECK_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [enabled])
}
