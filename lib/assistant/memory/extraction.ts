/**
 * Kininaru Assistant — Memory Extraction (Phase 10)
 *
 * Extracts potential memories from conversations.
 * This is a controlled extraction — not every message becomes a memory.
 *
 * Architecture:
 *   Conversation
 *        ↓
 *   Potential Memories (pattern-based extraction)
 *        ↓
 *   Validation (sensitivity, injection, duplicates)
 *        ↓
 *   Memory Candidates (with confidence scores)
 *        ↓
 *   User Confirmation (for explicit memories)
 *        ↓
 *   Storage
 *
 * Design principles:
 * - Conservative: fewer high-quality memories > many low-quality ones
 * - User control: explicit memories require confirmation
 * - Privacy-first: sensitive data is filtered out
 * - No false positives: don't extract "I like pizza" as a memory
 */

import type {
  Memory,
  MemoryCategory,
  MemoryImportance,
  MemoryExtractionCandidate,
} from './types'
import { containsInjection, containsSensitiveData } from './retrieval'

/* ------------------------------------------------------------------ */
/* Extraction Patterns (French)                                        */
/* ------------------------------------------------------------------ */

interface ExtractionPattern {
  /** Regex pattern to match */
  pattern: RegExp
  /** Suggested memory category */
  category: MemoryCategory
  /** Suggested importance */
  importance: MemoryImportance
  /** Confidence that this is worth memorizing (0-1) */
  confidence: number
  /** Human-readable description of what this pattern captures */
  description: string
}

