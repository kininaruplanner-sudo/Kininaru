/**
 * Kininaru Assistant — Memory Retrieval (Phase 10)
 *
 * Retrieves relevant memories based on the current conversation context.
 *
 * Architecture:
 *   User Message
 *        ↓
 *   Context Extraction
 *        ↓
 *   Candidate Selection (category + importance filters)
 *        ↓
 *   Relevance Scoring (semantic + recency + importance + context + access)
 *        ↓
 *   Top-N Selection
 *        ↓
 *   Deduplication
 *        ↓
 *   Final Relevant Memories
 *
 * Design principles:
 * - No external API calls (pure algorithm)
 * - Fast: no async, no DB queries
 * - Explainable scores
 * - Privacy-first (no sensitive data)
 */

import type {
  Memory,
  MemoryQuery,
  MemoryRelevanceScore,
  MemoryImportance,
} from './types'
import {
  RECENT_MEMORY_MS,
  MAX_RECENCY_MS,
  MIN_RELEVANCE_SCORE,
  INJECTION_PATTERNS,
  SENSITIVE_PATTERNS,
} from './types'

/* ------------------------------------------------------------------ */
/* Stop Words (French + English)                                       */
/* ------------------------------------------------------------------ */

const STOP_WORDS = new Set([
  // French
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'est',
  'sont', 'a', 'ai', 'as', 'avons', 'avez', 'ont', 'je', 'tu', 'il',
  'elle', 'nous', 'vous', 'ils', 'elles', 'me', 'te', 'se', 'lui',
  'leur', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses',
  'notre', 'votre', 'ce', 'cette', 'ces', 'qui', 'que', 'quoi', 'dont',
  'où', 'comment', 'pourquoi', 'quand', 'combien', 'quel', 'quelle',
  'ne', 'pas', 'plus', 'moins', 'très', 'bien', 'mal', 'aussi',
  'encore', 'déjà', 'toujours', 'jamais', 'peut', 'doit', 'faut', 'fait',
  'faire', 'dit', 'dire', 'va', 'aller', 'voir', 'prendre', 'donner',
  'mettre', 'venir', 'pouvoir', 'vouloir', 'savoir', 'croire', 'penser',
  'aimer', 'trouver', 'rester', 'passer', 'partir', 'arriver', 'entrer',
  'sortir', 'tomber', 'devenir', 'tenir', 'parler', 'demander', 'répondre',
  'écouter', 'regarder', 'chercher', 'essayer', 'commencer', 'continuer',
  'finir', 'arrêter', 'attendre', 'perdre', 'gagner', 'acheter', 'vendre',
  'payer', 'coûter', 'lire', 'écrire', 'apprendre', 'enseigner', 'travailler',
  // English
  'the', 'is', 'are', 'was', 'were', 'have', 'has', 'had', 'do', 'does',
  'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can',
  'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'not', 'only', 'own', 'same', 'than', 'too', 'very',
  'just', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for',
  'with', 'about', 'against', 'between', 'through', 'during', 'before',
  'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out',
  'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once',
  'here', 'there', 'it', 'its', 'this', 'that', 'these', 'those',
  'my', 'your', 'his', 'her', 'our', 'their', 'me', 'him', 'us', 'them',
  'i', 'you', 'he', 'she', 'we', 'they', 'am', 'been', 'being',
  'if', 'or', 'but', 'and', 'so', 'yet', 'nor',
])

