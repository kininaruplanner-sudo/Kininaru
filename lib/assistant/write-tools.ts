/**
 * Kininaru Assistant — Write Tools
 *
 * Data-mutating actions. These tools require user confirmation before
 * execution. The confirmation flow is handled by the client (actions-panel.tsx).
 *
 * Security: user_id is ALWAYS set from the authenticated session, never
 * from the client payload. All inserts go through Supabase with RLS.
 */

import { registerTool, type ToolContext, type ToolResult } from './tools'

/* ------------------------------------------------------------------ */
/* create_task                                                        */
/* ------------------------------------------------------------------ */

registerTool(
  {
    name: 'create_task',
    description: 'Crée une nouvelle tâche pour l\'utilisateur.',
    category: 'write',
    requiresConfirmation: true,
    params: [
      { name: 'title', type: 'string', required: true, description: 'Titre de la tâche' },
      { name: 'description', type: 'string', required: false, description: 'Description optionnelle' },
      { name: 'priority', type: 'string', required: false, description: 'Priorité', enum: ['low', 'medium', 'high', 'urgent'] },
      { name: 'due_date', type: 'string', required: false, description: 'Date d\'échéance (AAAA-MM-JJ)' },
      { name: 'tags', type: 'string[]', required: false, description: 'Étiquettes (max 5)' },
    ],
  },
  async (ctx: ToolContext, params: Record<string, unknown>): Promise<ToolResult> => {
    const title = params.title as string
    const { data, error } = await ctx.supabase
      .from('tasks')
      .insert({
        user_id: ctx.userId,
        title,
        description: (params.description as string) ?? null,
        priority: (params.priority as string) ?? 'medium',
        due_date: (params.due_date as string) ?? null,
        tags: (params.tags as string[]) ?? [],
      })
      .select('id')
      .single()

    if (error) throw error

    return {
      ok: true,
      data: { id: data?.id, title },
      summary: `Tâche « ${title} » créée`,
    }
  }
)

/* ------------------------------------------------------------------ */
/* complete_task                                                      */
/* ------------------------------------------------------------------ */

registerTool(
  {
    name: 'complete_task',
    description: 'Marque une tâche comme terminée. Utiliser l\'id de la tâche retournée par get_today_tasks.',
    category: 'write',
    requiresConfirmation: true,
    params: [
      { name: 'task_id', type: 'string', required: true, description: 'ID de la tâche à terminer' },
    ],
  },
  async (ctx: ToolContext, params: Record<string, unknown>): Promise<ToolResult> => {
    const taskId = params.task_id as string

    // First verify the task belongs to this user (RLS would also block, but
    // this gives a clean error message)
    const { data: task, error: fetchErr } = await ctx.supabase
      .from('tasks')
      .select('id, title, status')
      .eq('id', taskId)
      .eq('user_id', ctx.userId)
      .single()

    if (fetchErr || !task) {
      return { ok: false, error: 'Tâche introuvable', summary: 'Tâche introuvable' }
    }

    if (task.status === 'done') {
      return { ok: false, error: 'Cette tâche est déjà terminée', summary: 'Tâche déjà terminée' }
    }

    const { error } = await ctx.supabase
      .from('tasks')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', taskId)
      .eq('user_id', ctx.userId)

    if (error) throw error

    return {
      ok: true,
      data: { id: taskId, title: task.title },
      summary: `Tâche « ${task.title} » marquée comme terminée`,
    }
  }
)

/* ------------------------------------------------------------------ */
/* update_task                                                        */
/* ------------------------------------------------------------------ */

