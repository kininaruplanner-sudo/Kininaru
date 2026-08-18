/**
 * Kininaru Assistant — Next Action Engine
 *
 * Deterministic engine for selecting the single best next action.
 * Uses scoring based on multiple factors, all explainable.
 *
 * Architecture:
 *   Candidate Actions
 *          ↓
 *   Scoring (urgency, priority, time fit, goal relevance, context)
 *          ↓
 *   Best Candidate
 *          ↓
 *   Next Action (single, clear)
 */

import type { ContextData, TaskInfo, HabitInfo, GoalInfo } from '../context-builder'
import type { TemporalContext } from './temporal-context'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface NextActionCandidate {
  id: string
  title: string
  type: 'task' | 'habit' | 'focus' | 'goal'
  /** Estimated duration in minutes (null if unknown) */
  estimatedMinutes: number | null
  /** Priority level */
  priority: string
  /** Due date (for tasks) */
  dueDate: string | null
  /** Goal ID if linked to a goal */
  goalId?: string
  /** Goal title if linked */
  goalTitle?: string
  /** Reason for consideration */
  reason: string
}

export interface NextActionScore {
  /** Urgency score (0-30): how urgent is this action? */
  urgency: number
  /** Priority score (0-25): how important is this action? */
  priority: number
  /** Time fit score (0-20): does it fit available time? */
  timeFit: number
  /** Goal relevance score (0-15): does it contribute to a goal? */
  goalRelevance: number
  /** Context fit score (0-10): does it fit the current moment? */
  contextFit: number
  /** Total score (0-100) */
  total: number
}

export interface NextAction {
  candidate: NextActionCandidate
  score: NextActionScore
  /** Human-readable explanation of why this was chosen */
  explanation: string
}

/* ------------------------------------------------------------------ */
/* Scoring Coefficients                                                */
/* ------------------------------------------------------------------ */

const WEIGHTS = {
  urgency: 30,
  priority: 25,
  timeFit: 20,
  goalRelevance: 15,
  contextFit: 10,
} as const

/* ------------------------------------------------------------------ */
/* Scoring Functions                                                   */
/* ------------------------------------------------------------------ */

function scoreUrgency(candidate: NextActionCandidate, temporal: TemporalContext): number {
  let score = 0

  // Overdue tasks get highest urgency
  if (candidate.dueDate) {
    const due = new Date(candidate.dueDate)
    const now = new Date()
    const daysOverdue = Math.floor((now.getTime() - due.getTime()) / (24 * 60 * 60 * 1000))

    if (daysOverdue > 0) {
      score = Math.min(30, 20 + daysOverdue * 2)
    } else if (daysOverdue === 0) {
      score = 25 // Due today
    } else if (daysOverdue === -1) {
      score = 15 // Due tomorrow
    }
  }

  // Urgent/high priority tasks get urgency boost
  if (candidate.priority === 'urgent') {
    score = Math.max(score, 28)
  } else if (candidate.priority === 'high') {
    score = Math.max(score, 22)
  }

  return Math.min(score, 30)
}

function scorePriority(candidate: NextActionCandidate): number {
  const priorityMap: Record<string, number> = {
    urgent: 25,
    high: 20,
    medium: 12,
    low: 5,
  }
  return priorityMap[candidate.priority] ?? 10
}

function scoreTimeFit(candidate: NextActionCandidate, temporal: TemporalContext): number {
  if (!candidate.estimatedMinutes) return 10 // Unknown duration, neutral score

  const duration = candidate.estimatedMinutes

  // Find best fitting slot
  let bestFit = 0
  for (const slot of temporal.availableSlots) {
    if (slot.durationMinutes >= duration) {
      // Perfect fit: slot is close to task duration
      const fitRatio = duration / slot.durationMinutes
      const fitScore = fitRatio > 0.8 ? 20 : fitRatio > 0.5 ? 15 : 10
      bestFit = Math.max(bestFit, fitScore)
    }
  }

  // If there's a next event soon, penalize long tasks
  if (temporal.minutesUntilNextEvent !== null) {
    if (duration > temporal.minutesUntilNextEvent) {
      bestFit = Math.min(bestFit, 5) // Won't finish before event
    }
  }

  return Math.min(bestFit, 20)
}

function scoreGoalRelevance(candidate: NextActionCandidate, goals: GoalInfo[]): number {
  if (!candidate.goalId) return 0

  const goal = goals.find(g => g.id === candidate.goalId)
  if (!goal) return 0

  // Higher score for goals with closer deadlines
  if (goal.target_date) {
    const target = new Date(goal.target_date)
    const now = new Date()
    const daysUntil = Math.floor((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))

    if (daysUntil <= 3) return 15 // Goal deadline approaching
    if (daysUntil <= 7) return 12
    if (daysUntil <= 14) return 8
  }

  // Higher score for goals with less progress
  if (goal.progress < 50) return 10
  if (goal.progress < 80) return 7

  return 5
}

