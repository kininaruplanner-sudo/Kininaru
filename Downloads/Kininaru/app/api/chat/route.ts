import { createGroq } from '@ai-sdk/groq';
import { streamText, type ModelMessage } from 'ai';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `Tu es Kininaru, un coach en productivité et en organisation, bienveillant, enthousiaste et concis.
Tu aides l'utilisateur à planifier sa journée, construire de bonnes habitudes, fixer des objectifs atteignables et rester motivé.
Tu réponds toujours en français, avec un ton chaleureux et encourageant, sans jamais être condescendant.
Tes réponses restent claires et actionnables : privilégie des listes courtes ou des étapes plutôt que de longs paragraphes.`;

export async function POST(req: Request) {
  try {
    const { messages } = (await req.json()) as { messages: ModelMessage[] };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: 'Messages manquants' }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
      console.error("❌ GROQ_API_KEY manquant dans .env.local");
      return Response.json({ error: "Clé API manquante" }, { status: 500 });
    }

    const groq = createGroq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const result = streamText({
      model: groq('llama-3.3-70b-versatile'),
      system: SYSTEM_PROMPT,
      messages,
    });

    // Réponse en streaming texte brut : le client lit le flux au fur et à mesure.
    return result.toTextStreamResponse();
  } catch (error) {
    console.error("❌ Erreur serveur chat:", error);
    return Response.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
