/**
 * Timezone strategy — single source of truth (cf. supabase/timezone.sql).
 *
 * Rules:
 *  - Absolute instants are stored in UTC (`timestamptz` columns).
 *  - Calendar dates (`tasks.due_date`, `journal_entries.entry_date`) are
 *    wall-clock `YYYY-MM-DD` days in the USER's timezone.
 *  - `tasks.scheduled_time` is a wall-clock `HH:MM` in the user's timezone.
 *  - `profiles.timezone` (IANA name) is the explicit user preference; until
 *    it is stored, the client uses the device timezone and the server falls
 *    back to "UTC" (documented degradation).
 *
 * Conversion happens only at the UI/backend boundary. Never compare
 * `getHours()` against `getUTCHours()` on the same business value.
 */

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export interface TzParts {
  y: number
  mo: number
  d: number
  h: number
  mi: number
  s: number
}

/** Calendar parts of `date` expressed in timezone `tz`. */
export function tzParts(tz: string, date: Date = new Date()): TzParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = dtf.formatToParts(date)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') }
}

/** Offset in ms to ADD to a UTC instant to obtain local time in `tz`. */
export function tzOffsetMs(tz: string, utcMs: number): number {
  const p = tzParts(tz, new Date(utcMs))
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - utcMs
}

/** Local wall-clock date key `YYYY-MM-DD` for an instant, in `tz`. */
export function localDateKey(tz: string, date: Date = new Date()): string {
  const p = tzParts(tz, date)
  return `${p.y}-${pad2(p.mo)}-${pad2(p.d)}`
}

/** Minutes since local midnight for an instant, in `tz`. */
export function localMinutes(tz: string, date: Date = new Date()): number {
  const p = tzParts(tz, date)
  return p.h * 60 + p.mi
}

/** Device IANA timezone (client-side only). */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * Absolute UTC instant of a wall-clock time `HH:MM` on the calendar day
 * `dateKey` (YYYY-MM-DD) in timezone `tz`. Handles DST transitions and
 * midnight shifts correctly.
 */
export function localToUtcDate(dateKey: string, hhmm: string, tz: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  const [y, mo, d] = dateKey.split('-').map(Number)
  if ([h, m, y, mo, d].some((n) => Number.isNaN(n))) return new Date(Number.NaN)
  const wallUtc = Date.UTC(y, mo - 1, d, h || 0, m || 0)
  return new Date(wallUtc - tzOffsetMs(tz, wallUtc))
}

/** Whole minutes between two instants (positive when `a` is after `b`). */
export function minutesBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 60_000)
}