registerTool(
  {
    name: 'update_task',
    description: 'Modifie une tâche existante (titre, priorité, date d\'échéance, statut). Utile pour re-planifier.',
    category: 'write',
    requiresConfirmation: true,
    params: [
      { name: 'task_id', type: 'string', required: true, description: 'ID de la tâche à modifier' },
      { name: 'title', type: 'string', required: false, description: 'Nouveau titre' },
      { name: 'priority', type: 'string', required: false, description: 'Nouvelle priorité', enum: ['low', 'medium', 'high', 'urgent'] },
      { name: 'due_date', type: 'string', required: false, description: 'Nouvelle date d\'échéance (AAAA-MM-JJ)' },
      { name: 'status', type: 'string', required: false, description: 'Nouveau statut', enum: ['todo', 'in_progress', 'done'] },
    ],
  },
  async (ctx: ToolContext, params: Record<string, unknown>): Promise<ToolResult> => {
    const taskId = params.task_id as string

    const { data: existing, error: fetchErr } = await ctx.supabase
      .from('tasks')
      .select('id, title')
      .eq('id', taskId)
      .eq('user_id', ctx.userId)
      .single()

    if (fetchErr || !existing) {
      return { ok: false, error: 'Tâche introuvable', summary: 'Tâche introuvable' }
    }

    const updates: Record<string, unknown> = {}
    if (params.title !== undefined) updates.title = params.title
    if (params.priority !== undefined) updates.priority = params.priority
    if (params.due_date !== undefined) updates.due_date = params.due_date
    if (params.status !== undefined) {
      updates.status = params.status
      if (params.status === 'done') updates.completed_at = new Date().toISOString()
    }

    if (Object.keys(updates).length === 0) {
      return { ok: false, error: 'Aucune modification spécifiée', summary: 'Aucune modification' }
    }

    const { error } = await ctx.supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .eq('user_id', ctx.userId)

    if (error) throw error

    return {
      ok: true,
      data: { id: taskId, ...updates },
      summary: `Tâche « ${existing.title} » mise à jour`,
    }
  }
)

/* ------------------------------------------------------------------ */
/* start_focus                                                        */
/* ------------------------------------------------------------------ */

registerTool(
  {
    name: 'start_focus',
    description: 'Enregistre une session de focus terminée avec sa durée en minutes. Utilisé quand l\'utilisateur termine une session de concentration.',
    category: 'write',
    requiresConfirmation: true,
    params: [
      { name: 'duration_minutes', type: 'number', required: true, description: 'Durée de la session en minutes' },
    ],
  },
  async (ctx: ToolContext, params: Record<string, unknown>): Promise<ToolResult> => {
    const duration = params.duration_minutes as number

    if (duration < 1 || duration > 480) {
      return { ok: false, error: 'Durée invalide (1 à 480 minutes)', summary: 'Durée invalide' }
    }

    const { data, error } = await ctx.supabase
      .from('focus_sessions')
      .insert({
        user_id: ctx.userId,
        duration_minutes: Math.round(duration),
      })
      .select('id')
      .single()

    if (error) throw error

    return {
      ok: true,
      data: { id: data?.id, duration_minutes: Math.round(duration) },
      summary: `Session de focus de ${Math.round(duration)} minutes enregistrée`,
    }
  }
)


/* ------------------------------------------------------------------ */
/* delete_memory                                                       */
/* ------------------------------------------------------------------ */

registerTool(
  {
    name: 'delete_memory',
    description: 'Supprime un souvenir de l\'utilisateur. Utile quand une information n\'est plus pertinente.',
    category: 'sensitive',
    requiresConfirmation: true,
    confirmationLabel: 'Supprimer le souvenir',
    canUndo: false,
    params: [
      { name: 'memory_id', type: 'string', required: true, description: 'ID du souvenir à supprimer' },
    ],
  },
  async (ctx: ToolContext, params: Record<string, unknown>): Promise<ToolResult> => {
    const memoryId = params.memory_id as string
    const { error } = await ctx.supabase
      .from('ai_memories')
      .delete()
      .eq('id', memoryId)
      .eq('user_id', ctx.userId)

    if (error) throw error

    return {
      ok: true,
      data: { id: memoryId },
      summary: 'Souvenir supprimé',
    }
  }
)
