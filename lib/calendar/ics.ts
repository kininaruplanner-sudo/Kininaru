/**
 * Minimal, dependency-free ICS parser — enough for real calendar
 * subscriptions (iCloud « Calendrier partagé public », Google « Adresse
 * publique », Outlook web publish).
 *
 * Scope: VEVENT blocks with DTSTART/DTEND (UTC « Z », date-only, or TZID).
 *  - « Z » suffix        → UTC instant.
 *  - VALUE=DATE          → all-day (start of UTC day).
 *  - TZID / floating     → wall-clock interpreted in the connection user's
 *    timezone (same strategy as tasks.scheduled_time, cf. lib/time.ts).
 *
 * Exotic features (RECURRENCE, VTIMEZONE offsets, alarms, exdates) are
 * skipped rather than mis-imported — a real sync of a recurring series is
 * out of scope for a beta and would create wrong data.
 */

import { localToUtcDate } from '@/lib/time'

export interface IcsEvent {
  uid: string
  summary: string
  description: string | null
  location: string | null
  startAt: Date
  endAt: Date
  allDay: boolean
  /** Raw DTSTART value (diagnostics only). */
  rawStart: string
}

/** RFC 5545 line unfolding (continuation lines start with space/tab). */
function unfold(lines: string[]): string[] {
  const out: string[] = []
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1)
    } else if (line.trim() !== '') {
      out.push(line)
    }
  }
  return out
}

function parseDateParam(value: string, userTz: string): { date: Date; allDay: boolean } {
  const v = value.trim()
  const utc = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/)
  if (utc) {
    return {
      date: new Date(Date.UTC(+utc[1], +utc[2] - 1, +utc[3], +utc[4], +utc[5], +utc[6])),
      allDay: false,
    }
  }
  const floating = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/)
  if (floating) {
    const dateKey = `${floating[1]}-${floating[2]}-${floating[3]}`
    return { date: localToUtcDate(dateKey, `${floating[4]}:${floating[5]}`, userTz), allDay: false }
  }
  const dateOnly = v.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (dateOnly) {
    return { date: new Date(Date.UTC(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3])), allDay: true }
  }
  return { date: new Date(Number.NaN), allDay: false }
}

export function parseIcs(raw: string, userTz: string): IcsEvent[] {
  const lines = unfold(raw.split(/\r\n|\n|\r/))
  const events: IcsEvent[] = []
  let current: Record<string, string> | null = null
  let inEvent = false

  for (const line of lines) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const name = line.slice(0, colon).toUpperCase()
    const value = line.slice(colon + 1)

    if (name === 'BEGIN' && value.trim() === 'VEVENT') {
      inEvent = true
      current = {}
      continue
    }
    if (name === 'END' && value.trim() === 'VEVENT') {
      inEvent = false
      const ev = current ?? {}
      current = null
      if (!ev.UID || !ev.DTSTART) continue
      const start = parseDateParam(ev.DTSTART, userTz)
      if (Number.isNaN(start.date.getTime())) continue
      let endAt: Date
      let allDay = start.allDay
      if (ev.DTEND) {
        const end = parseDateParam(ev.DTEND, userTz)
        endAt = end.date
        allDay = allDay && end.allDay
      } else if (allDay) {
        endAt = new Date(start.date.getTime() + 24 * 60 * 60 * 1000)
      } else {
        endAt = new Date(start.date.getTime() + 60 * 60 * 1000)
      }
      events.push({
        uid: ev.UID.trim(),
        summary: ev.SUMMARY?.trim() || '(sans titre)',
        description: ev.DESCRIPTION?.trim() || null,
        location: ev.LOCATION?.trim() || null,
        startAt: start.date,
        endAt,
        allDay,
        rawStart: ev.DTSTART,
      })
      continue
    }
    if (inEvent && current && name !== 'BEGIN' && name !== 'END' && !(name in current)) {
      current[name] = value
    }
  }
  return events
}
