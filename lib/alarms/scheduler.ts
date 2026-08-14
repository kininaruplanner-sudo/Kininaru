/**
 * Alarm scheduler helpers (§15–§16).
 *
 * Honest technical contract, documented once here so the UI never promises
 * more than the platform can deliver:
 * - Alarms are LOCAL to each device: `time` is 'HH:MM' in the device's own
 *   timezone, `days` are weekdays 0 (dim.) → 6 (sam.).
 * - While the app (or any tab of the site) is open, the scheduler fires at
 *   the exact minute and shows a system notification with actions
 *   (Reposer / Arrêter) via the service worker.
 * - If every tab is closed, a PWA cannot guarantee an alarm: the OS may or
 *   may not keep the service worker alive. This is a platform limitation,
 *   never faked.
 */

export interface Alarm {
  id: string
  title: string
  time: string // 'HH:MM' (device-local)
  days: number[] // 0 = dimanche … 6 = samedi
  enabled: boolean
  sound: boolean
  vibrate: boolean
  snooze_minutes: number
}

export const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export const DAY_LABELS_FULL = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
]

/** Compact label, e.g. [1,2,3,4,5] → "Lun–Ven", [0,6] → "Sam–Dim". */
export function formatDays(days: number[]): string {
  if (days.length === 0) return 'Jamais'
  const sorted = [...days].sort((a, b) => a - b)
  if (sorted.length === 7) return 'Tous les jours'
  if (sorted.length === 5 && sorted.join(',') === '1,2,3,4,5') return 'Lun–Ven'
  if (sorted.length === 2 && sorted.join(',') === '0,6') return 'Week-end'
  return sorted.map((d) => DAY_LABELS[d]).join(' · ')
}

/**
 * Next date at which an alarm fires, from `from` (defaults to now).
 * Returns null when `days` is empty. Handles the "time already passed
 * today" case by rolling to the next matching weekday.
 */
export function nextOccurrence(
  time: string,
  days: number[],
  from: Date = new Date()
): Date | null {
  if (days.length === 0) return null
  const [h, m] = time.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  const daySet = new Set(days)
  for (let i = 0; i < 8; i++) {
    const candidate = new Date(from)
    candidate.setDate(from.getDate() + i)
    if (!daySet.has(candidate.getDay())) continue
    candidate.setHours(h, m, 0, 0)
    if (candidate.getTime() > from.getTime()) return candidate
  }
  return null
}

/** Service-worker message contract for alarm actions (snooze / stop). */
export interface AlarmActionMessage {
  type: 'KIN_ALARM_ACTION'
  action: 'snooze' | 'stop'
  alarmId?: string
  snoozeMinutes?: number
}

export const ALARM_NOTIFICATION_TAG = 'kininaru-alarm'
