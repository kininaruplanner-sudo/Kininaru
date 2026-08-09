import { createGroq } from '@ai-sdk/groq';
import { streamText, type ModelMessage } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { buildSystemPrompt, buildUserContext } from '@/lib/ai/prompts';

export const runtime = 'nodejs';

// Reasonable guardrails: cap the number of exchanged messages and the size of
// each one so a single client cannot push unbounded input to the model.
const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 8000;
const ALLOWED_ROLES = new Set(['user', 'assistant']);

// Lightweight in-memory rate limiter: max N requests per rolling minute per
// user, so a single authenticated account cannot burn through the Groq quota.
// In-memory is fine for a single instance; swap for a Redis-backed limiter
// (e.g. Upstash) if the app is ever scaled horizontally.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const rateBuckets = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (rateBuckets.get(userId) ?? []).filter((t) => t > cutoff);
  if (timestamps.length >= RATE_LIMIT_MAX) {
    rateBuckets.set(userId, timestamps);
    return true;
  }
  timestamps.push(now);
  rateBuckets.set(userId, timestamps);
  return false;
}



export async function POST(req: Request) {
  try {
    // The AI assistant is a paid, authenticated feature: reject anonymous callers
    // so the Groq key cannot be consumed by unauthenticated clients.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: 'Non authentifié' }, { status: 401 });
    }

    if (isRateLimited(user.id)) {
      return Response.json(
        { error: 'Trop de requêtes. Réessaie dans un instant.' },
        { status: 429 }
      );
    }

    const body = (await req.json()) as { messages?: ModelMessage[]; actionsEnabled?: boolean };
    const { messages } = body;
    // `actionsEnabled` lets callers opt out of the action protocol (e.g. the
    // dashboard insight card is advice-only). Defaults to true for the chat.
    const actionsEnabled = body.actionsEnabled !== false;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: 'Messages manquants' }, { status: 400 });
    }

    if (messages.length > MAX_MESSAGES) {
      return Response.json(
        { error: 'Trop de messages dans la conversation' },
        { status: 400 }
      );
    }

    // Validate every message shape and cap its length (server-side only —
    // never trust the browser).
    for (const m of messages) {
      if (
        !m ||
        typeof m.role !== 'string' ||
        !ALLOWED_ROLES.has(m.role) ||
        typeof m.content !== 'string' ||
        m.content.length > MAX_MESSAGE_LENGTH
      ) {
        return Response.json({ error: 'Message invalide' }, { status: 400 });
      }
    }

    // AI 2.0: gather a minimal, relevant snapshot of the signed-in user's
    // own data (RLS-scoped) and steer the model with the full coach prompt.
    const context = await buildUserContext(supabase, user.id);
    const system = buildSystemPrompt({ context: context.text, actionsEnabled });

    if (!process.env.GROQ_API_KEY) {
      console.error("❌ GROQ_API_KEY manquant dans .env.local");
      return Response.json({ error: "Clé API manquante" }, { status: 500 });
    }

    const groq = createGroq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const result = streamText({
      model: groq('llama-3.3-70b-versatile'),
      system,
      messages,
    });

    // Réponse en streaming texte brut : le client lit le flux au fur et à mesure.
    return result.toTextStreamResponse();
  } catch (error) {
    // Generic error on purpose: never leak stack traces or internal details.
    console.error("❌ Erreur serveur chat:", error);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
