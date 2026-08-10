import { createGroq } from '@ai-sdk/groq'
import { generateText } from 'ai'
import { format, subDays } from 'date-fns'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * POST /api/coach/weekly
 *
 * Weekly brief (ÉTAPE 15.5 §13): real 7-day statistics of the signed-in
 * user's OWN data (RLS), condensed into a tiny summary, then — only when it
 * adds value and the key is configured — a SHORT Groq analysis (≤ 4
 * sentences). The database is never sent to the model, only the compact
 * summary (a few numbers and labels).
 *
 * Cost control (§20): rate-limited (3/min), fires once a week client-side,
 * and falls back to a deterministic template when Groq is unavailable so the
 * feature never breaks without the key.
 */

const WINDOW_MS = 60_000
const MAX_PER_MINUTE = 3
const buckets = new Map<string, number[]>()

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const cutoff = now - WINDOW_MS
  const timestamps = (buckets.get(key) ?? []).filter((t) => t > cutoff)
  if (timestamps.length >= MAX_PER_MINUTE) {
    buckets.set(key, timestamps)
    return true
  }
  timestamps.push(now)
  buckets.set(key, timestamps)
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

    const now = new Date()
    const weekAgo = subDays(now, 7).toISOString()
    const todayKey = format(now, 'yyyy-MM-dd')
    const dayKeys: string[] = []
    for (let i = 6; i >= 0; i--) dayKeys.push(format(subDays(now, i), 'yyyy-MM-dd'))

    const [{ data: doneTasks }, { data: sessions }, { data: habitLogs }, { data: journalEntries }] =
      await Promise.all([
        supabase
          .from('tasks')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'done')
          .gte('completed_at', weekAgo),
        supabase
          .from('focus_sessions')
          .select('duration_minutes, created_at')
          .eq('user_id', user.id)
          .gte('created_at', weekAgo),
        supabase
          .from('habit_logs')
          .select('habit_id, logged_date')
          .eq('user_id', user.id)
          .gte('logged_date', dayKeys[0]),
        supabase
          .from('journal_entries')
          .select('id, entry_date')
          .eq('user_id', user.id)
          .gte('entry_date', dayKeys[0]),
      ])

    const stats = {
      tasksDone: doneTasks?.length ?? 0,
      focusMinutes: (sessions ?? []).reduce(
        (sum: number, s: { duration_minutes?: number }) => sum + (s.duration_minutes || 0),
        0
      ),
      focusSessions: (sessions ?? []).length,
      habitsLogged: (habitLogs ?? []).length,
      journalDays: (journalEntries ?? []).length,
      activeDays: new Set(
        (habitLogs ?? []).map((l: { logged_date: string }) => l.logged_date)
      ).size,
    }

    const compact =
      `Statistiques des 7 derniers jours : ${stats.tasksDone} tâches terminées, ` +
      `${stats.focusMinutes} minutes de Focus en ${stats.focusSessions} sessions, ` +
      `${stats.habitsLogged} habitudes cochées (${stats.activeDays} jour(s) actif(s) sur 7), ` +
      `${stats.journalDays} entrées de journal.`

    let analysis: string
    if (process.env.GROQ_API_KEY) {
      try {
        const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
        const result = await generateText({
          // Groq-hosted model (ÉTAPE 15.5 §19) — replaces deprecated
          // llama-3.3-70b-versatile with Groq's recommended gpt-oss-120b.
          model: groq('openai/gpt-oss-120b'),
          system:
            'Tu es le coach Kininaru. Tu produis UNIQUEMENT une courte analyse hebdomadaire ' +
            'bienveillante en français (2 à 4 phrases max), à partir des chiffres fournis. ' +
            'Tu ne prétends jamais savoir autre chose, tu ne donnes aucun avis médical, tu ' +
            'reconnais les progrès et proposes UNE seule piste concrète si pertinent.',
          prompt: compact,
        })
        analysis = result.text.trim()
      } catch {
        analysis = fallbackAnalysis(stats)
      }
    } else {
      analysis = fallbackAnalysis(stats)
    }

    return Response.json({
      stats,
      text: analysis,
    })
  } catch {
    return Response.json({ error: 'Service indisponible' }, { status: 500 })
  }
}

function fallbackAnalysis(stats: {
  tasksDone: number
  focusMinutes: number
  focusSessions: number
  habitsLogged: number
  journalDays: number
}): string {
  if (stats.tasksDone === 0 && stats.focusMinutes === 0 && stats.habitsLogged === 0) {
    return 'Semaine calme. Le plus important est de reprendre en douceur : choisis UNE petite action pour demain.'
  }
  const parts: string[] = []
  if (stats.tasksDone > 0)
    parts.push(`${stats.tasksDone} tâche${stats.tasksDone > 1 ? 's' : ''} terminée${stats.tasksDone > 1 ? 's' : ''}`)
  if (stats.focusMinutes > 0)
    parts.push(`${stats.focusMinutes} min de concentration`)
  if (stats.habitsLogged > 0)
    parts.push(`${stats.habitsLogged} habitude${stats.habitsLogged > 1 ? 's' : ''} cochée${stats.habitsLogged > 1 ? 's' : ''}`)
  return `Belle semaine : ${parts.join(', ')}. Continue sur cette dynamique, une étape à la fois.`
}