function scoreContextFit(candidate: NextActionCandidate, temporal: TemporalContext): number {
  let score = 5 // Base score

  // Morning: productivity tasks score higher
  if (temporal.period === 'morning' && candidate.type === 'task') {
    score += 3
  }

  // Afternoon: focus sessions score higher
  if (temporal.period === 'afternoon' && candidate.type === 'focus') {
    score += 3
  }

  // Evening: habits score higher
  if (temporal.period === 'evening' && candidate.type === 'habit') {
    score += 3
  }

  // Light day: more flexibility
  if (temporal.dailyLoad < 30) {
    score += 2
  }

  return Math.min(score, 10)
}

/* ------------------------------------------------------------------ */
/* Candidate Generation                                                */
/* ------------------------------------------------------------------ */

function generateCandidates(
  data: ContextData,
  temporal: TemporalContext
): NextActionCandidate[] {
  const candidates: NextActionCandidate[] = []

  // 1. Overdue tasks (highest priority)
  for (const task of data.tasks.overdue.slice(0, 3)) {
    candidates.push({
      id: task.id,
      title: task.title,
      type: 'task',
      estimatedMinutes: 25, // Default estimate
      priority: task.priority,
      dueDate: task.due_date,
      reason: 'En retard',
    })
  }

  // 2. Today's tasks (priority sorted)
  const todayTasks = [...data.tasks.today]
    .sort((a, b) => {
      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
      return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
    })

  for (const task of todayTasks.slice(0, 5)) {
    // Skip if already in candidates (overdue)
    if (candidates.some(c => c.id === task.id)) continue

    candidates.push({
      id: task.id,
      title: task.title,
      type: 'task',
      estimatedMinutes: task.scheduled_time ? 30 : 25,
      priority: task.priority,
      dueDate: task.due_date,
      reason: 'Tâche du jour',
    })
  }

  // 3. Pending habits
  for (const habit of data.habits.list.filter(h => !h.done_today).slice(0, 3)) {
    candidates.push({
      id: habit.id,
      title: habit.title,
      type: 'habit',
      estimatedMinutes: 10,
      priority: 'medium',
      dueDate: null,
      reason: 'Habitude non cochée',
    })
  }

  // 4. Focus session suggestion
  if (temporal.recommendedFocusMinutes >= 15 && data.focus.todayMinutes === 0) {
    candidates.push({
      id: 'focus-suggestion',
      title: `Session de focus (${temporal.recommendedFocusMinutes} min)`,
      type: 'focus',
      estimatedMinutes: temporal.recommendedFocusMinutes,
      priority: 'medium',
      dueDate: null,
      reason: 'Aucun focus aujourd\'hui',
    })
  }

  return candidates
}

/* ------------------------------------------------------------------ */
/* Main Engine                                                         */
/* ------------------------------------------------------------------ */

/**
 * Selects the single best next action for the user.
 *
 * @param data - Context data from the context builder
 * @param temporal - Temporal context
 * @param goals - Active goals
 * @returns The best next action, or null if no candidates
 */
export function selectNextAction(
  data: ContextData,
  temporal: TemporalContext,
  goals: GoalInfo[]
): NextAction | null {
  const candidates = generateCandidates(data, temporal)

  if (candidates.length === 0) return null

  // Score each candidate
  const scored = candidates.map(candidate => {
    const urgency = scoreUrgency(candidate, temporal)
    const priority = scorePriority(candidate)
    const timeFit = scoreTimeFit(candidate, temporal)
    const goalRelevance = scoreGoalRelevance(candidate, goals)
    const contextFit = scoreContextFit(candidate, temporal)

    const total = Math.round(
      (urgency / WEIGHTS.urgency) * 100 +
      (priority / WEIGHTS.priority) * 100 +
      (timeFit / WEIGHTS.timeFit) * 100 +
      (goalRelevance / WEIGHTS.goalRelevance) * 100 +
      (contextFit / WEIGHTS.contextFit) * 100
    ) / 5

    return {
      candidate,
      score: { urgency, priority, timeFit, goalRelevance, contextFit, total },
    }
  })

  // Sort by total score descending
  scored.sort((a, b) => b.score.total - a.score.total)

  const best = scored[0]
  if (!best) return null

  // Generate explanation
  const explanation = generateExplanation(best.candidate, best.score, temporal)

  return {
    candidate: best.candidate,
    score: best.score,
    explanation,
  }
}

/**
 * Generates a human-readable explanation for why this action was chosen.
 */
function generateExplanation(
  candidate: NextActionCandidate,
  score: NextActionScore,
  temporal: TemporalContext
): string {
  const reasons: string[] = []

  if (score.urgency >= 20) {
    reasons.push('cette action est urgente')
  }

  if (score.timeFit >= 15) {
    reasons.push('elle correspond au temps disponible')
  } else if (score.timeFit <= 5 && candidate.estimatedMinutes && temporal.minutesUntilNextEvent) {
    reasons.push(`elle nécessite ${candidate.estimatedMinutes} min mais ton prochain événement est dans ${temporal.minutesUntilNextEvent} min`)
  }

  if (score.goalRelevance >= 10) {
    reasons.push('elle contribue à un objectif important')
  }

  if (score.contextFit >= 8) {
    reasons.push('elle est pertinente pour ce moment de la journée')
  }

  if (reasons.length === 0) {
    reasons.push('c\'est la prochaine action prioritaire')
  }

  return reasons.join(', ').charAt(0).toUpperCase() + reasons.join(', ').slice(1)
}
