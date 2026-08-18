/**
 * Kininaru Assistant — Memory Selector
 *
 * Selects relevant memories based on the current conversation context.
 * Instead of injecting ALL memories into every request, this module
 * picks only the ones relevant to the current topic.
 *
 * Design principles:
 * - No external API calls (pure algorithm)
 * - Fast: no async, no DB queries
 * - Keyword-based matching with category weighting
 * - Falls back to "all memories" if no specific match
 */

import type { UserMemoryItem } from './memory-manager'

/* ------------------------------------------------------------------ */
/* Category Keywords                                                   */
/* ------------------------------------------------------------------ */

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  goal: ['objectif', 'but', 'projet', 'vision', 'ambition', 'plan', 'étude', 'revoir', 'apprendre', 'candidature', 'emploi', 'carrière'],
  preference: ['préfère', 'aimer', 'habitude', 'routine', 'horaire', 'horaires', 'soir', 'matin', 'après-midi', 'calme', 'musique', 'silence', 'bruit'],
  habit: ['habitude', 'routine', 'quotidien', 'chaque jour', 'série', 'chaîne', 'streak', 'méditation', 'sport', 'lecture'],
  fact: ['travaille', 'étudie', 'école', 'université', 'famille', 'âge', 'ville', 'profession', 'emploi'],
  other: [],
}

/* ------------------------------------------------------------------ */
/* Relevance Scoring                                                   */
/* ------------------------------------------------------------------ */

/**
 * Scores a memory item against the current conversation context.
 * Higher score = more relevant.
 */
function scoreMemory(memory: UserMemoryItem, contextWords: string[]): number {
  let score = 0
  const memoryLower = memory.content.toLowerCase()
  const memoryWords = memoryLower.split(/\s+/)

  // Category bonus: memories matching the conversation topic get a boost
  const categoryKeywords = CATEGORY_KEYWORDS[memory.category] ?? []
  for (const word of contextWords) {
    if (categoryKeywords.some(kw => word.includes(kw) || kw.includes(word))) {
      score += 3
    }
  }

  // Direct keyword match: memory content contains words from the conversation
  for (const word of contextWords) {
    if (memoryWords.some(mw => mw.includes(word) || word.includes(mw))) {
      score += 2
    }
  }

  // Recency bonus: newer memories get a small boost (handled by ordering)
  // Length penalty: very long memories are slightly less relevant (brevity wins)
  if (memory.content.length > 200) score -= 1

  return score
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Selects the most relevant memories for the current conversation.
 *
 * @param memories - All user memories from ai_memories
 * @param userMessage - The latest user message
 * @param maxMemories - Maximum memories to return (default 5)
 * @returns Filtered and ranked memories
 */
export function selectRelevantMemories(
  memories: UserMemoryItem[],
  userMessage: string,
  maxMemories = 5
): UserMemoryItem[] {
  if (memories.length === 0) return []
  if (memories.length <= maxMemories) return memories

  // Extract meaningful words from the user message (3+ chars, not common)
  const stopWords = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'est', 'sont', 'a', 'ai', 'as', 'avons', 'avez', 'ont', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'me', 'te', 'se', 'lui', 'leur', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'notre', 'votre', 'leur', 'ce', 'cette', 'ces', 'qui', 'que', 'quoi', 'dont', 'où', 'comment', 'pourquoi', 'quand', 'combien', 'quel', 'quelle', 'quels', 'quelles', 'je', 'ne', 'pas', 'plus', 'moins', 'très', 'bien', 'mal', 'aussi', 'encore', 'déjà', 'toujours', 'jamais', 'parfois', 'souvent', 'peut', 'doit', 'faut', 'fait', 'faire', 'dit', 'dire', 'va', 'aller', 'voir', 'prendre', 'donner', 'mettre', 'venir', 'pouvoir', 'vouloir', 'savoir', 'croire', 'penser', 'aimer', 'trouver', 'rester', 'passer', 'partir', 'arriver', 'entrer', 'sortir', 'tomber', 'rester', 'devenir', 'tenir', 'parler', 'demander', 'répondre', 'écouter', 'regarder', 'chercher', 'essayer', 'commencer', 'continuer', 'finir', 'arrêter', 'attendre', 'perdre', 'gagner', 'acheter', 'vendre', 'payer', 'coûter', 'lire', 'écrire', 'apprendre', 'enseigner', 'travailler', 'study', 'the', 'is', 'are', 'was', 'were', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'need', 'must', 'ought', 'what', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'don', 'now'])

  const contextWords = userMessage
    .toLowerCase()
    .replace(/[^\w\sàâäéèêëïîôùûüÿçœæ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopWords.has(w))

  // Score each memory
  const scored = memories.map(memory => ({
    memory,
    score: scoreMemory(memory, contextWords),
  }))

  // Sort by score descending, then by recency (newest first for ties)
  scored.sort((a, b) => b.score - a.score)

  // Return top N, but only if they have a positive score
  // If no memory scores positively, return the 3 most recent (fallback)
  const relevant = scored.filter(s => s.score > 0).slice(0, maxMemories)

  if (relevant.length === 0) {
    return memories.slice(0, Math.min(3, maxMemories))
  }

  return relevant.map(s => s.memory)
}

/**
 * Formats selected memories into a context string for the system prompt.
 */
export function formatMemoriesForContext(memories: UserMemoryItem[]): string {
  if (memories.length === 0) return ''

  return 'FAITS MÉMORISÉS (pertinents pour cette conversation — respecte-les) :\n' +
    memories.map(m => `  • ${m.content} (${m.category})`).join('\n')
}
