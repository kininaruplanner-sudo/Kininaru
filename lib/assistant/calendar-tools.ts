/**
 * Kininaru Assistant — Calendar Tools
 *
 * Tools for interacting with the user's calendar events.
 * Uses the existing Supabase `events` table and calendar integrations.
 *
 * Security:
 * - All queries are scoped to the authenticated user via RLS
 * - External calendar actions require explicit confirmation
 * - OAuth tokens are never exposed to the client
 */

import { format, addDays, parseISO } from 'date-fns'
import { registerTool, type ToolContext, type ToolResult } from './tools'

/* ------------------------------------------------------------------ */
/* get_calendar_events                                                */
/* ------------------------------------------------------------------ */

registerTool(
  {
    name: 'get_calendar_events',
    description: 'Récupère les événements du calendrier de l\'utilisateur. Utile pour consulter le planning.',
    category: 'read',
    requiresConfirmation: false,
    params: [
      { name: 'days', type: 'number', required: false, description: 'Nombre de jours à prospecter (défaut: 7)' },
      { name: 'include_past', type: 'boolean', required: false, description: 'Inclure les événements passés (défaut: false)' },
    ],
  },
  async (ctx: ToolContext, params: Record<string, unknown>): Promise<ToolResult> => {
    const days = typeof params.days === 'number' ? Math.min(params.days, 30) : 7
    const includePast = params.include_past === true

    const now = new Date()
    const endDate = addDays(now, days)

    let query = ctx.supabase
      .from('events')
      .select('id, title, start_at, end_at, category, color')
      .eq('user_id', ctx.userId)
      .order('start_at', { ascending: true })
      .limit(20)

    if (includePast) {
      query = query.gte('end_at', addDays(now, -7).toISOString())
    } else {
      query = query.gte('start_at', now.toISOString())
    }

    query = query.lte('start_at', endDate.toISOString())

    const { data: events } = await query
    const eventList = events ?? []

    return {
      ok: true,
      data: { events: eventList, days },
      summary: eventList.length > 0
        ? `${eventList.length} événement${eventList.length > 1 ? 's' : ''} dans les ${days} prochains jours`
        : `Aucun événement prévu dans les ${days} prochains jours`,
    }
  }
)

/* ------------------------------------------------------------------ */
/* create_calendar_event                                              */
/* ------------------------------------------------------------------ */

registerTool(
  {
    name: 'create_calendar_event',
    description: 'Crée un nouvel événement dans le calendrier de l\'utilisateur.',
    category: 'external',
    requiresConfirmation: true,
    confirmationLabel: 'Créer l\'événement',
    canUndo: true,
    params: [
      { name: 'title', type: 'string', required: true, description: 'Titre de l\'événement' },
      { name: 'start_at', type: 'string', required: true, description: 'Date et heure de début (ISO 8601)' },
      { name: 'end_at', type: 'string', required: true, description: 'Date et heure de fin (ISO 8601)' },
      { name: 'description', type: 'string', required: false, description: 'Description optionnelle' },
      { name: 'category', type: 'string', required: false, description: 'Catégorie', enum: ['default', 'work', 'personal', 'health', 'education'] },
    ],
  },
  async (ctx: ToolContext, params: Record<string, unknown>): Promise<ToolResult> => {
    const title = params.title as string
    const startAt = params.start_at as string
    const endAt = params.end_at as string

    // Validate dates
    const startDate = parseISO(startAt)
    const endDate = parseISO(endAt)
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return { ok: false, error: 'Dates invalides', summary: 'Dates invalides' }
    }
    if (endDate <= startDate) {
      return { ok: false, error: 'La fin doit être après le début', summary: 'Dates invalides' }
    }

    const { data, error } = await ctx.supabase
      .from('events')
      .insert({
        user_id: ctx.userId,
        title,
        start_at: startAt,
        end_at: endAt,
        description: (params.description as string) ?? null,
        category: (params.category as string) ?? 'default',
      })
      .select('id')
      .single()

    if (error) throw error

    return {
      ok: true,
      data: { id: data?.id, title, start_at: startAt, end_at: endAt },
      summary: `Événement « ${title} » créé le ${format(startDate, 'd MMM à HH:mm')}`,
    }
  }
)

/* ------------------------------------------------------------------ */
/* update_calendar_event                                              */
/* ------------------------------------------------------------------ */

registerTool(
  {
    name: 'update_calendar_event',
    description: 'Modifie un événement existant du calendrier.',
    category: 'external',
    requiresConfirmation: true,
    confirmationLabel: 'Modifier l\'événement',
    canUndo: false,
    params: [
      { name: 'event_id', type: 'string', required: true, description: 'ID de l\'événement à modifier' },
      { name: 'title', type: 'string', required: false, description: 'Nouveau titre' },
      { name: 'start_at', type: 'string', required: false, description: 'Nouvelle date de début (ISO 8601)' },
      { name: 'end_at', type: 'string', required: false, description: 'Nouvelle date de fin (ISO 8601)' },
      { name: 'description', type: 'string', required: false, description: 'Nouvelle description' },
    ],
  },
  async (ctx: ToolContext, params: Record<string, unknown>): Promise<ToolResult> => {
    const eventId = params.event_id as string

    // Verify ownership
    const { data: existing, error: fetchErr } = await ctx.supabase
      .from('events')
      .select('id, title')
      .eq('id', eventId)
      .eq('user_id', ctx.userId)
      .single()

    if (fetchErr || !existing) {
      return { ok: false, error: 'Événement introuvable', summary: 'Événement introuvable' }
    }

    const updates: Record<string, unknown> = {}
    if (params.title !== undefined) updates.title = params.title
    if (params.start_at !== undefined) updates.start_at = params.start_at
    if (params.end_at !== undefined) updates.end_at = params.end_at
    if (params.description !== undefined) updates.description = params.description

    if (Object.keys(updates).length === 0) {
      return { ok: false, error: 'Aucune modification spécifiée', summary: 'Aucune modification' }
    }

    const { error } = await ctx.supabase
      .from('events')
      .update(updates)
      .eq('id', eventId)
      .eq('user_id', ctx.userId)

    if (error) throw error

    return {
      ok: true,
      data: { id: eventId, ...updates },
      summary: `Événement « ${existing.title} » mis à jour`,
    }
  }
)

/* ------------------------------------------------------------------ */
/* delete_calendar_event                                              */
/* ------------------------------------------------------------------ */

registerTool(
  {
    name: 'delete_calendar_event',
    description: 'Supprime un événement du calendrier.',
    category: 'sensitive',
    requiresConfirmation: true,
    confirmationLabel: 'Supprimer l\'événement',
    canUndo: false,
    params: [
      { name: 'event_id', type: 'string', required: true, description: 'ID de l\'événement à supprimer' },
    ],
  },
  async (ctx: ToolContext, params: Record<string, unknown>): Promise<ToolResult> => {
    const eventId = params.event_id as string

    // Verify ownership
    const { data: existing, error: fetchErr } = await ctx.supabase
      .from('events')
      .select('id, title')
      .eq('id', eventId)
      .eq('user_id', ctx.userId)
      .single()

    if (fetchErr || !existing) {
      return { ok: false, error: 'Événement introuvable', summary: 'Événement introuvable' }
    }

    const { error } = await ctx.supabase
      .from('events')
      .delete()
      .eq('id', eventId)
      .eq('user_id', ctx.userId)

    if (error) throw error

    return {
      ok: true,
      data: { id: eventId, title: existing.title },
      summary: `Événement « ${existing.title} » supprimé`,
    }
  }
)
