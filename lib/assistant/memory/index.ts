/**
 * Kininaru Assistant — Memory Module (Phase 10)
 *
 * Long-term memory system with:
 * - Typed memory categories (explicit, preference, goal, context, etc.)
 * - Relevance-based retrieval with scoring
 * - Pattern-based extraction with validation
 * - Deduplication and contradiction management
 * - Prompt injection protection
 * - Privacy-first (sensitive data filtering)
 *
 * Architecture:
 *   Conversation
 *        ↓
 *   Extraction (extraction.ts)
 *        ↓
 *   Dedup + Contradictions (dedup.ts)
 *        ↓
 *   Storage (via Supabase ai_memories or localStorage)
 *        ↓
 *   Retrieval (retrieval.ts)
 *        ↓
 *   Context Builder Integration
 */

// Types
export type {
  Memory,
  MemoryCategory,
  MemoryImportance,
  MemorySource,
  MemoryQuery,
  MemoryRelevanceScore,
  MemoryExtractionCandidate,
  MemoryStats,
} from './types'

export {
  INJECTION_PATTERNS,
  SENSITIVE_PATTERNS,
  CONTEXT_TTL_MS,
  RECENT_MEMORY_MS,
  MAX_RECENCY_MS,
  DEFAULT_MAX_MEMORIES,
  MIN_RELEVANCE_SCORE,
} from './types'

// Retrieval
export {
  scoreMemoryRelevance,
  retrieveRelevantMemories,
  containsInjection,
  containsSensitiveData,
  formatRetrievedMemories,
} from './retrieval'

// Extraction
export {
  extractMemoryCandidates,
  validateCandidate,
  formatCandidateForUI,
  isMessageWorthExtracting,
} from './extraction'

// Deduplication & Contradictions
export type {
  DuplicateResult,
  ContradictionResult,
  MergeResult,
  BatchResult,
} from './dedup'

export {
  checkDuplicate,
  checkContradiction,
  mergeMemories,
  supersedeMemory,
  processBatch,
} from './dedup'