/* ------------------------------------------------------------------ */
/* Category Keywords (for semantic matching)                           */
/* ------------------------------------------------------------------ */

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  goal: [
    'objectif', 'but', 'projet', 'vision', 'ambition', 'plan', 'étude',
    'revoir', 'apprendre', 'candidature', 'emploi', 'carrière', 'examen',
    'préparer', 'diplôme', ' certification', 'recherche',
  ],
  preference: [
    'préfère', 'aimer', 'habitude', 'routine', 'horaire', 'horaires',
    'soir', 'matin', 'après-midi', 'calme', 'musique', 'silence', 'bruit',
    'travailler', 'étudier', 'focaliser', 'organiser', 'planifier',
  ],
  habit: [
    'habitude', 'routine', 'quotidien', 'chaque jour', 'série', 'chaîne',
    'streak', 'méditation', 'sport', 'lecture', 'yoga', 'marche',
  ],
  fact: [
    'travaille', 'étudie', 'école', 'université', 'famille', 'ville',
    'profession', 'emploi', 'âge', 'nationalité', 'langue',
  ],
  schedule: [
    'horaire', 'planning', 'calendrier', 'rendez-vous', 'réunion',
    'cours', 'emploi du temps', 'créneau', 'disponible',
  ],
  habit_context: [
    'habitude', 'routine', 'fréquence', 'régulier', 'quotidien',
    'chaque jour', 'hebdomadaire', 'mensuel',
  ],
  context: [],
  conversation_summary: [],
}

/* ------------------------------------------------------------------ */
/* Stop Word Removal                                                    */
/* ------------------------------------------------------------------ */

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\sàâäéèêëïîôùûüÿçœæ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w))
}

/* ------------------------------------------------------------------ */
/* Relevance Scoring                                                   */
/* ------------------------------------------------------------------ */

/**
 * Scores semantic relevance between a memory and the user's query.
 * Uses keyword matching with category weighting.
 */
function scoreSemantic(memory: Memory, queryWords: string[]): number {
  let score = 0
  const memoryWords = memory.keywords.length > 0
    ? memory.keywords
    : extractKeywords(memory.content)

  // Category bonus: if memory category matches query topic
  const categoryKws = CATEGORY_KEYWORDS[memory.category] ?? []
  for (const word of queryWords) {
    if (categoryKws.some(kw => word.includes(kw) || kw.includes(word))) {
      score += 3
    }
  }

  // Direct keyword match
  for (const word of queryWords) {
    if (memoryWords.some(mw => mw.includes(word) || word.includes(mw))) {
      score += 2
    }
  }

  // Content match (memory contains query words)
  const contentLower = memory.content.toLowerCase()
  for (const word of queryWords) {
    if (contentLower.includes(word)) {
      score += 1
    }
  }

  return Math.min(score, 40) // Cap at 40
}

/**
 * Scores recency — newer memories are more relevant.
 */
function scoreRecency(memory: Memory, now: number): number {
  const age = now - memory.createdAt
  if (age <= RECENT_MEMORY_MS) return 20 // Last 7 days
  if (age <= MAX_RECENCY_MS) return 10 // Last 30 days
  return 5 // Older
}

/**
 * Scores importance level.
 */
function scoreImportance(memory: Memory): number {
  const map: Record<MemoryImportance, number> = {
    high: 15,
    medium: 10,
    low: 5,
  }
  return map[memory.importance] ?? 5
}

/**
 * Scores context match — does the memory fit the current time/context?
 */
function scoreContextMatch(memory: Memory): number {
  let score = 5 // Base score

  const now = new Date()
  const hour = now.getHours()
  // Schedule-related memories are more relevant during planning hours
  if (memory.category === 'schedule' && (hour < 10 || hour > 16)) {
    score += 3
  }

  // Habit context is relevant all day
  if (memory.category === 'habit_context') {
    score += 2
  }

  // Goals are always somewhat relevant
  if (memory.category === 'goal') {
    score += 2
  }

  return Math.min(score, 15)
}

/**
 * Scores access frequency — frequently accessed memories are more useful.
 */
