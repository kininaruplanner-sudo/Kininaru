/**
 * Kininaru Assistant — Memory Deduplication & Contradictions (Phase 10)
 *
 * Handles:
 * - Deduplication: prevent storing similar memories
 * - Contradiction detection: detect when new info conflicts with existing memory
 * - Memory merging: combine similar memories
 * - Superseding: mark old memories as replaced
 *
 * Design principles:
 * - Conservative: only merge/supersede when confident
 * - Explainable: always explain what happened
 * - User control: critical changes require confirmation
 */

import type { Memory, MemoryCategory, MemoryImportance } from './types'

/* ------------------------------------------------------------------ */
/* Similarity Thresholds                                               */
/* ------------------------------------------------------------------ */

/** Threshold for considering two memories as duplicates (0-1) */
const DUPLICATE_THRESHOLD = 0.75

/** Threshold for considering two memories as contradictory (0-1) */
const CONTRADICTION_THRESHOLD = 0.6

/** Minimum word length for meaningful comparison */
const MIN_WORD_LENGTH = 3

/* ------------------------------------------------------------------ */
/* Contradiction Keywords (French)                                     */
/* ------------------------------------------------------------------ */

const CONTRADICTION_MARKERS = [
  // "I prefer X" vs "I prefer Y"
  /je\s+préfère/gi,
  /j'aime/gi,
  /je\s+voyais/gi,
  /maintenant/gi,
  /avant/gi,
  /plus\s+jamais/gi,
  /je\s+ne\s+veux\s+plus/gi,
  /j'ai\s+changé/gi,
]

/* ------------------------------------------------------------------ */
/* Word Extraction                                                     */
/* ------------------------------------------------------------------ */

function extractMeaningfulWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\sàâäéèêëïîôùûüÿçœæ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= MIN_WORD_LENGTH)
}

/* ------------------------------------------------------------------ */
/* Jaccard Similarity                                                  */
/* ------------------------------------------------------------------ */

function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 && set2.size === 0) return 1
  if (set1.size === 0 || set2.size === 0) return 0

  let intersection = 0
  for (const word of set1) {
    if (set2.has(word)) intersection++
  }

  const union = set1.size + set2.size - intersection
  return union > 0 ? intersection / union : 0
}

/* ------------------------------------------------------------------ */
/* Content Similarity                                                  */
/* ------------------------------------------------------------------ */

function contentSimilarity(content1: string, content2: string): number {
  const words1 = new Set(extractMeaningfulWords(content1))
  const words2 = new Set(extractMeaningfulWords(content2))
  return jaccardSimilarity(words1, words2)
}

/* ------------------------------------------------------------------ */
/* Duplicate Detection                                                 */
/* ------------------------------------------------------------------ */

export interface DuplicateResult {
  /** Is this a duplicate? */
  isDuplicate: boolean
  /** The existing memory that this duplicates (if any) */
  existingMemory?: Memory
  /** Similarity score (0-1) */
  similarity: number
  /** Whether the new memory should update the existing one */
  shouldUpdate: boolean
  /** Reason for the decision */
  reason: string
}

/**
 * Checks if a proposed memory duplicates an existing one.
 *
 * @param newContent - The content of the proposed new memory
 * @param existingMemories - All existing memories
 * @returns Duplicate analysis result
 */
export function checkDuplicate(
  newContent: string,
  existingMemories: Memory[]
): DuplicateResult {
  let bestMatch: Memory | null = null
  let bestSimilarity = 0

  for (const memory of existingMemories) {
    if (memory.superseded) continue

    const similarity = contentSimilarity(newContent, memory.content)

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity
      bestMatch = memory
    }
  }

  if (bestSimilarity >= DUPLICATE_THRESHOLD && bestMatch) {
    return {
      isDuplicate: true,
      existingMemory: bestMatch,
      similarity: bestSimilarity,
      shouldUpdate: bestSimilarity > 0.9, // Very high similarity → update
      reason: bestSimilarity > 0.9
        ? 'Mémoire quasi identique détectée — mise à jour recommandée'
        : 'Mémoire similaire existante',
    }
  }

  return {
    isDuplicate: false,
    similarity: bestSimilarity,
    shouldUpdate: false,
    reason: bestSimilarity > 0.5
      ? 'Partiellement similaire mais suffisamment distincte'
      : 'Aucune mémoire similaire',
  }
}

