/**
 * AI 2.0 — structured actions.
 *
 * Security model (ÉTAPE 12):
 * - The model NEVER touches the database directly and never emits SQL.
 * - It proposes actions as plain JSON; the client renders a confirmation
 *   card; the SERVER re-validates every field against a strict whitelist
 *   and always sets `user_id` from the authenticated session — never from
 *   the client payload.
 * - All inserts go through Supabase with RLS: a row the user cannot legally
 *   create is rejected by the database as a second line of defense.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type MemoryCategory = 'fact' | 'goal' | 'preference' | 'habit' | 'other'

export type AiAction =
  | {
      action: 'create_task'
      data: {
        title: string
        description?: string
        priority?: TaskPriority
        due_date?: string
        tags?: string[]
      }
    }
  | {
      action: 'create_tasks_batch'
      data: { parent_title: string; steps: string[] }
    }
  | {
      /** Journal → objectif → tâches (ÉTAPE 15.5 §4-5). Same shape as
       *  create_tasks_batch but only carries the steps the user CONFIRMED
       *  in the journal (selection is applied client-side before sending). */
      action: 'create_objective'
      data: { parent_title: string; steps: string[] }
    }
  | { action: 'create_habit'; data: { title: string; color?: string } }
  | {
      action: 'create_event'
      data: { title: string; start_at: string; end_at: string; description?: string }
    }
  | { action: 'create_family_task'; data: { title: string; family_id: string } }
  | {
      action: 'create_memory'
      data: { content: string; category?: MemoryCategory }
    }

