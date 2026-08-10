import { createGroq } from '@ai-sdk/groq'
import { generateText } from 'ai'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * POST /api/ai/journal
 *
 * Journal AI actions (§27): Résumer / Idées principales / Liste d'actions.
 *
 * - Groq stays server-side; the key never leaves this file.
 * - The model receives ONLY the journal text the user explicitly selected —
 *   nothing else from their account (privacy by construction).
 * - Advice-only: no action protocol, no memory writes, no SQL.
 */

const MODES = new Set(['summarize', 'ideas', 'actions'])
const MAX_TEXT = 8000

const PROMPTS: Record<string, string> = {
  summarize:
    'Résume ce texte de journal en 5-7 lignes claires et bienveillantes, en français. ' +
    'Sans jugement, sans inventer de faits absents du texte. Mets en avant les émotions, les réussites et les difficultés.',
  ideas:
    'Trouve les idées principales et les thèmes récurrents de ce texte de journal, en français. ' +
    '3 à 5 points courts, concrets, bienveillants. Ne prétends pas savoir ce qui n’est pas dans le texte.',
  actions:
    'Transforme ce texte de journal en une liste d’actions concrètes et réalistes, en français. ' +
    'Maximum 5 actions, format « verbe + objet » (ex. « Réserver 20 min demain pour réviser »). ' +
    'Aucune action médicale ou thérapeutique.',
}

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 10
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

    const body = (await req.json().catch(() => ({}))) as { text?: unknown; mode?: unknown }
    const mode = typeof body.mode === 'string' && MODES.has(body.mode) ? body.mode : null
    const text = typeof body.text === 'string' ? body.text.trim() : ''

    if (!mode) return Response.json({ error: 'Mode inconnu' }, { status: 400 })
    if (text.length < 40 || text.length > MAX_TEXT) {
      return Response.json(
        { error: 'Texte trop court ou trop long (40 à 8000 caractères)' },
        { status: 400 }
      )
    }

    if (!process.env.GROQ_API_KEY) {
      return Response.json({ error: 'Clé API manquante' }, { status: 500 })
    }

    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
    const result = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      system:
        "Tu es le coach Kininaru, bienveillant et concret. Tu réponds en français, sans jugement, " +
        'et tu n’inventes jamais de faits absents du texte fourni. Tu ne donnes aucun avis médical.',
      prompt: `${PROMPTS[mode]}\n\nTexte du journal :\n${text}`,
    })

    return Response.json({ text: result.text.trim() })
  } catch {
    // Generic error on purpose — never leak internals.
    return Response.json(
      { error: "L'assistant est temporairement indisponible. Réessaie dans un instant." },
      { status: 500 }
    )
  }
}
