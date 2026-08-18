/**
 * Kininaru Assistant — Intent Router
 *
 * Analyzes user messages to determine intent and route to appropriate agents.
 * Uses pattern matching and keyword detection (no external LLM call needed
 * for basic routing — the LLM handles complex disambiguation).
 */

import type { Intent, IntentCategory } from './types'

/* ------------------------------------------------------------------ */
/* Keyword Patterns                                                    */
/* ------------------------------------------------------------------ */

const INTENT_PATTERNS: Record<IntentCategory, { keywords: RegExp[]; weight: number }> = {
  task: {
    keywords: [
      /\b(tâche|task|ajouter?|créer?|faire|compl[ée]ter?|terminer?|supprimer?|modifier?|marquer?)\b/i,
      /\b(devoirs?|exercices?|travail|étude|études?|rédiger?|écrire?|lire|relire?)\b/i,
      /\b(checklist|todo|liste)\b/i,
    ],
    weight: 1.0,
  },
  calendar: {
    keywords: [
      /\b(événement|rendez-vous|réunion|cours|créneau|calendrier|agenda|heure?)\b/i,
      /\b(demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|semaine|prochaine?)\b/i,
      /\b(18h|19h|20h|matin|après-midi|soir|midi)\b/i,
    ],
    weight: 1.0,
  },
  focus: {
    keywords: [
      /\b(focus|concentration|pomodoro|session|pause|travail intensif?)\b/i,
      /\b(minute|minutes?|25\s*min|45\s*min|90\s*min)\b/i,
    ],
    weight: 0.9,
  },
  habit: {
    keywords: [
      /\b(habitude|routine|quotidien|chaque jour|tous les jours|streak|série)\b/i,
      /\b(méditation|sport|lecture|eau|coucher|lever)\b/i,
    ],
    weight: 0.9,
  },
  goal: {
    keywords: [
      /\b(objectif|but|projet|objectifs|ambition|planification|pr[ée]parer)\b/i,
      /\b(examen|concours|diplôme|certification|sprint|milestone)\b/i,
    ],
    weight: 0.85,
  },
  memory: {
    keywords: [
      /\b(retenir|mémoriser|retiens?|souviens?|note|enregistre?|remember)\b/i,
      /\b(préfère|aime|j'aime|je veux|je préfère)\b/i,
    ],
    weight: 0.8,
  },
  journal: {
    keywords: [
      /\b(journal|diary|note|introspection|ressenti|vécu|refléter?|billet?)\b/i,
    ],
    weight: 0.75,
  },
  analytics: {
    keywords: [
      /\b(statistiques?|stats?|analyse|progression|performance|graphique|bilan|rapport)\b/i,
    ],
    weight: 0.7,
  },
  planning: {
    keywords: [
      /\b(planifier|organiser|plan|programmer|structure|sch[ée]ma|répartir?|réorganiser?)\b/i,
      /\b(semaine|mois|jour|planning|emploi du temps)\b/i,
    ],
    weight: 0.85,
  },
  general: {
    keywords: [
      /\b(explique|comment|pourquoi|qu'est-ce|quelle?|dis-moi|aide)\b/i,
    ],
    weight: 0.3,
  },
}

/* ------------------------------------------------------------------ */
/* Planning Detection                                                  */
/* ------------------------------------------------------------------ */

const PLANNING_KEYWORDS = [
  /\b(planifier|organiser|structurer|programmer)\b/i,
  /\b(cette semaine|la semaine prochaine|demain|aujourd'hui)\b/i,
  /\b(multipl?es?\s+(tâches?|actions?|sessions?))\b/i,
  /\b(r[ée]partir|r[ée]organiser|sprint|phase)\b/i,
]

/* ------------------------------------------------------------------ */
/* Intent Router                                                       */
/* ------------------------------------------------------------------ */

/**
 * Routes a user message to one or more intent categories.
 * Returns the primary intent plus any secondary intents.
 */
export function routeIntent(message: string): Intent {
  const normalizedMessage = message.toLowerCase().trim()
  const scores: Record<IntentCategory, number> = {
    task: 0,
    calendar: 0,
    focus: 0,
    habit: 0,
    goal: 0,
    memory: 0,
    journal: 0,
    analytics: 0,
    planning: 0,
    general: 0,
  }

  // Score each category
  for (const [category, config] of Object.entries(INTENT_PATTERNS)) {
    const cat = category as IntentCategory
    for (const pattern of config.keywords) {
      if (pattern.test(normalizedMessage)) {
        scores[cat] += config.weight
      }
    }
  }

  // Detect planning intent (boost if multiple categories triggered)
  const triggeredCategories = Object.entries(scores)
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])

  const hasPlanningKeywords = PLANNING_KEYWORDS.some(p => p.test(normalizedMessage))
  if (hasPlanningKeywords || triggeredCategories.length >= 2) {
    scores.planning += 0.8
  }

  // Sort by score
  const sorted = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])

  const topScore = sorted[0][1]
  if (topScore === 0) {
    return {
      category: 'general',
      secondaryIntents: [],
      extractedParams: {},
      confidence: 0.5,
      requiresPlanning: false,
    }
  }

  const primaryCategory = sorted[0][0] as IntentCategory
  const secondaryIntents = sorted
    .slice(1, 4)
    .filter(([_, score]) => score > 0.3 && score >= topScore * 0.5)
    .map(([cat]) => cat as IntentCategory)

  // Check if planning is needed
  const requiresPlanning =
    primaryCategory === 'planning' ||
    hasPlanningKeywords ||
    secondaryIntents.length >= 2

  return {
    category: primaryCategory,
    secondaryIntents,
    extractedParams: extractParams(normalizedMessage),
    confidence: Math.min(topScore / 2, 1),
    requiresPlanning,
  }
}

