/**
 * Kininaru Assistant — Memory Types (Phase 10)
 *
 * Defines the complete type system for long-term memory.
 *
 * Memory categories:
 * - explicit: User explicitly asked Kininaru to remember something
 * - preference: User preference (can be explicit or inferred)
 * - goal: Important objective or project
 * - context: Temporary context useful for current session
 * - conversation_summary: Compressed summary of a past conversation
 *
 * Each memory has:
 * - importance (low/medium/high)
 * - expiration (optional, for temporary context)
 * - confidence (how sure we are about this memory)
 */

/* ------------------------------------------------------------------ */
/* Memory Categories                                                   */
/* ------------------------------------------------------------------ */

export type MemoryCategory =
  | 'explicit'           // User explicitly asked to remember
  | 'preference'         // User preference (work style, schedule, etc.)
  | 'goal'               // Important objective or project
  | 'context'            // Temporary context (expires)
  | 'conversation_summary' // Summary of a past conversation
  | 'fact'               // General fact about the user
  | 'habit_context'      // Context about habits
  | 'schedule'           // Schedule-related information

/* ------------------------------------------------------------------ */
/* Memory Importance                                                   */
/* ------------------------------------------------------------------ */

export type MemoryImportance = 'low' | 'medium' | 'high'

/* ------------------------------------------------------------------ */
/* Memory Source                                                       */
/* ------------------------------------------------------------------ */

export type MemorySource = 'explicit' | 'inferred' | 'conversation'

/* ------------------------------------------------------------------ */
/* Core Memory Interface                                               */
/* ------------------------------------------------------------------ */

export interface Memory {
  /** Unique identifier */
  id: string
  /** Memory content (the actual information) */
  content: string
  /** Category for organization and retrieval */
  category: MemoryCategory
  /** How important is this memory? */
  importance: MemoryImportance
  /** How did we learn this? */
  source: MemorySource
  /** Confidence level (0-1) — higher = more certain */
  confidence: number
  /** When was this memory created? */
  createdAt: number
  /** When was this memory last accessed/updated? */
  lastAccessedAt: number
  /** Optional expiration timestamp (for temporary context) */
  expiresAt?: number
  /** Number of times this memory has been accessed */
  accessCount: number
  /** Related topics/keywords for retrieval */
  keywords: string[]
  /** Whether this memory has been superseded by a newer one */
  superseded?: boolean
  /** ID of memory that superseded this one */
  supersededBy?: string
}

/* ------------------------------------------------------------------ */
/* Memory Query                                                        */
/* ------------------------------------------------------------------ */

export interface MemoryQuery {
  /** The user's current message (for relevance matching) */
  userMessage: string
  /** Maximum memories to return */
  limit?: number
  /** Filter by category */
  category?: MemoryCategory
  /** Filter by minimum importance */
  minImportance?: MemoryImportance
  /** Only include non-expired memories */
  respectExpiration?: boolean
  /** Only include non-superseded memories */
  excludeSuperseded?: boolean
}

/* ------------------------------------------------------------------ */
/* Memory Relevance Score                                              */
/* ------------------------------------------------------------------ */

export interface MemoryRelevanceScore {
  /** The memory being scored */
  memory: Memory
  /** Overall relevance score (0-100) */
  score: number
  /** Breakdown of scoring factors */
  breakdown: {
    /** Semantic similarity to the query */
    semantic: number
    /** How recently was this memory created/updated? */
    recency: number
    /** How important is this memory? */
    importance: number
    /** Does this match the current context? */
    contextMatch: number
    /** How often is this memory accessed? */
    accessFrequency: number
  }
  /** Human-readable explanation of why this memory is relevant */
  explanation: string
}

/* ------------------------------------------------------------------ */
/* Memory Extraction Candidate                                         */
/* ------------------------------------------------------------------ */

export interface MemoryExtractionCandidate {
  /** The extracted content */
  content: string
  /** Suggested category */
  suggestedCategory: MemoryCategory
  /** Suggested importance */
  suggestedImportance: MemoryImportance
  /** Confidence that this is worth memorizing */
  extractionConfidence: number
  /** Why this was extracted */
  reason: string
}

/* ------------------------------------------------------------------ */
/* Memory Stats                                                        */
/* ------------------------------------------------------------------ */

export interface MemoryStats {
  totalMemories: number
  byCategory: Record<MemoryCategory, number>
  byImportance: Record<MemoryImportance, number>
  averageConfidence: number
  oldestMemory: number | null
  newestMemory: number | null
}

/* ------------------------------------------------------------------ */
/* Prompt Injection Patterns                                           */
/* ------------------------------------------------------------------ */

export const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above)\s+(instructions?|rules?|guidelines?)/i,
  /you\s+are\s+now\s+(a|an|the)/i,
  /forget\s+(everything|all|previous)/i,
  /new\s+(system|role|persona|instructions?)\s*:/i,
  /act\s+as\s+if/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /disregard\s+(previous|all|your)/i,
  /override\s+(previous|all|your)/i,
  /\[SYSTEM\]/i,
  /\[INST\]/i,
  /<<SYS>>/i,
  /<\|im_start\|>/i,
]

/* ------------------------------------------------------------------ */
/* Sensitive Data Patterns (to avoid memorizing)                       */
/* ------------------------------------------------------------------ */

export const SENSITIVE_PATTERNS = [
  /(?:santé|maladie|diagnostic|traitement|médicament|médecin|docteur)/i,
  /(?:password|mot\s+de\s+passe|secret|token|api[_\s]?key)/i,
  /(?:numéro\s+(?:de\s+)?(?:sécurité|sécurité\s+sociale|carte))/i,
  /(?:carte\s+(?:bancaire|de\s+crédit))/i,
  /(?:adresse\s+(?:personnelle|complète))/i,
  /(?:revenu|salaire|argent\s+personnel)/i,
]

/* ------------------------------------------------------------------ */
/* Memory TTL Constants                                                */
/* ------------------------------------------------------------------ */

/** Default TTL for temporary context (4 hours) */
export const CONTEXT_TTL_MS = 4 * 60 * 60 * 1000

/** Maximum age for memories to be considered "recent" (7 days) */
export const RECENT_MEMORY_MS = 7 * 24 * 60 * 60 * 1000

/** Maximum age for relevance recency scoring (30 days) */
export const MAX_RECENCY_MS = 30 * 24 * 60 * 60 * 1000

/** Default maximum memories to inject into context */
export const DEFAULT_MAX_MEMORIES = 5

/** Minimum relevance score to include a memory */
export const MIN_RELEVANCE_SCORE = 15