const EXTRACTION_PATTERNS: ExtractionPattern[] = [
  // Explicit requests to remember
  {
    pattern: /(?:retiens?|garde\s+en\s+tête|mémorise?|note\s+(?:bien|ça|ceci)|souviens?-?(?:toi|s?)-?(?:de|que))\s*[:\s]*(.+?)(?:\.|$)/gi,
    category: 'explicit',
    importance: 'high',
    confidence: 0.95,
    description: 'Explicit request to remember',
  },
  // Preferences
  {
    pattern: /(?:je\s+préfère|j'aime\s+(?:bien\s+)?|je\s+ビジually|j'adore|je\s+n'aime\s+pas|je\s+déteste)\s+(.+?)(?:\.|$)/gi,
    category: 'preference',
    importance: 'medium',
    confidence: 0.7,
    description: 'User preference',
  },
  // Goals and objectives
  {
    pattern: /(?:mon\s+objectif|je\s+veux|je\s+dois|il\s+faut\s+que\s+je|mon\s+but|ma\s+mission)\s+(?:est\s+)?(?:de\s+)?(.+?)(?:\.|$)/gi,
    category: 'goal',
    importance: 'high',
    confidence: 0.75,
    description: 'User goal or objective',
  },
  // Schedule information
  {
    pattern: /(?:je\s+(?:travaille|étudie|ai\s+(?:cours|réunion))|mon\s+(?:horaire|planning))\s+(?:le\s+)?(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|matin|soir|après-midi)\s*(?:à\s+(\d+[h:]\d+)?)?\s*(.+?)(?:\.|$)/gi,
    category: 'schedule',
    importance: 'medium',
    confidence: 0.65,
    description: 'Schedule information',
  },
  // Habits and routines
  {
    pattern: /(?:je\s+(?:fais|pratique|ai\s+l'habitude\s+de)|chaque\s+(?:jour|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche))\s+(.+?)(?:\.|$)/gi,
    category: 'habit_context',
    importance: 'medium',
    confidence: 0.6,
    description: 'Habit or routine',
  },
  // Important facts
  {
    pattern: /(?:je\s+suis|j'habite\s+à|je\s+travaille\s+(?:chez|pour)|j'étudie\s+(?:à|pour)|mon\s+(?:école|université|entreprise))\s+(.+?)(?:\.|$)/gi,
    category: 'fact',
    importance: 'medium',
    confidence: 0.65,
    description: 'Important fact about user',
  },
]

/* ------------------------------------------------------------------ */
/* Extraction Functions                                                */
/* ------------------------------------------------------------------ */

/**
 * Extracts potential memory candidates from a user message.
 *
 * @param message - The user's message
 * @param existingMemories - Existing memories (for deduplication)
 * @returns Array of extraction candidates
 */
export function extractMemoryCandidates(
  message: string,
  existingMemories: Memory[] = []
): MemoryExtractionCandidate[] {
  const candidates: MemoryExtractionCandidate[] = []

  // Check for injection patterns first
  if (containsInjection(message)) {
    return [] // Never extract injections
  }

  // Check for sensitive data
  if (containsSensitiveData(message)) {
    return [] // Never extract sensitive data
  }

  // Apply extraction patterns
  for (const extractionPattern of EXTRACTION_PATTERNS) {
    const matches = message.matchAll(extractionPattern.pattern)

    for (const match of matches) {
      const extractedContent = match[1]?.trim()
      if (!extractedContent || extractedContent.length < 5) continue

      // Check for duplicates
      const isDuplicate = existingMemories.some(existing =>
        isSimilarMemory(existing.content, extractedContent)
      )

      if (isDuplicate) continue

      candidates.push({
        content: extractedContent,
        suggestedCategory: extractionPattern.category,
        suggestedImportance: extractionPattern.importance,
        extractionConfidence: extractionPattern.confidence,
        reason: extractionPattern.description,
      })
    }
  }

  return candidates
}

/**
 * Checks if two memory contents are similar (for deduplication).
 * Uses simple keyword overlap.
 */
function isSimilarMemory(content1: string, content2: string): boolean {
  const words1 = new Set(content1.toLowerCase().split(/\s+/).filter(w => w.length > 3))
  const words2 = new Set(content2.toLowerCase().split(/\s+/).filter(w => w.length > 3))

  if (words1.size === 0 || words2.size === 0) return false

  let overlap = 0
  for (const word of words1) {
    if (words2.has(word)) overlap++
  }

  const overlapRatio = overlap / Math.min(words1.size, words2.size)
  return overlapRatio > 0.7 // 70% overlap = likely duplicate
}

/**
 * Validates an extraction candidate before storage.
 *
 * @param candidate - The candidate to validate
 * @returns True if the candidate should be stored
 */
export function validateCandidate(candidate: MemoryExtractionCandidate): boolean {
  // Must have sufficient confidence
  if (candidate.extractionConfidence < 0.5) return false

  // Must have meaningful content
  if (candidate.content.length < 5) return false
  if (candidate.content.length > 500) return false

  // Must not contain injection patterns
  if (containsInjection(candidate.content)) return false

  // Must not contain sensitive data
  if (containsSensitiveData(candidate.content)) return false

  return true
}

/**
 * Formats extraction candidates for user confirmation UI.
 */
export function formatCandidateForUI(candidate: MemoryExtractionCandidate): {
  title: string
  content: string
  category: string
  importance: string
  confidence: number
} {
  const categoryLabels: Record<MemoryCategory, string> = {
    explicit: '📌 À retenir',
    preference: '⚙️ Préférence',
    goal: '🎯 Objectif',
    context: '📋 Contexte',
    conversation_summary: '💬 Résumé',
    fact: '📝 Fait',
    habit_context: '🔄 Habitude',
    schedule: '📅 Planning',
  }

  const importanceLabels: Record<MemoryImportance, string> = {
    high: 'Haute',
    medium: 'Moyenne',
    low: 'Basse',
  }

  return {
    title: categoryLabels[candidate.suggestedCategory] ?? '💡 À retenir',
    content: candidate.content,
    category: candidate.suggestedCategory,
    importance: importanceLabels[candidate.suggestedImportance],
    confidence: candidate.extractionConfidence,
  }
}

/**
 * Checks if a message is worth extracting memories from.
 * Returns false for simple greetings, acknowledgments, etc.
 */
export function isMessageWorthExtracting(message: string): boolean {
  const trimmed = message.trim()

  // Too short
  if (trimmed.length < 10) return false

  // Simple greetings/acknowledgments
  const trivialPatterns = [
    /^(?:salut|bonjour|bonsoir|hello|hi|hey|merci|ok|d'accord|compris|c'est\s+noté|parfait|excellent|super|cool|bien|oui|non)\s*[!.?]*$/i,
    /^(?:ça\s+(?:va|roule)|tout\s+bien|pas\s+(?:mal|de\s+nouveau))\s*[!.?]*$/i,
  ]

  if (trivialPatterns.some(p => p.test(trimmed))) return false

  return true
}
