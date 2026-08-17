import type { CoachContext, CoachPage } from './context'

/**
 * Coach observation engine — deterministic, zero Groq.
 *
 * ÉTAPE 14, §5-6-37-38: everyday observations must be LOCAL rules over the
 * daily context. Groq is only invoked when the user actually talks to the
 * coach (/api/chat). This keeps costs flat regardless of navigation.
 */

export type CoachStyle = 'calm' | 'encouraging' | 'direct' | 'concise'

export const COACH_STYLES: ReadonlyArray<CoachStyle> = [
  'calm',
  'encouraging',
  'direct',
  'concise',
]

export function isCoachStyle(raw: unknown): raw is CoachStyle {
  return COACH_STYLES.includes(raw as CoachStyle)
}

export type ObservationTone = 'wow' | 'celebration' | 'progress' | 'nudge' | 'neutral'

export interface CoachAction {
  label: string
  href: string
}

export interface Observation {
  id: string
  tone: ObservationTone
  /** Whether this observation deserves a notification (bell / system). */
  notify: boolean
  message: string
  action: CoachAction | null
}

interface Rule {
  id: string
  weight: number
  notify: boolean
  pages?: CoachPage[]
  run: (ctx: CoachContext, page: CoachPage) => string | null
}

const MORNING_WINDOW = [5, 6, 7, 8, 9, 10, 11]

/** Style-aware phrasing — changes the tone, never the rules or the data. */
function applyStyle(message: string, style: CoachStyle, ruleId: string): string {
  if (style === 'concise') return message

  const cheering =
    ruleId === 'progress_done' || ruleId === 'focus_session' || ruleId === 'focus_wow'
  const nudging =
    ruleId === 'priority_remaining' || ruleId === 'overdue' || ruleId === 'habits_left'

  if (style === 'encouraging' && cheering) return `Bravo \u2014 ${message}`
  if (style === 'direct' && cheering) return `Progression : ${message}`
  if (style === 'calm' && nudging)
    return `Une \u00e9tape \u00e0 la fois : ${message[0].toLowerCase()}${message.slice(1)}`
  return message
}

const RULES: Rule[] = [
  {
    // Morning brief (§13): a compact "today" summary. Never invented data.
    id: 'morning_brief',
    weight: 60,
    notify: false,
    pages: ['dashboard'],
    run: (ctx) => {
      if (!MORNING_WINDOW.includes(ctx.hour)) return null
      const bits: string[] = []
      if (ctx.priorityTasksRemaining > 0)
        bits.push(
          `${ctx.priorityTasksRemaining} priorit\u00e9${ctx.priorityTasksRemaining > 1 ? 's' : ''}`
        )
      if (ctx.eventsToday > 0)
        bits.push(`${ctx.eventsToday} \u00e9v\u00e9nement${ctx.eventsToday > 1 ? 's' : ''}`)
      if (ctx.habitsTotal > 0)
        bits.push(`${ctx.habitsTotal} habitude${ctx.habitsTotal > 1 ? 's' : ''}`)
      if (bits.length === 0)
        return 'Aucune priorit\u00e9 ni \u00e9v\u00e9nement de pr\u00e9vu aujourd\u2019hui. Une belle page blanche.'
      return `Bonjour ! Aujourd\u2019hui : ${bits.join(', ')}.`
    },
  },
  {
    // Progress praise (§3): several tasks completed today.
    id: 'progress_done',
    weight: 55,
    notify: true,
    run: (ctx) => {
      if (ctx.tasksCompleted < 3) return null
      return `${ctx.tasksCompleted} t\u00e2che${ctx.tasksCompleted > 1 ? 's' : ''} termin\u00e9e${
        ctx.tasksCompleted > 1 ? 's' : ''
      } aujourd\u2019hui. Belle progression.`
    },
  },
  {
    // Focus wow (§35): a genuinely long session.
    id: 'focus_wow',
    weight: 50,
    notify: true,
    run: (ctx) => {
      if (ctx.focusMinutesToday < 45) return null
      return `${ctx.focusMinutesToday} minutes concentr\u00e9es aujourd\u2019hui. Une vraie avanc\u00e9e.`
    },
  },
  {
    // Priority reminder (§2-3): a high-priority task is still open.
    id: 'priority_remaining',
    weight: 45,
    notify: true,
    pages: ['tasks', 'dashboard'],
    run: (ctx) => {
      if (ctx.priorityTasksRemaining === 0) return null
      return `${ctx.priorityTasksRemaining} t\u00e2che${ctx.priorityTasksRemaining > 1 ? 's' : ''} prioritaire${
        ctx.priorityTasksRemaining > 1 ? 's' : ''
      } encore ouverte${ctx.priorityTasksRemaining > 1 ? 's' : ''}.`
    },
  },
  {
    // Overdue tasks (§3): a gentle, non-blaming replan suggestion.
    id: 'overdue',
    weight: 40,
    notify: true,
    pages: ['tasks'],
    run: (ctx) => {
      if (ctx.tasksOverdue === 0) return null
      return `${ctx.tasksOverdue} t\u00e2che${ctx.tasksOverdue > 1 ? 's' : ''} en retard. On les re-planifie ensemble ?`
    },
  },
  {
    // Evening review (§3-12): end-of-day check-in suggestion.
    id: 'evening_review',
    weight: 38,
    notify: false,
    run: (ctx) => {
      if (ctx.hour < 19) return null
      if (ctx.tasksCompleted === 0 && ctx.focusMinutesToday === 0 && ctx.habitsDoneToday === 0)
        return null
      return 'La journ\u00e9e touche \u00e0 sa fin. Un petit bilan de ta journ\u00e9e ?'
    },
  },
  {
    // Afternoon gap (§3): nothing planned after lunch.
    id: 'afternoon_gap',
    weight: 34,
    notify: false,
    run: (ctx) => {
      if (ctx.hour < 13 || ctx.hour > 17) return null
      if (ctx.tasksToday > 0 || ctx.eventsToday > 0 || ctx.habitsTotal > 0) return null
      return 'Rien de pr\u00e9vu pour cet apr\u00e8s-midi. On pr\u00e9pare la suite ?'
    },
  },
  {
    // Busy day (§3): many events — a clear priority helps.
    id: 'busy_day',
    weight: 32,
    notify: false,
    pages: ['calendar', 'dashboard'],
    run: (ctx) => {
      if (ctx.eventsToday < 3) return null
      return `Journ\u00e9e charg\u00e9e : ${ctx.eventsToday} \u00e9v\u00e9nement${
        ctx.eventsToday > 1 ? 's' : ''
      }. Une priorit\u00e9 claire t\u2019aidera \u00e0 avancer.`
    },
  },
  {
    // Habits nudge (§5 habits page, §3): routine not fully checked.
    id: 'habits_left',
    weight: 30,
    notify: true,
    pages: ['habits'],
    run: (ctx) => {
      const left = ctx.habitsTotal - ctx.habitsDoneToday
      if (ctx.habitsTotal === 0 || left <= 0) return null
      return `${ctx.habitsDoneToday}/${ctx.habitsTotal} habitude${
        ctx.habitsTotal > 1 ? 's' : ''
      } coch\u00e9e${ctx.habitsTotal > 1 ? 's' : ''} aujourd\u2019hui. Il en reste ${left}.`
    },
  },
  {
    // Focus page (§5): celebrate today's sessions.
    id: 'focus_session',
    weight: 28,
    notify: false,
    pages: ['focus'],
    run: (ctx) => {
      if (ctx.focusMinutesToday === 0) return null
      return `${ctx.focusMinutesToday} min de Focus aujourd\u2019hui. Ta concentration progresse.`
    },
  },
  {
    // Family page (§5): invite to act together.
    id: 'family',
    weight: 22,
    notify: false,
    pages: ['family'],
    run: (ctx) => {
      if (!ctx.hasFamily) return null
      return 'Ta famille est pr\u00eate. Une t\u00e2che ou un \u00e9v\u00e9nement partag\u00e9 ?'
    },
  },
  {
    // Gentle restart (Phase 1 — mobile/Android): after a missed or slow
    // start, never blame. Morning only, backed by real data (open overdue
    // tasks, nothing completed yet today).
    id: 'gentle_restart',
    weight: 33,
    notify: false,
    pages: ['dashboard', 'tasks'],
    run: (ctx) => {
      if (ctx.hour > 12 || ctx.hour < 5) return null
      if (ctx.tasksOverdue === 0 || ctx.tasksCompleted > 0) return null
      return 'Pas grave si hier a été compliqué. On reprend aujourd\u2019hui, une étape à la fois.'
    },
  },
  {
    // Empty-day fallback (§13): never invent data, offer the coach instead.
    id: 'fresh_day',
    weight: 10,
    notify: false,
    run: (ctx) => {
      if (
        ctx.tasksToday > 0 ||
        ctx.tasksCompleted > 0 ||
        ctx.habitsTotal > 0 ||
        ctx.eventsToday > 0 ||
        ctx.focusMinutesToday > 0
      )
        return null
      return 'Tout est calme. Je peux t\u2019aider \u00e0 planifier ta journ\u00e9e.'
    },
  },
]

