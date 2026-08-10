import { createClient } from '@/lib/supabase/server'
import { buildCoachContext, parseCoachPage, type CoachContext } from '@/lib/coach/context'
import {
  evaluateContext,
  isCoachStyle,
  type Observation,
  type CoachStyle,
} from '@/lib/coach/rules'

export const runtime = 'nodejs'

/**
 * POST /api/coach/observe
 *
 * The floating coach (§1-6): returns the most relevant deterministic
 * observation for the signed-in user, built from their OWN data (RLS).
 *
 * Cost control (§37-38): this endpoint NEVER calls Groq. Observations are
 * local rules over a compact daily context. The only writes are optional
 * in-app notifications (the `notifications` table, RLS-protected).
 */

// Lightweight in-memory rate limiter (same pattern as /api/chat): an
// authenticated user can open the coach window a reasonable number of times.
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 40
const rateBuckets = new Map<string, number[]>()

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const cutoff = now - RATE_LIMIT_WINDOW_MS
  const timestamps = (rateBuckets.get(userId) ?? []).filter((t) => t > cutoff)
  if (timestamps.length >= RATE_LIMIT_MAX) {
    rateBuckets.set(userId, timestamps)
    return true
  }
  timestamps.push(now)
  rateBuckets.set(userId, timestamps)
  return false
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (isRateLimited(user.id)) {
      return Response.json({ error: 'Trop de requêtes. Réessaie dans un instant.' }, { status: 429 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      page?: unknown
      style?: unknown
      notify?: unknown
    }
    const page = parseCoachPage(body.page)
    const style: CoachStyle = isCoachStyle(body.style) ? body.style : 'encouraging'

    const ctx: CoachContext = await buildCoachContext(supabase, user.id)
    const observations: Observation[] = evaluateContext(ctx, page, style)
    const observation = observations[0] ?? null

    // In-app notification (the bell in the sidebar) — only when the user
    // opted in, the rule is notification-worthy, and the client already
    // applied its frequency guard. The insert is RLS-scoped to this user.
    let notificationId: string | null = null
    if (
      body.notify === true &&
      observation &&
      observation.notify &&
      (observation.tone === 'nudge' ||
        observation.tone === 'celebration' ||
        observation.tone === 'wow')
    ) {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          type: 'info',
          title: 'Kininaru Coach',
          body: observation.message,
          link: observation.action?.href ?? null,
        })
        .select('id')
        .single()
      if (!error && data) notificationId = (data as { id: string }).id
    }

    return Response.json({
      observation,
      context: {
        hour: ctx.hour,
        tasksToday: ctx.tasksToday,
        tasksCompleted: ctx.tasksCompleted,
        tasksOverdue: ctx.tasksOverdue,
        priorityTasksRemaining: ctx.priorityTasksRemaining,
        habitsDoneToday: ctx.habitsDoneToday,
        habitsTotal: ctx.habitsTotal,
        eventsToday: ctx.eventsToday,
        focusMinutesToday: ctx.focusMinutesToday,
        journalThisWeek: ctx.journalThisWeek,
      },
      nextAction: ctx.nextPriorityTask
        ? { title: ctx.nextPriorityTask.title, taskId: ctx.nextPriorityTask.id }
        : null,
      notificationId,
    })
  } catch {
    return Response.json({ error: 'Service indisponible' }, { status: 500 })
  }
}