function scoreAccessFrequency(memory: Memory): number {
  if (memory.accessCount >= 10) return 10
  if (memory.accessCount >= 5) return 7
  if (memory.accessCount >= 2) return 4
  return 2
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Scores a memory's relevance to the current query.
 *
 * @param memory - The memory to score
 * @param queryWords - Extracted keywords from the user's message
 * @param now - Current timestamp (for recency calculation)
 * @returns Detailed relevance score with breakdown
 */
export function scoreMemoryRelevance(
  memory: Memory,
  queryWords: string[],
  now: number = Date.now()
): MemoryRelevanceScore {
  const semantic = scoreSemantic(memory, queryWords)
  const recency = scoreRecency(memory, now)
  const importance = scoreImportance(memory)
  const contextMatch = scoreContextMatch(memory)
  const accessFrequency = scoreAccessFrequency(memory)

  const score = semantic + recency + importance + contextMatch + accessFrequency

  // Generate explanation
  const explanations: string[] = []
  if (semantic >= 10) explanations.push('pertinent pour ce sujet')
  if (recency >= 15) explanations.push('récent')
  if (importance >= 12) explanations.push('importante')
  if (contextMatch >= 10) explanations.push('adapté au moment')
  if (accessFrequency >= 7) explanations.push('souvent consultée')

  const explanation = explanations.length > 0
    ? explanations.join(', ')
    : 'mémoire disponible'

  return {
    memory,
    score,
    breakdown: { semantic, recency, importance, contextMatch, accessFrequency },
    explanation,
  }
}

/**
 * Retrieves the most relevant memories for a query.
 *
 * Pipeline:
 * 1. Filter by category (if specified)
 * 2. Filter by importance (if specified)
 * 3. Exclude superseded memories
 * 4. Exclude expired memories
 * 5. Check for prompt injection patterns
 * 6. Score each memory
 * 7. Sort by score
 * 8. Return top N
 *
 * @param memories - All available memories
 * @param query - The memory query
 * @returns Scored and ranked memories
 */
export function retrieveRelevantMemories(
  memories: Memory[],
  query: MemoryQuery
): MemoryRelevanceScore[] {
  const limit = query.limit ?? 5
  const now = Date.now()

  // Extract keywords from the user message
  const queryWords = extractKeywords(query.userMessage)

  // Filter pipeline
  let candidates = memories

  // 1. Filter by category
  if (query.category) {
    candidates = candidates.filter(m => m.category === query.category)
  }

  // 2. Filter by importance
  if (query.minImportance) {
    const importanceOrder: Record<MemoryImportance, number> = { low: 0, medium: 1, high: 2 }
    const minLevel = importanceOrder[query.minImportance]
    candidates = candidates.filter(m => importanceOrder[m.importance] >= minLevel)
  }

  // 3. Exclude superseded memories
  if (query.excludeSuperseded !== false) {
    candidates = candidates.filter(m => !m.superseded)
  }

  // 4. Exclude expired memories
  if (query.respectExpiration !== false) {
    candidates = candidates.filter(m => !m.expiresAt || m.expiresAt > now)
  }

  // 5. Check for prompt injection patterns
  candidates = candidates.filter(m => !containsInjection(m.content))

  // 6. Score each memory
  const scored = candidates.map(memory =>
    scoreMemoryRelevance(memory, queryWords, now)
  )

  // 7. Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  // 8. Return top N (with minimum score threshold)
  return scored
    .filter(s => s.score >= MIN_RELEVANCE_SCORE || scored.length <= limit)
    .slice(0, limit)
}

/**
 * Checks if content contains prompt injection patterns.
 */
export function containsInjection(content: string): boolean {
  return INJECTION_PATTERNS.some(pattern => pattern.test(content))
}

/**
 * Checks if content contains sensitive data patterns.
 */
export function containsSensitiveData(content: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(content))
}

/**
 * Formats retrieved memories for inclusion in the system prompt.
 */
export function formatRetrievedMemories(
  scored: MemoryRelevanceScore[],
  includeExplanations = false
): string {
  if (scored.length === 0) return ''

  const lines = ['MÉMOIRES PERTINENTES :']

  for (const item of scored) {
    const category = item.memory.category === 'explicit' ? '📌' :
      item.memory.category === 'preference' ? '⚙️' :
      item.memory.category === 'goal' ? '🎯' :
      item.memory.category === 'fact' ? '📝' :
      item.memory.category === 'schedule' ? '📅' : '💬'

    let line = `  ${category} ${item.memory.content}`
    if (includeExplanations) {
      line += ` (${item.explanation})`
    }
    lines.push(line)
  }

  return lines.join('\n')
}
