/**
 * LEARN / ADAPT — analyse de progression sur DONNÉES RÉELLES uniquement.
 *
 * Aucun chiffre inventé : chaque insight est calculé à partir des tâches,
 * sessions Focus et logs d'habitudes réellement en base. Les seuils
 * minimaux évitent le bruit (pas d'insight sur 2 données). Les suggestions
 * restent des SUGGESTIONS — jamais de modification automatique du planning.
 */

export interface InsightTask {
  title: string
  priority: string | null
  status: string
  due_date: string | null
  scheduled_time?: string | null
  completed_at: string | null
}

export interface InsightFocus {
  duration_minutes: number | null
  created_at: string | null
}

export interface InsightInput {
  tasks: InsightTask[]
  focusSessions: InsightFocus[]
  habitLogs: { logged_date: string }[]
  /** AAAA-MM-JJ */
  today: string
  /** AAAA-MM-JJ */
  tomorrow: string
}

export interface CoachInsight {
  id: string
  emoji: string
  title: string
  detail: string
  action?: { label: string; href: string }
}

function dayKey(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function addDaysKey(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Moments de concentration : matin / après-midi / soir (heure locale du serveur). */
function focusByPeriod(sessions: InsightFocus[]): { morning: number; afternoon: number; evening: number; count: number } {
  const acc = { morning: 0, afternoon: 0, evening: 0, count: 0 }
  for (const s of sessions) {
    if (!s.created_at || !s.duration_minutes) continue
    const h = new Date(s.created_at).getHours()
    acc.count++
    if (h < 12) acc.morning += s.duration_minutes
    else if (h < 18) acc.afternoon += s.duration_minutes
    else acc.evening += s.duration_minutes
  }
  return acc
}

export function computeInsights(input: InsightInput): CoachInsight[] {
  const out: CoachInsight[] = []
  const { tasks, focusSessions, habitLogs, today, tomorrow } = input

  /* --- 1. Meilleur moment de concentration ---------------------------- */
  const periods = focusByPeriod(focusSessions)
  const totalFocus = periods.morning + periods.afternoon + periods.evening
  if (periods.count >= 3 && totalFocus > 0) {
    const best = (
      [
        ['matin', periods.morning],
        ['après-midi', periods.afternoon],
        ['soir', periods.evening],
      ] as [string, number][]
    ).sort((a, b) => b[1] - a[1])[0]
    const share = Math.round((best[1] / totalFocus) * 100)
    if (share >= 60) {
      out.push({
        id: 'best_focus_period',
        emoji: '🧠',
        title: `Ton moment le plus concentré : le ${best[0]}`,
        detail: `${best[1]} min de Focus le ${best[0]} sur cette semaine (${share} % de ton temps).`,
        action: { label: 'Nouvelle session', href: '/focus' },
      })
    }
  }

  /* --- 2. Tendance de complétion (cette semaine vs précédente) --------- */
  const weekStart = addDaysKey(today, -6)
  const prevStart = addDaysKey(today, -13)
  const thisWeek = tasks.filter((t) => {
    const k = dayKey(t.completed_at)
    return k !== null && k >= weekStart && k <= today && t.status === 'done'
  }).length
  const prevWeek = tasks.filter((t) => {
    const k = dayKey(t.completed_at)
    return k !== null && k >= prevStart && k < weekStart && t.status === 'done'
  }).length
  if (thisWeek > 0 || prevWeek > 0) {
    if (thisWeek >= prevWeek && thisWeek > 0) {
      out.push({
        id: 'completion_trend',
        emoji: '📈',
        title: `Tu as terminé ${thisWeek} tâche${thisWeek > 1 ? 's' : ''} cette semaine`,
        detail:
          prevWeek > 0
            ? `Contre ${prevWeek} la semaine précédente. La régularité paie.`
            : 'Une belle semaine d’action.',
        action: { label: 'Voir les analyses', href: '/analytics' },
      })
    } else if (prevWeek > 0) {
      out.push({
        id: 'calmer_week',
        emoji: '🌱',
        title: 'Une semaine plus calme — pas grave',
        detail: `${thisWeek} tâche${thisWeek > 1 ? 's' : ''} terminée${thisWeek > 1 ? 's' : ''} cette semaine contre ${prevWeek} la précédente. On reprend, une étape à la fois.`,
        action: { label: 'Voir les analyses', href: '/analytics' },
      })
    }
  }

  /* --- 3. Habitudes : régularité --------------------------------------- */
  const loggedThisWeek = habitLogs.filter((l) => l.logged_date >= weekStart && l.logged_date <= today).length
  if (loggedThisWeek >= 4) {
    out.push({
      id: 'habit_streak',
      emoji: '🔥',
      title: `${loggedThisWeek} journées avec tes habitudes cochées`,
      detail: 'La répétition construit les résultats — continue doucement.',
      action: { label: 'Mes habitudes', href: '/habits' },
    })
  }

  /* --- 4. Demain pourrait être… (suggestion, jamais de modif auto) ----- */
  const tomorrowTasks = tasks.filter((t) => t.due_date === tomorrow && t.status !== 'done')
  if (tomorrowTasks.length > 0) {
    const priorities = tomorrowTasks.filter(
      (t) => t.priority === 'high' || t.priority === 'urgent'
    )
    const firstPriority = tomorrowTasks
      .filter((t) => t.scheduled_time)
      .sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? ''))[0]
    out.push({
      id: 'tomorrow_plan',
      emoji: '🌅',
      title: `Demain : ${tomorrowTasks.length} tâche${tomorrowTasks.length > 1 ? 's' : ''}${
        priorities.length > 0 ? `, dont ${priorities.length} prioritaire${priorities.length > 1 ? 's' : ''}` : ''
      }`,
      detail:
        firstPriority && priorities.length > 0
          ? `Commence par « ${firstPriority.title} » à ${firstPriority.scheduled_time?.slice(0, 5)} — ton créneau le plus tôt.`
          : priorities.length > 0
            ? 'Prépare ta priorité dès le matin : c’est le moment où tu avances le mieux.'
            : 'Une page blanche à organiser — le coach peut t’aider à la construire.',
      action: { label: 'Voir demain', href: '/tasks' },
    })
  }

  return out
}
