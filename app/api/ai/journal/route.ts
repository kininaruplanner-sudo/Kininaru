import { createGroq } from '@ai-sdk/groq'
import { generateText } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { isRateLimited } from '@/lib/ai/rate-limit'

export const runtime = 'nodejs'

/**
 * POST /api/ai/journal
 *
 * Journal AI actions (ÉTAPE 15.5): Résumer / Idées principales / M'aider à
 * réfléchir / Créer un objectif / Créer des tâches / Créer un plan.
 *
 * - Groq stays server-side; the key never leaves this file.
 * - The model receives ONLY the journal text the user explicitly selected —
 *   nothing else from their account (privacy by construction).
 * - "goal" / "tasks" / "plan" return a STRUCTURED proposal
 *   ({ title, steps }) that the client renders with per-step confirmation
 *   before anything is created. The journal endpoint itself never writes to
 *   the database — creation goes through the validated /api/ai/actions.
 * - Advice-only for the text modes: no action protocol, no memory writes.
 */

const MODES = new Set(['summarize', 'ideas', 'actions', 'reflect', 'goal', 'tasks', 'plan'])
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
  reflect:
    'Tu es un coach bienveillant. À partir de ce texte de journal, pose 3-4 questions ouvertes et ' +
    'encourageantes pour aider à réfléchir (en français). Sans jugement, sans diagnostic. ' +
    'Termine par une micro-action possible de 5 minutes.',
  goal:
    'Transforme ce texte de journal en UN objectif clair et réalisable. Réponds UNIQUEMENT avec un objet ' +
    'JSON valide de la forme {"title": "objectif en une phrase", "steps": ["étape 1", "étape 2", ...]} ' +
    '(3 à 6 étapes, chacune en « verbe + objet », maximum 12 mots). Ne mets aucun autre texte avant ou après le JSON.',
  tasks:
    'À partir de ce texte de journal, extrais les tâches concrètes à faire (1 à 6). Réponds UNIQUEMENT avec ' +
    'un objet JSON valide de la forme {"title": "Tâches du journal", "steps": ["tâche 1", "tâche 2", ...]}. ' +
    'Ne mets aucun autre texte avant ou après le JSON.',
  plan:
    'À partir de ce texte de journal, construis un plan simple et réaliste pour la journée ou la semaine. ' +
    'Réponds UNIQUEMENT avec un objet JSON valide de la forme {"title": "nom du plan", "steps": ["étape 1", ...]} ' +
    '(3 à 6 étapes). Ne mets aucun autre texte avant ou après le JSON.',
}

export interface JournalProposal {
  title: string
  steps: string[]
}

// Distributed rate limit (supabase/ai-rate-limit.sql) — 10 appels/min max.
const RATE_LIMIT_MAX = 10

/** Extracts a well-formed { title, steps } object from a model answer. */
function parseProposal(raw: string): JournalProposal | null {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[0]) as { title?: unknown; steps?: unknown }
    if (typeof parsed.title !== 'string' || !parsed.title.trim()) return null
    if (!Array.isArray(parsed.steps) || parsed.steps.length < 1 || parsed.steps.length > 10) {
      return null
    }
    const steps: string[] = []
    for (const s of parsed.steps) {
      if (typeof s !== 'string' || !s.trim() || s.trim().length > 200) return null
      steps.push(s.trim())
    }
    if (steps.length === 0) return null
    return { title: parsed.title.trim().slice(0, 200), steps }
  } catch {
    return null
  }
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
    if (await isRateLimited('journal', user.id, RATE_LIMIT_MAX)) {
      return Response.json({ error: 'Trop de requêtes. Réessaie dans un instant.' }, { status: 429 })
    }

    const body = (await req.json().catch(() => ({}))) as { text?: unknown; mode?: unknown }
    const mode = typeof body.mode === 'string' && MODES.has(body.mode) ? body.mode : null
    const text = typeof body.text === 'string' ? body.text.trim() : ''

    if (!mode) return Response.json({ error: 'Mode inconnu' }, { status: 400 })
    if (text.length < 20 || text.length > MAX_TEXT) {
      return Response.json(
        { error: 'Texte trop court ou trop long (20 à 8000 caractères)' },
        { status: 400 }
      )
    }

    if (!process.env.GROQ_API_KEY) {
      return Response.json({ error: 'Clé API manquante' }, { status: 500 })
    }

    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
    const structured = mode === 'goal' || mode === 'tasks' || mode === 'plan'

    const result = await generateText({
      // Groq-hosted model (ÉTAPE 15.5 §19): replaces the deprecated
      // llama-3.3-70b-versatile with Groq's recommended gpt-oss-120b.
      model: groq('openai/gpt-oss-120b'),
      system:
        "Tu es le coach Kininaru, bienveillant et concret. Tu réponds en français, sans jugement, " +
        "et tu n’inventes jamais de faits absents du texte fourni. Tu ne donnes aucun avis médical.",
      prompt: `${PROMPTS[mode]}\n\nTexte du journal :\n${text}`,
    })

    const answer = result.text.trim()

    // Structured modes: try to extract a proposal the client can confirm.
    if (structured) {
      const proposal = parseProposal(answer)
      if (proposal) {
        const human =
          `${proposal.title}\n\n` +
          proposal.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')
        return Response.json({ text: human, structured: proposal })
      }
    }

    return Response.json({ text: answer, structured: null })
  } catch {
    // Generic error on purpose — never leak internals.
    return Response.json(
      { error: "L'assistant est temporairement indisponible. Réessaie dans un instant." },
      { status: 500 }
    )
  }
}
