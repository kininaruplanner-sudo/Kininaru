/**
 * Kininaru Assistant — Memory Manager
 *
 * Manages four layers of memory:
 * 1. Conversation history — raw messages in coach_messages (existing)
 * 2. Conversation summary — compressed summaries of past conversations
 * 3. User memory — durable facts stored in ai_memories (existing, opt-in)
 * 4. Current context — real-time data from today (tasks, habits, focus, etc.)
 *
 * This module only READS memory. Memory is written through the existing
 * create_memory action (with user confirmation).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

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
 * Builds a complete memory context string for the system prompt.
 */
export function buildMemoryContext(memory: MemoryLayer): string {
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

  // User memory
  if (memory.userMemory.length > 0) {
    parts.push(
      'FAITS MÉMORISÉS (respecte-les — l\'utilisateur les a enregistrés consciemment) :\n' +
      memory.userMemory
        .map(m => `  • ${m.content} (${m.category})`)
        .join('\n')
    )
  }

  return parts.join('\n\n')
}