/* ------------------------------------------------------------------ */
/* Contradiction Detection                                             */
/* ------------------------------------------------------------------ */

export interface ContradictionResult {
  /** Does this contradict an existing memory? */
  isContradictory: boolean
  /** The contradicting memory (if any) */
  contradictingMemory?: Memory
  /** Confidence in the contradiction detection (0-1) */
  confidence: number
  /** Whether the new memory should supersede the old one */
  shouldSupersede: boolean
  /** Human-readable explanation */
  explanation: string
  /** Suggested action for the user */
  suggestedAction: 'keep_new' | 'keep_old' | 'ask_user'
}

/**
 * Checks if a proposed memory contradicts an existing one.
 *
 * Detection strategy:
 * 1. Check for semantic similarity (same topic)
 * 2. Check for contradiction markers (different stance)
 * 3. Check category consistency
 *
 * @param newContent - The content of the proposed new memory
 * @param existingMemories - All existing memories
 * @returns Contradiction analysis result
 */
export function checkContradiction(
  newContent: string,
  existingMemories: Memory[]
): ContradictionResult {
  const newWords = extractMeaningfulWords(newContent)
  const newWordsSet = new Set(newWords)

  for (const memory of existingMemories) {
    if (memory.superseded) continue
    if (memory.category === 'conversation_summary') continue

    // 1. Check semantic similarity (same topic)
    const existingWords = new Set(extractMeaningfulWords(memory.content))
    const topicSimilarity = jaccardSimilarity(newWordsSet, existingWords)

    // 2. Check for contradiction markers
    const hasNewContradictionMarker = CONTRADICTION_MARKERS.some(
      p => p.test(newContent)
    )
    const hasOldContradictionMarker = CONTRADICTION_MARKERS.some(
      p => p.test(memory.content)
    )

    // 3. If similar topic AND has contradiction markers → potential contradiction
    if (topicSimilarity >= CONTRADICTION_THRESHOLD &&
        hasNewContradictionMarker &&
        hasOldContradictionMarker) {

      // Check if they're about the same preference/topic
      const hasNewPreference = /je\s+préfère/i.test(newContent)
      const hasOldPreference = /je\s+préfère/i.test(memory.content)

      if (hasNewPreference && hasOldPreference) {
        return {
          isContradictory: true,
          contradictingMemory: memory,
          confidence: Math.min(topicSimilarity + 0.2, 0.95),
          shouldSupersede: true,
          explanation: `Nouvelle préférence détectée qui semble contredire : « ${memory.content} »`,
          suggestedAction: 'ask_user',
        }
      }

      // General contradiction (same topic, different stance)
      if (topicSimilarity >= 0.7) {
        return {
          isContradictory: true,
          contradictingMemory: memory,
          confidence: Math.min(topicSimilarity + 0.1, 0.85),
          shouldSupersede: topicSimilarity > 0.8,
          explanation: `Information potentiellement contradictoire avec : « ${memory.content} »`,
          suggestedAction: 'ask_user',
        }
      }
    }
  }

  return {
    isContradictory: false,
    confidence: 0,
    shouldSupersede: false,
    explanation: 'Aucune contradiction détectée',
    suggestedAction: 'keep_new',
  }
}

/* ------------------------------------------------------------------ */
/* Memory Merging                                                      */
/* ------------------------------------------------------------------ */

export interface MergeResult {
  /** Whether merging was performed */
  merged: boolean
  /** The merged content (if merged) */
  mergedContent?: string
  /** The category of the merged memory */
  mergedCategory?: MemoryCategory
  /** The importance of the merged memory */
  mergedImportance?: MemoryImportance
  /** Reason for the merge decision */
  reason: string
}

/**
 * Attempts to merge two similar memories into one.
 *
 * Merge strategy:
 * - If one has higher importance → keep its content
 * - If same importance → combine unique information
 *
 * @param newContent - The content of the new memory
 * @param newCategory - Category of the new memory
 * @param newImportance - Importance of the new memory
 * @param existingMemory - The existing memory to merge with
 * @returns Merge result
 */
