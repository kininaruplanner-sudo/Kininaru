import { createClient } from '@/lib/supabase/server'
import { validateAiAction, executeAiAction, type AiAction } from '@/lib/ai/actions'
import { isRateLimited } from '@/lib/ai/rate-limit'

export const runtime = 'nodejs'

// Distributed rate limit (supabase/ai-rate-limit.sql) so a single account
// cannot hammer the endpoint across serverless instances.
const MAX_PER_MINUTE = 40

const MAX_ACTIONS = 5
const MAX_BODY = 60_000

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (await isRateLimited('actions', user.id, MAX_PER_MINUTE)) {
      return Response.json(
        { error: 'Trop de requêtes. Réessayez dans un instant.' },
        { status: 429 }
      )
    }

    const rawBody = await req.text()
    if (rawBody.length > MAX_BODY) {
      return Response.json({ error: 'Requête trop grande' }, { status: 413 })
    }

    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return Response.json({ error: 'JSON invalide' }, { status: 400 })
    }

    const actionsRaw =
      typeof body === 'object' && body !== null && 'actions' in body && Array.isArray(body.actions)
        ? body.actions
        : null
    if (!actionsRaw || actionsRaw.length === 0) {
      return Response.json({ error: 'Aucune action fournie' }, { status: 400 })
    }
    if (actionsRaw.length > MAX_ACTIONS) {
      return Response.json({ error: 'Trop d’actions (5 maximum)' }, { status: 400 })
    }

    // Validate every action first; execute only if ALL are structurally valid.
    const validated = actionsRaw.map((raw: unknown) => validateAiAction(raw)) as {
      action?: AiAction
      error?: string
    }[]
    const invalid = validated.find((v) => v.error)
    if (invalid) {
      return Response.json(
        { error: invalid.error ?? 'Action invalide' },
        { status: 400 }
      )
    }

    const results = []
    for (const v of validated) {
      if (!v.action) continue
      results.push(await executeAiAction(supabase, user.id, v.action))
    }

    return Response.json({ results })
  } catch {
    // Generic on purpose — never leak internals to the client.
    return Response.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
