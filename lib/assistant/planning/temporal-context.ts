/**
 * Kininaru Assistant — Temporal Context
 *
 * Provides time-aware context for planning:
 * - Current time period (morning/afternoon/evening)
 * - Available time slots between events
 * - Daily load assessment
 * - Time until next event
 *
 * All calculations are deterministic and based on real data.
 */

import { format, differenceInMinutes, parseISO, isAfter, isBefore } from 'date-fns'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type TimePeriod = 'early_morning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night'

export interface TimeSlot {
  start: Date
  end: Date
  durationMinutes: number
  label: string
}

export interface TemporalContext {
  /** Current time period */
  period: TimePeriod
  /** Current hour (0-23) */
  hour: number
  /** Current minute (0-59) */
  minute: number
  /** Day of week (0=Sunday, 6=Saturday) */
  dayOfWeek: number
  /** Is it a weekday */
  isWeekday: boolean
  /** Available time slots until end of day */
  availableSlots: TimeSlot[]
  /** Minutes until next event */
  minutesUntilNextEvent: number | null
  /** Next event info */
  nextEvent: { title: string; startAt: Date } | null
  /** Daily load score (0-100) */
  dailyLoad: number
  /** Recommended focus duration based on availability */
  recommendedFocusMinutes: number
}

/* ------------------------------------------------------------------ */
/* Time Period Detection                                               */
/* ------------------------------------------------------------------ */

function getTimePeriod(hour: number): TimePeriod {
  if (hour < 6) return 'night'
  if (hour < 9) return 'early_morning'
  if (hour < 12) return 'morning'
  if (hour < 14) return 'midday'
  if (hour < 18) return 'afternoon'
  if (hour < 21) return 'evening'
  return 'night'
}

/* ------------------------------------------------------------------ */
/* Availability Calculator                                             */
/* ------------------------------------------------------------------ */

/**
 * Calculates available time slots between events.
 * Assumes events have start_at and end_at in ISO format.
 */
export function calculateAvailableSlots(
  events: Array<{ start_at: string; end_at: string }>,
  now: Date,
  endOfDayHour = 22
): TimeSlot[] {
  const slots: TimeSlot[] = []
  const dayEnd = new Date(now)
  dayEnd.setHours(endOfDayHour, 0, 0, 0)

  // Sort events by start time
  const sortedEvents = [...events]
    .map(e => ({
      start: parseISO(e.start_at),
      end: parseISO(e.end_at),
    }))
    .filter(e => isAfter(e.start, now) || (isAfter(e.end, now) && isBefore(e.start, now)))
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  let cursor = new Date(now)

  for (const event of sortedEvents) {
    const eventStart = isBefore(event.start, now) ? now : event.start

    if (isAfter(eventStart, cursor)) {
      const duration = differenceInMinutes(eventStart, cursor)
      if (duration >= 15) { // Minimum 15-minute slot
        slots.push({
          start: new Date(cursor),
          end: new Date(eventStart),
          durationMinutes: duration,
          label: `${format(cursor, 'HH:mm')} → ${format(eventStart, 'HH:mm')}`,
        })
      }
    }

    cursor = isAfter(event.end, cursor) ? event.end : cursor
  }

  // Add remaining time until end of day
  if (isAfter(dayEnd, cursor)) {
    const duration = differenceInMinutes(dayEnd, cursor)
    if (duration >= 15) {
      slots.push({
        start: new Date(cursor),
        end: dayEnd,
        durationMinutes: duration,
        label: `${format(cursor, 'HH:mm')} → ${format(dayEnd, 'HH:mm')} (fin de journée)`,
      })
    }
  }

  return slots
}

/* ------------------------------------------------------------------ */
/* Daily Load Calculator                                               */
/* ------------------------------------------------------------------ */

/**
 * Calculates a daily load score based on tasks, events, habits, and focus.
 * Score is 0-100 where:
 * - 0-30: light day
 * - 30-60: moderate day
 * - 60-80: busy day
 * - 80+: very busy day
 */
export function calculateDailyLoad(params: {
  tasksToday: number
  tasksOverdue: number
  eventsToday: number
  habitsTotal: number
  habitsDone: number
  focusTodayMinutes: number
  urgentTasks: number
}): number {
  const {
    tasksToday,
    tasksOverdue,
    eventsToday,
    habitsTotal,
    habitsDone,
    focusTodayMinutes,
    urgentTasks,
  } = params

  let score = 0

  // Tasks contribution (max 35)
  score += Math.min(tasksToday * 3, 20)
  score += Math.min(tasksOverdue * 5, 15)

  // Events contribution (max 25)
  score += Math.min(eventsToday * 8, 25)

  // Habits contribution (max 20)
  const habitsRemaining = habitsTotal - habitsDone
  score += Math.min(habitsRemaining * 4, 20)

  // Focus contribution (max 10)
  score += Math.min(focusTodayMinutes / 30, 10)

  // Urgent tasks bonus (max 10)
  score += Math.min(urgentTasks * 5, 10)

  return Math.min(Math.round(score), 100)
}

/* ------------------------------------------------------------------ */
/* Main Builder                                                        */
/* ------------------------------------------------------------------ */

/**
 * Builds the temporal context for the current moment.
 */
export function buildTemporalContext(params: {
  events: Array<{ start_at: string; end_at: string }>
  tasksToday: number
  tasksOverdue: number
  habitsTotal: number
  habitsDone: number
  focusTodayMinutes: number
  urgentTasks: number
}): TemporalContext {
  const now = new Date()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const dayOfWeek = now.getDay()

  const period = getTimePeriod(hour)
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5

  // Calculate available slots
  const availableSlots = calculateAvailableSlots(params.events, now)

  // Find next event
  const nextEvent = params.events
    .map(e => ({ title: e.start_at, startAt: parseISO(e.start_at) }))
    .filter(e => isAfter(e.startAt, now))
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())[0] ?? null

  const minutesUntilNextEvent = nextEvent
    ? differenceInMinutes(nextEvent.startAt, now)
    : null

  // Calculate daily load
  const dailyLoad = calculateDailyLoad({
    tasksToday: params.tasksToday,
    tasksOverdue: params.tasksOverdue,
    eventsToday: params.events.length,
    habitsTotal: params.habitsTotal,
    habitsDone: params.habitsDone,
    focusTodayMinutes: params.focusTodayMinutes,
    urgentTasks: params.urgentTasks,
  })

  // Recommend focus duration based on availability
  const maxSlot = availableSlots.reduce(
    (max, slot) => slot.durationMinutes > max.durationMinutes ? slot : max,
    { durationMinutes: 0 } as TimeSlot
  )

  let recommendedFocusMinutes = 25 // Default Pomodoro
  if (maxSlot.durationMinutes >= 90) {
    recommendedFocusMinutes = 90
  } else if (maxSlot.durationMinutes >= 45) {
    recommendedFocusMinutes = 45
  } else if (maxSlot.durationMinutes >= 25) {
    recommendedFocusMinutes = 25
  } else if (maxSlot.durationMinutes >= 15) {
    recommendedFocusMinutes = 15
  }

  return {
    period,
    hour,
    minute,
    dayOfWeek,
    isWeekday,
    availableSlots,
    minutesUntilNextEvent,
    nextEvent: nextEvent ? { title: 'Événement', startAt: nextEvent.startAt } : null,
    dailyLoad,
    recommendedFocusMinutes,
  }
}