export function mergeMemories(
  newContent: string,
  newCategory: MemoryCategory,
  newImportance: MemoryImportance,
  existingMemory: Memory
): MergeResult {
  // If new is more important, supersede the old one
  const importanceOrder: Record<MemoryImportance, number> = {
    low: 0, medium: 1, high: 2,
  }

  if (importanceOrder[newImportance] > importanceOrder[existingMemory.importance]) {
    return {
      merged: false, // Not a merge — full replacement
      mergedContent: newContent,
      mergedCategory: newCategory,
      mergedImportance: newImportance,
      reason: 'Nouvelle mémoire plus importante — remplacement',
    }
  }

  // If old is more important, update with new info but keep old importance
  if (importanceOrder[existingMemory.importance] > importanceOrder[newImportance]) {
    return {
      merged: false,
      mergedContent: newContent,
      mergedCategory: newCategory,
      mergedImportance: existingMemory.importance,
      reason: 'Mise à jour avec conservation de l\'importance existante',
    }
  }

  // Same importance — try to combine
  // Simple approach: keep the newer, longer content
  if (newContent.length > existingMemory.content.length) {
    return {
      merged: true,
      mergedContent: newContent,
      mergedCategory: newCategory,
      mergedImportance: newImportance,
      reason: 'Mise à jour avec contenu plus détaillé',
    }
  }

  return {
    merged: true,
    mergedContent: existingMemory.content,
    mergedCategory: existingMemory.category,
    mergedImportance: existingMemory.importance,
    reason: 'Mémoire existante conservée (plus complète)',
  }
}

/* ------------------------------------------------------------------ */
/* Superseding                                                         */
/* ------------------------------------------------------------------ */

/**
 * Creates a superseded version of an old memory.
 *
 * @param oldMemory - The memory to supersede
 * @param newMemoryId - The ID of the memory that replaces it
 * @returns Updated memory marked as superseded
 */
export function supersedeMemory(
  oldMemory: Memory,
  newMemoryId: string
): Memory {
  return {
    ...oldMemory,
    superseded: true,
    supersededBy: newMemoryId,
    lastAccessedAt: Date.now(),
  }
}

/* ------------------------------------------------------------------ */
/* Batch Processing                                                    */
/* ------------------------------------------------------------------ */

export interface BatchResult {
  /** Total candidates processed */
  total: number
  /** Number accepted */
  accepted: number
  /** Number rejected as duplicates */
  duplicates: number
  /** Number with contradictions detected */
  contradictions: number
  /** Number requiring user confirmation */
  requiresConfirmation: number
  /** Individual results */
  results: Array<{
    content: string
    action: 'store' | 'update' | 'supersede' | 'reject_duplicate' | 'needs_confirmation'
    reason: string
  }>
}

/**
 * Processes a batch of memory candidates against existing memories.
 *
 * @param candidates - Array of { content, category, importance }
 * @param existingMemories - All existing memories
 * @returns Batch processing result
 */
export function processBatch(
  candidates: Array<{
    content: string
    category: MemoryCategory
    importance: MemoryImportance
  }>,
  existingMemories: Memory[]
): BatchResult {
  const results: BatchResult['results'] = []
  let accepted = 0
  let duplicates = 0
  let contradictions = 0
  let requiresConfirmation = 0

  for (const candidate of candidates) {
    // Check for duplicates
    const duplicateResult = checkDuplicate(candidate.content, existingMemories)

    if (duplicateResult.isDuplicate && duplicateResult.shouldUpdate) {
      duplicates++
      results.push({
        content: candidate.content,
        action: 'update',
        reason: duplicateResult.reason,
      })
      continue
    }

    if (duplicateResult.isDuplicate) {
      duplicates++
      results.push({
        content: candidate.content,
        action: 'reject_duplicate',
        reason: duplicateResult.reason,
      })
      continue
    }

    // Check for contradictions
    const contradictionResult = checkContradiction(candidate.content, existingMemories)

    if (contradictionResult.isContradictory) {
      contradictions++
      requiresConfirmation++
      results.push({
        content: candidate.content,
        action: 'needs_confirmation',
        reason: contradictionResult.explanation,
      })
      continue
    }

    // No issues → accept
    accepted++
    results.push({
      content: candidate.content,
      action: 'store',
      reason: 'Nouvelle mémoire acceptée',
    })
  }

  return {
    total: candidates.length,
    accepted,
    duplicates,
    contradictions,
    requiresConfirmation,
    results,
  }
}