/* ------------------------------------------------------------------ */
/* Parameter Extraction                                                */
/* ------------------------------------------------------------------ */

function extractParams(message: string): Record<string, unknown> {
  const params: Record<string, unknown> = {}

  // Duration extraction
  const durationMatch = message.match(/(\d+)\s*(min|minutes?|h|heures?)/i)
  if (durationMatch) {
    const value = parseInt(durationMatch[1], 10)
    const unit = durationMatch[2].toLowerCase()
    params.duration = unit.startsWith('h') ? value * 60 : value
  }

  // Date extraction
  const datePatterns = [
    { pattern: /\b(aujourd'hui|today)\b/i, value: 'today' },
    { pattern: /\b(demain|tomorrow)\b/i, value: 'tomorrow' },
    { pattern: /\b(apr[èe]s-demain|day after tomorrow)\b/i, value: 'day_after_tomorrow' },
    { pattern: /\b(lundi|monday)\b/i, value: 'next_monday' },
    { pattern: /\b(mardi|tuesday)\b/i, value: 'next_tuesday' },
    { pattern: /\b(mercredi|wednesday)\b/i, value: 'next_wednesday' },
    { pattern: /\b(jeudi|thursday)\b/i, value: 'next_thursday' },
    { pattern: /\b(vendredi|friday)\b/i, value: 'next_friday' },
    { pattern: /\b(samedi|saturday)\b/i, value: 'next_saturday' },
    { pattern: /\b(dimanche|sunday)\b/i, value: 'next_sunday' },
  ]

  for (const { pattern, value } of datePatterns) {
    if (pattern.test(message)) {
      params.date = value
      break
    }
  }

  // Priority extraction
  if (/\b(urgent|très important|critique|ASAP)\b/i.test(message)) {
    params.priority = 'urgent'
  } else if (/\b(important|prioritaire|priorit[ée])\b/i.test(message)) {
    params.priority = 'high'
  } else if (/\b(pas important|peu important|quand j'aurai le temps)\b/i.test(message)) {
    params.priority = 'low'
  }

  // Task type detection
  const taskTypes: Array<{ pattern: RegExp; type: string }> = [
    { pattern: /\b(r[ée]vis(?:er|ion)|exercices?|maths?|physique|chimie|svt|fran[çc]ais|anglais|histoire|g[ée]o)\b/i, type: 'study' },
    { pattern: /\b(mail|email|appel|t[ée]l[ée]phone|rendez-vous|facture|admin)\b/i, type: 'admin' },
    { pattern: /\b(crire|dessiner|projet|id[ée]e|cr[ée]er|design|code)\b/i, type: 'creative' },
    { pattern: /\b(sport|marcher|courir|gym|m[ée]diter|yoga)\b/i, type: 'wellness' },
  ]

  for (const { pattern, type } of taskTypes) {
    if (pattern.test(message)) {
      params.taskType = type
      break
    }
  }

  // Time extraction
  const timeMatch = message.match(/(\d{1,2})\s*h\s*(\d{2})?/i)
  if (timeMatch) {
    const hour = parseInt(timeMatch[1], 10)
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0
    params.time = `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }

  return params
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/**
 * Validates that a plan step references a valid capability and action.
 */
export function validatePlanStep(
  capability: string,
  action: string,
  availableCapabilities: string[]
): { valid: boolean; error?: string } {
  if (!availableCapabilities.includes(capability)) {
    return {
      valid: false,
      error: `Capacité inconnue : ${capability}`,
    }
  }

  const validActions = ['read', 'create', 'update', 'complete', 'delete', 'generate']
  if (!validActions.includes(action)) {
    return {
      valid: false,
      error: `Action inconnue : ${action}`,
    }
  }

  return { valid: true }
}
