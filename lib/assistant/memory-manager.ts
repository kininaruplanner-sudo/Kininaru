/**
 * Kininaru Assistant — Memory Manager (Updated)
 *
 * Manages four layers of memory:
 * 1. Conversation history — raw messages in coach_messages (existing)
 * 2. Conversation summary — compressed summaries of past conversations
 * 3. User memory — durable facts stored in ai_memories (existing, opt-in)
 * 4. Current context — real-time data from today (tasks, habits, focus, etc.)
 *
 * Phase 2 enhancements:
 * - Relevant memory selection (not all memories, only topic-relevant ones)
 * - Conversation summarization for long conversations
 * - Integration with the context builder
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { selectRelevantMemories, formatMemoriesForContext } from './memory-selector'
import { summarizeConversation } from './conversation-summarizer'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface MemoryLayer {
  /** Raw conversation history (last N messages of current conversation) */
  conversationHistory: ConversationMessage[]
  /** Summaries of past conversations */
  conversationSummaries: ConversationSummary[]
  /** Durable user facts (ai_memories table, opt-in) */
  userMemory: UserMemoryItem[]
  /** Current context snapshot (computed by context-builder) */
  currentContext: string
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface ConversationSummary {
  id: string
  title: string
  summary: string
  created_at: string
}

export interface UserMemoryItem {
  content: string
  category: string
}

/* ------------------------------------------------------------------ */
/* Memory Reader                                                       */
/* ------------------------------------------------------------------ */

/**
 * Loads conversation history for the current conversation.
 * Bounded to prevent unbounded growth.
 */
export async function loadConversationHistory(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  limit = 20
): Promise<ConversationMessage[]> {
  try {
    const { data, error } = await supabase
      .from('coach_messages')
      .select('role, content, created_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) return []
    return (data ?? []) as ConversationMessage[]
  } catch {
    return []
  }
}

/**
 * Loads summaries of recent conversations for context.
 * These are lightweight summaries that help the AI understand past discussions.
 */
export async function loadConversationSummaries(
  supabase: SupabaseClient,
  userId: string,
  limit = 5
): Promise<ConversationSummary[]> {
  try {
    // Use coach_conversations table — the title serves as a lightweight summary
    const { data, error } = await supabase
      .from('coach_conversations')
      .select('id, title, created_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (error) return []
    return (data ?? []).map(c => ({
      id: c.id,
      title: c.title,
      summary: c.title, // Title is the summary for now
      created_at: c.created_at,
    }))
  } catch {
    return []
  }
}

/**
 * Loads user memory items (ai_memories table).
 * Respects the opt-in master switch.
 */
export async function loadUserMemory(
  supabase: SupabaseClient,
  userId: string,
  enabled = true,
  limit = 20
): Promise<UserMemoryItem[]> {
  if (!enabled) return []

  try {
    const { data, error } = await supabase
      .from('ai_memories')
      .select('content, category')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return []
    return (data ?? []) as UserMemoryItem[]
  } catch {
    return []
  }
}

/**
 * Loads all user memories for management (settings panel).
 * Returns full data including id for deletion.
 */
export async function loadAllUserMemories(
  supabase: SupabaseClient,
  userId: string
): Promise<Array<{ id: string; content: string; category: string; created_at: string }>> {
  try {
    const { data, error } = await supabase
      .from('ai_memories')
      .select('id, content, category, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) return []
    return (data ?? []) as Array<{ id: string; content: string; category: string; created_at: string }>
  } catch {
    return []
  }
}

/**
 * Deletes a specific memory by id.
 * Respects RLS — user can only delete their own memories.
 */
export async function deleteMemory(
  supabase: SupabaseClient,
  userId: string,
  memoryId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('ai_memories')
      .delete()
      .eq('id', memoryId)
      .eq('user_id', userId)

    return !error
  } catch {
    return false
  }
}

/**
 * Deletes all memories for a user.
 * Respects RLS — user can only delete their own memories.
 */
export async function deleteAllMemories(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('ai_memories')
      .delete()
      .eq('user_id', userId)

    return !error
  } catch {
    return false
  }
}

/**
 * Creates a new memory item.
 * Respects RLS — user can only create memories for themselves.
 */
export async function createMemory(
  supabase: SupabaseClient,
  userId: string,
  content: string,
  category: string
): Promise<{ id: string } | null> {
  try {
    const { data, error } = await supabase
      .from('ai_memories')
      .insert({ user_id: userId, content, category })
      .select('id')
      .single()

    if (error) return null
    return data as { id: string }
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Context Builder Integration                                         */
/* ------------------------------------------------------------------ */

/**
 * Builds a complete memory context string for the system prompt.
 * Uses the memory selector to pick only relevant memories.
 *
 * @param memory - The memory layer data
 * @param userMessage - The latest user message (for relevance selection)
 * @param maxMemories - Maximum memories to include (default 5)
 */
export function buildMemoryContext(
  memory: MemoryLayer,
  userMessage?: string,
  maxMemories = 5
): string {
  const parts: string[] = []

  // Past conversation summaries
  if (memory.conversationSummaries.length > 0) {
    parts.push(
      'RÉSUMÉS DES CONVERSATIONS PASSÉES :\n' +
      memory.conversationSummaries
        .map(s => `  • ${s.title}`)
        .join('\n')
    )
  }

  // User memory — select only relevant ones
  if (memory.userMemory.length > 0 && userMessage) {
    const relevantMemories = selectRelevantMemories(memory.userMemory, userMessage, maxMemories)
    if (relevantMemories.length > 0) {
      parts.push(formatMemoriesForContext(relevantMemories))
    }
  } else if (memory.userMemory.length > 0) {
    // No user message for selection — include all (up to limit)
    parts.push(formatMemoriesForContext(memory.userMemory.slice(0, maxMemories)))
  }

  return parts.join('\n\n')
}

/**
 * Generates a summary for a conversation.
 * Used when a conversation gets long enough to benefit from summarization.
 */
export function generateConversationSummary(
  messages: Array<{ role: string; content: string }>
): string {
  const summary = summarizeConversation(messages)
  return summary.summary
}
