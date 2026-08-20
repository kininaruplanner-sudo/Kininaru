import { createClient } from '@/lib/supabase/client'

/**
 * Coach conversation persistence — ÉTAPE 14 §16-18.
 *
 * Conversations + messages live in Supabase (`coach_conversations` /
 * `coach_messages`, see supabase/coach.sql). RLS guarantees a user only ever
 * reads/writes their own rows. All helpers are failure-tolerant: if the
 * tables are missing (SQL not run yet), the chat keeps working — persistence
 * simply does not activate.
 */

export interface CoachConversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface CoachMessageRow {
  id: number
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export async function listConversations(): Promise<CoachConversation[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('coach_conversations')
      .select('id, title, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(50)
    if (error) return []
    return (data ?? []) as CoachConversation[]
  } catch {
    return []
  }
}

export async function createConversation(title: string): Promise<CoachConversation | null> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from('coach_conversations')
      .insert({ title, user_id: user.id })
      .select('id, title, created_at, updated_at')
      .single()
    if (error) return null
    return (data ?? null) as CoachConversation | null
  } catch {
    return null
  }
}

export async function renameConversation(id: string, title: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('coach_conversations')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', id)
    return !error
  } catch {
    return false
  }
}

export async function deleteConversation(id: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase.from('coach_conversations').delete().eq('id', id)
    return !error
  } catch {
    return false
  }
}

export async function touchConversation(id: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('coach_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id)
    return !error
  } catch {
    return false
  }
}

/** Last N messages of a conversation (bounded — never loads a huge thread). */
export async function loadMessages(
  conversationId: string,
  limit = 60
): Promise<CoachMessageRow[]> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('coach_messages')
      .select('id, conversation_id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit)
    if (error) return []
    return (data ?? []) as CoachMessageRow[]
  } catch {
    return []
  }
}

export async function appendMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<boolean> {
  if (!content.trim()) return false
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { error } = await supabase
      .from('coach_messages')
      .insert({ conversation_id: conversationId, role, content, user_id: user.id })
    return !error
  } catch {
    return false
  }
}