const ACTIONS: Record<string, CoachAction | null> = {
  morning_brief: null,
  progress_done: null,
  focus_wow: null,
  priority_remaining: { label: 'Voir ma priorit\u00e9', href: '/tasks' },
  overdue: { label: 'Re-planifier', href: '/tasks' },
  evening_review: { label: 'Faire un bilan', href: '/ai' },
  afternoon_gap: { label: 'Pr\u00e9parer la suite', href: '/ai' },
  busy_day: { label: 'Voir mon agenda', href: '/calendar' },
  gentle_restart: { label: 'Voir mes priorités', href: '/tasks' },
  habits_left: { label: 'Mes habitudes', href: '/habits' },
  focus_session: { label: 'Nouvelle session', href: '/focus' },
  family: { label: 'Ma famille', href: '/family' },
  fresh_day: { label: 'Parler au coach', href: '/ai' },
}

function toneFor(id: string): ObservationTone {
  switch (id) {
    case 'focus_wow':
      return 'wow'
    case 'progress_done':
    case 'focus_session':
      return 'celebration'
    case 'busy_day':
      return 'progress'
    case 'priority_remaining':
    case 'overdue':
    case 'habits_left':
      return 'nudge'
    default:
      return 'neutral'
  }
}

/**
 * Evaluates all rules and returns the top observations (max 2) for the given
 * page. Page-specific rules get a small boost so the coach feels local.
 */
export function evaluateContext(
  ctx: CoachContext,
  page: CoachPage,
  style: CoachStyle
): Observation[] {
  const scored: { rule: Rule; message: string; weight: number }[] = []

  for (const rule of RULES) {
    const message = rule.run(ctx, page)
    if (!message) continue
    const weight = rule.pages?.includes(page) ? rule.weight + 8 : rule.weight
    scored.push({ rule, message, weight })
  }

  scored.sort((a, b) => b.weight - a.weight)

  return scored.slice(0, 2).map(({ rule, message }) => ({
    id: rule.id,
    tone: toneFor(rule.id),
    notify: rule.notify,
    message: applyStyle(message, style, rule.id),
    action: ACTIONS[rule.id] ?? null,
  }))
}
