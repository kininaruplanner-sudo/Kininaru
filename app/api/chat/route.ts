import { createGroq } from '@ai-sdk/groq';
import { streamText, type ModelMessage } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { buildSystemPrompt, buildUserContext } from '@/lib/ai/prompts';
import { buildEnrichedContext } from '@/lib/assistant/context-builder';
import { isRateLimited } from '@/lib/ai/rate-limit';

export const runtime = 'nodejs';

// Reasonable guardrails: cap the number of exchanged messages and the size of
// each one so a single client cannot push unbounded input to the model.
const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 8000;
const ALLOWED_ROLES = new Set(['user', 'assistant']);

// Distributed rate limiter (supabase/ai-rate-limit.sql): max N requests per
// rolling minute per user, so a single authenticated account cannot burn
// through the Groq quota — enforced globally across serverless instances.
const RATE_LIMIT_MAX = 20;

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

    if (await isRateLimited('chat', user.id, RATE_LIMIT_MAX)) {
      return Response.json(
        { error: 'Trop de requêtes. Réessaie dans un instant.' },
        { status: 429 }
      );
    }

    const body = (await req.json()) as {
      messages?: ModelMessage[];
      actionsEnabled?: boolean;
      memoryEnabled?: boolean;
    };
    const { messages } = body;
    // `actionsEnabled` lets callers opt out of the action protocol (e.g. the
    // dashboard insight card is advice-only). Defaults to true for the chat.
    const actionsEnabled = body.actionsEnabled !== false;
    // `memoryEnabled` mirrors the Settings → Mémoire master switch: when the
    // user turns it OFF, saved memories are never injected as context.
    const memoryEnabled = body.memoryEnabled !== false;

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

    // Build enriched context with next-action suggestion
    // Pass the latest user message for relevant memory selection
    const lastMsg = messages[messages.length - 1]
    const latestUserMessage = typeof lastMsg?.content === 'string' ? lastMsg.content : undefined
    const enrichedContext = await buildEnrichedContext(supabase, user.id, {
      includeMemory: memoryEnabled,
      userMessage: latestUserMessage,
    });

    // Also build the legacy context for backward compatibility
    const legacyContext = await buildUserContext(supabase, user.id, {
      includeMemory: memoryEnabled,
    });

    // Combine contexts: enriched context takes priority, legacy fills gaps
    const contextText = enrichedContext.text || legacyContext.text

    // Inject next action suggestion into the context
    const nextActionHint = enrichedContext.nextAction
      ? `\n\nPROCHAINE ACTION SUGGÉRÉE (à considérer dans ta réponse) :\n` +
        `• ${enrichedContext.nextAction.title}\n` +
        `• Raison : ${enrichedContext.nextAction.reason}\n` +
        `• ID : ${enrichedContext.nextAction.taskId}`
      : ''

    const system = buildSystemPrompt({
      context: contextText + nextActionHint,
      actionsEnabled,
    });

    if (!process.env.GROQ_API_KEY) {
      console.error("❌ GROQ_API_KEY manquant dans .env.local");
      return Response.json({ error: "Clé API manquante" }, { status: 500 });
    }

    const groq = createGroq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const result = streamText({
      // Groq-hosted model: gpt-oss-120b
      model: groq('openai/gpt-oss-120b'),
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