export type AiActionResult = {
  action: AiAction['action']
  ok: boolean
  message: string
  title?: string
  id?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_TITLE = 200
const MAX_DESCRIPTION = 1000
const MAX_STEPS = 10
const MAX_TAGS = 5
const MAX_TAG_LEN = 30
const MAX_MEMORY_LENGTH = 500
const MEMORY_CATEGORIES: MemoryCategory[] = ['fact', 'goal', 'preference', 'habit', 'other']
const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent']

/* ------------------------------------------------------------------ */
/* Validation (server-side — never trust the model or the client)      */
/* ------------------------------------------------------------------ */

export interface ValidationIssue {
  message: string
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function cleanTitle(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 && v.trim().length <= MAX_TITLE
    ? v.trim()
    : null
}

function cleanPriority(v: unknown): TaskPriority | undefined | null {
  if (v === undefined || v === null) return undefined
  return PRIORITIES.includes(v as TaskPriority) ? (v as TaskPriority) : null
}

function cleanDate(v: unknown): string | undefined | null {
  if (v === undefined || v === null || v === '') return undefined
  if (typeof v !== 'string' || !DATE_RE.test(v)) return null
  return v
}

function cleanTags(v: unknown): string[] | undefined | null {
  if (v === undefined || v === null) return undefined
  if (!Array.isArray(v) || v.length > MAX_TAGS) return null
  const tags: string[] = []
  for (const t of v) {
    if (typeof t !== 'string' || t.trim().length === 0 || t.trim().length > MAX_TAG_LEN) return null
    tags.push(t.trim())
  }
  return tags
}

function cleanDescription(v: unknown): string | undefined | null {
  if (v === undefined || v === null || v === '') return undefined
  if (typeof v !== 'string' || v.length > MAX_DESCRIPTION) return null
  return v.trim() || undefined
}

function cleanSteps(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length < 1 || v.length > MAX_STEPS) return null
  const steps: string[] = []
  for (const s of v) {
    const title = cleanTitle(s)
    if (!title) return null
    steps.push(title)
  }
  return steps
}

function cleanIsoDate(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

/** Validates a raw action from the model/client. Returns {action} or an error. */
export function validateAiAction(raw: unknown): { action?: AiAction; error?: string } {
  if (!isRecord(raw)) return { error: 'Action invalide' }
  const { action, data } = raw
  if (typeof action !== 'string' || !isRecord(data)) {
    return { error: 'Action invalide' }
  }

  switch (action) {
    case 'create_task': {
      const title = cleanTitle(data.title)
      if (!title) return { error: 'Titre de tâche manquant ou trop long' }
      const priority = cleanPriority(data.priority)
      if (priority === null) return { error: 'Priorité invalide' }
      const due_date = cleanDate(data.due_date)
      if (due_date === null) return { error: 'Date invalide (format AAAA-MM-JJ)' }
      const tags = cleanTags(data.tags)
      if (tags === null) return { error: 'Étiquettes invalides' }
      const description = cleanDescription(data.description)
      if (description === null) return { error: 'Description invalide' }
      return {
        action: {
          action: 'create_task',
          data: { title, description, priority, due_date, tags },
        },
      }
    }
    case 'create_tasks_batch': {
      const parent_title = cleanTitle(data.parent_title)
      if (!parent_title) return { error: 'Titre de l’objectif manquant' }
      const steps = cleanSteps(data.steps)
      if (!steps) return { error: 'Étapes invalides (1 à 10 étapes attendues)' }
      return { action: { action: 'create_tasks_batch', data: { parent_title, steps } } }
    }
    case 'create_objective': {
      // Same strict validation as create_tasks_batch — the number of steps is
      // bounded, each title is cleaned, and user_id is never read from the
      // payload (it always comes from the authenticated session).
      const parent_title = cleanTitle(data.parent_title)
      if (!parent_title) return { error: 'Titre de l’objectif manquant' }
      const steps = cleanSteps(data.steps)
      if (!steps) return { error: 'Étapes invalides (1 à 10 étapes attendues)' }
      return { action: { action: 'create_objective', data: { parent_title, steps } } }
    }
    case 'create_habit': {
      const title = cleanTitle(data.title)
      if (!title) return { error: 'Titre d’habitude manquant' }
      const color = typeof data.color === 'string' && data.color.trim() ? data.color.trim() : undefined
      return { action: { action: 'create_habit', data: { title, color } } }
    }
    case 'create_event': {
      const title = cleanTitle(data.title)
      if (!title) return { error: 'Titre d’événement manquant' }
      const start_at = cleanIsoDate(data.start_at)
      const end_at = cleanIsoDate(data.end_at)
      if (!start_at || !end_at) return { error: 'Dates d’événement invalides' }
      if (new Date(end_at) <= new Date(start_at)) {
        return { error: 'La fin doit être après le début' }
      }
      const description = cleanDescription(data.description)
      if (description === null) return { error: 'Description invalide' }
      return {
        action: {
          action: 'create_event',
          data: { title, start_at, end_at, description },
        },
      }
    }
    case 'create_family_task': {
      const title = cleanTitle(data.title)
      if (!title) return { error: 'Titre de tâche manquant' }
      const family_id = typeof data.family_id === 'string' && UUID_RE.test(data.family_id) ? data.family_id : null
      if (!family_id) return { error: 'Identifiant de famille invalide' }
      return { action: { action: 'create_family_task', data: { title, family_id } } }
    }
    case 'create_memory': {
      const content =
        typeof data.content === 'string' &&
        data.content.trim().length > 0 &&
        data.content.trim().length <= MAX_MEMORY_LENGTH
          ? data.content.trim()
          : null
      if (!content) return { error: 'Mémoire invalide (1 à 500 caractères)' }
      const category =
        data.category !== undefined && data.category !== null
          ? MEMORY_CATEGORIES.includes(data.category as MemoryCategory)
            ? (data.category as MemoryCategory)
            : null
          : undefined
      if (category === null) return { error: 'Catégorie de mémoire invalide' }
      return { action: { action: 'create_memory', data: { content, category } } }
    }
    default:
      return { error: 'Action inconnue' }
  }
}

/* ------------------------------------------------------------------ */
/* Execution (user_id always from the authenticated session)           */
/* ------------------------------------------------------------------ */

export async function executeAiAction(
  supabase: SupabaseClient,
  userId: string,
  action: AiAction
): Promise<AiActionResult> {
  try {
    switch (action.action) {
      case 'create_task': {
        const { data, error } = await supabase
          .from('tasks')
          .insert({
            user_id: userId,
            title: action.data.title,
            description: action.data.description ?? null,
            priority: action.data.priority ?? 'medium',
            due_date: action.data.due_date ?? null,
            tags: action.data.tags ?? [],
          })
          .select('id')
          .single()
        if (error) throw error
        return {
          action: action.action,
          ok: true,
          message: 'Tâche créée',
          title: action.data.title,
          id: data?.id,
        }
      }
      case 'create_tasks_batch':
      case 'create_objective': {
        const { data: parent, error: parentErr } = await supabase
          .from('tasks')
          .insert({
            user_id: userId,
            title: action.data.parent_title,
            priority: 'medium',
            status: 'todo',
          })
          .select('id')
          .single()
        if (parentErr) throw parentErr
        const { error: stepsErr } = await supabase.from('tasks').insert(
          action.data.steps.map((title) => ({
            user_id: userId,
            parent_id: parent?.id,
            title,
            priority: 'low',
            status: 'todo',
          }))
        )
        if (stepsErr) throw stepsErr
        return {
          action: action.action,
          ok: true,
          message: `Objectif découpé en ${action.data.steps.length} étapes`,
          title: action.data.parent_title,
          id: parent?.id,
        }
      }
      case 'create_habit': {
        const { data, error } = await supabase
          .from('habits')
          .insert({
            user_id: userId,
            title: action.data.title,
            color: action.data.color ?? undefined,
          })
          .select('id')
          .single()
        if (error) throw error
        return {
          action: action.action,
          ok: true,
          message: 'Habitude créée',
          title: action.data.title,
          id: data?.id,
        }
      }
      case 'create_event': {
        const { data, error } = await supabase
          .from('events')
          .insert({
            user_id: userId,
            title: action.data.title,
            description: action.data.description ?? null,
            start_at: action.data.start_at,
            end_at: action.data.end_at,
          })
          .select('id')
          .single()
        if (error) throw error
        return {
          action: action.action,
          ok: true,
          message: 'Événement créé',
          title: action.data.title,
          id: data?.id,
        }
      }
      case 'create_family_task': {
        // Verify membership first (RLS would also block, but this gives a
        // clean error message and never leaks another family's existence).
        const { data: membership, error: memberErr } = await supabase
          .from('family_members')
          .select('family_id')
          .eq('family_id', action.data.family_id)
          .eq('user_id', userId)
          .maybeSingle()
        if (memberErr) throw memberErr
        if (!membership) {
          return {
            action: action.action,
            ok: false,
            message: 'Vous n’appartenez pas à cette famille',
          }
        }
        const { data, error } = await supabase
          .from('family_tasks')
          .insert({
            family_id: action.data.family_id,
            user_id: userId,
            title: action.data.title,
          })
          .select('id')
          .single()
        if (error) throw error
        return {
          action: action.action,
          ok: true,
          message: 'Tâche familiale créée',
          title: action.data.title,
          id: data?.id,
        }
      }
      case 'create_memory': {
        const { data, error } = await supabase
          .from('ai_memories')
          .insert({
            user_id: userId,
            content: action.data.content,
            category: action.data.category ?? 'fact',
          })
          .select('id')
          .single()
        if (error) throw error
        return {
          action: action.action,
          ok: true,
          message: 'Mémoire enregistrée',
          title: action.data.content,
          id: data?.id,
        }
      }
    }
  } catch (err) {
    console.error('[Kininaru] AI action failed:', err)
    return {
      action: action.action,
      ok: false,
      message: "L'action n'a pas pu être enregistrée. Réessayez dans un instant.",
    }
  }
}
