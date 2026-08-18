/**
 * Kininaru Assistant — Conversation Summarizer
 *
 * Generates compact summaries of long conversations to preserve context
 * without sending the entire message history to the model.
 *
 * Design principles:
 * - Pure algorithm (no external API calls for now)
 * - Extracts key topics, decisions, and action items
 * - Keeps summaries short (1-3 sentences)
 * - Preserves user preferences and important facts
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface ConversationSummaryData {
  /** Extracted topics/themes from the conversation */
  topics: string[]
  /** Key decisions or conclusions */
  decisions: string[]
  /** Action items or next steps mentioned */
  actions: string[]
  /** User preferences or facts mentioned */
  facts: string[]
  /** Compact summary text (1-3 sentences) */
  summary: string
}

/* ------------------------------------------------------------------ */
/* Summarizer                                                          */
/* ------------------------------------------------------------------ */

/**
 * Summarizes a conversation from its messages.
 * Extracts topics, decisions, actions, and facts.
 *
 * @param messages - Array of {role, content} messages
 * @param maxTopics - Maximum topics to extract (default 3)
 * @returns Structured summary data
 */
export function summarizeConversation(
  messages: Array<{ role: string; content: string }>,
  maxTopics = 3
): ConversationSummaryData {
  if (messages.length === 0) {
    return { topics: [], decisions: [], actions: [], facts: [], summary: '' }
  }

  const userMessages = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)

  const assistantMessages = messages
    .filter(m => m.role === 'assistant')
    .map(m => m.content)

  // Extract topics from user messages
  const topics = extractTopics(userMessages, maxTopics)

  // Extract decisions from assistant messages
  const decisions = extractDecisions(assistantMessages)

  // Extract action items
  const actions = extractActions(assistantMessages)

  // Extract user facts/preferences
  const facts = extractFacts(userMessages)

  // Generate compact summary
  const summary = generateSummary(topics, decisions, actions, facts)

  return { topics, decisions, actions, facts, summary }
}

/* ------------------------------------------------------------------ */
/* Extraction Functions                                                */
/* ------------------------------------------------------------------ */

/**
 * Extracts main topics/themes from user messages.
 * Simple keyword frequency analysis.
 */
function extractTopics(messages: string[], maxTopics: number): string[] {
  // Combine all user messages
  const text = messages.join(' ').toLowerCase()

  // Common French stop words to filter out
  const stopWords = new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'est',
    'sont', 'a', 'ai', 'as', 'avons', 'avez', 'ont', 'je', 'tu', 'il',
    'elle', 'nous', 'vous', 'ils', 'elles', 'me', 'te', 'se', 'lui',
    'leur', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses',
    'notre', 'votre', 'ce', 'cette', 'ces', 'qui', 'que', 'quoi', 'dont',
    'où', 'comment', 'pourquoi', 'quand', 'combien', 'quel', 'quelle',
    'je', 'ne', 'pas', 'plus', 'moins', 'très', 'bien', 'mal', 'aussi',
    'encore', 'déjà', 'toujours', 'jamais', 'peut', 'doit', 'faut', 'fait',
    'faire', 'dit', 'dire', 'va', 'aller', 'voir', 'prendre', 'donner',
    'mettre', 'venir', 'pouvoir', 'vouloir', 'savoir', 'croire', 'penser',
    'aimer', 'trouver', 'rester', 'passer', 'partir', 'arriver', 'entrer',
    'sortir', 'tomber', 'devenir', 'tenir', 'parler', 'demander', 'répondre',
    'écouter', 'regarder', 'chercher', 'essayer', 'commencer', 'continuer',
    'finir', 'arrêter', 'attendre', 'perdre', 'gagner', 'acheter', 'vendre',
    'payer', 'coûter', 'lire', 'écrire', 'apprendre', 'enseigner', 'travailler',
  ])

  // Extract meaningful words (3+ chars)
  const words = text
    .replace(/[^\w\sàâäéèêëïîôùûüÿçœæ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopWords.has(w))

  // Count word frequency
  const wordCount = new Map<string, number>()
  for (const word of words) {
    wordCount.set(word, (wordCount.get(word) ?? 0) + 1)
  }

  // Sort by frequency and take top N
  const sorted = Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTopics)
    .map(([word]) => word)

  return sorted
}

/**
 * Extracts decisions/conclusions from assistant messages.
 * Looks for patterns like "je recommande", "la meilleure option", etc.
 */
function extractDecisions(messages: string[]): string[] {
  const decisions: string[] = []
  const patterns = [
    /(?:je te recommande|je recommande|la meilleure option|la meilleure solution|je suggère|je propose|commence par|priorise|concentre-toi sur)\s*[:\s]*(.+?)(?:\.|$)/gi,
    /(?:je te conseille|conseil|meilleur choix|meilleure approche)\s*[:\s]*(.+?)(?:\.|$)/gi,
  ]

  for (const msg of messages) {
    for (const pattern of patterns) {
      const matches = msg.matchAll(pattern)
      for (const match of matches) {
        if (match[1] && match[1].trim().length > 5) {
          decisions.push(match[1].trim().slice(0, 100))
        }
      }
    }
  }

  return [...new Set(decisions)].slice(0, 3)
}

/**
 * Extracts action items from assistant messages.
 * Looks for patterns like "tu peux", "étape", "action", etc.
 */
function extractActions(messages: string[]): string[] {
  const actions: string[] = []
  const patterns = [
    /(?:étape\s*\d+|action\s*\d+|ensuite|puis|après|ensuite)\s*[:\s]*(.+?)(?:\.|$)/gi,
    /(?:tu peux|il faut|on pourrait|on peut)\s+(.+?)(?:\.|$)/gi,
  ]

  for (const msg of messages) {
    for (const pattern of patterns) {
      const matches = msg.matchAll(pattern)
      for (const match of matches) {
        if (match[1] && match[1].trim().length > 5) {
          actions.push(match[1].trim().slice(0, 100))
        }
      }
    }
  }

  return [...new Set(actions)].slice(0, 3)
}

/**
 * Extracts user facts/preferences from user messages.
 * Looks for patterns like "je préfère", "j'aime", "j'habite", etc.
 */
function extractFacts(messages: string[]): string[] {
  const facts: string[] = []
  const patterns = [
    /(?:je préfère|j'aime|j'adore|je n'aime pas|je déteste|je veux|je dois|j'habite|je travaille|j'étudie|je suis|mon objectif|ma préférence)\s*[:\s]*(.+?)(?:\.|$)/gi,
    /(?:généralement|souvent|toujours|jamais|plutôt)\s+(.+?)(?:\.|$)/gi,
  ]

  for (const msg of messages) {
    for (const pattern of patterns) {
      const matches = msg.matchAll(pattern)
      for (const match of matches) {
        if (match[1] && match[1].trim().length > 5) {
          facts.push(match[1].trim().slice(0, 100))
        }
      }
    }
  }

  return [...new Set(facts)].slice(0, 3)
}

/**
 * Generates a compact summary from extracted data.
 */
function generateSummary(
  topics: string[],
  decisions: string[],
  actions: string[],
  facts: string[]
): string {
  const parts: string[] = []

  if (topics.length > 0) {
    parts.push(`Sujets abordés : ${topics.join(', ')}`)
  }

  if (decisions.length > 0) {
    parts.push(`Recommandation : ${decisions[0]}`)
  }

  if (actions.length > 0) {
    parts.push(`Étapes suggérées : ${actions.join(' → ')}`)
  }

  if (facts.length > 0) {
    parts.push(`Préférences : ${facts.join(', ')}`)
  }

  return parts.join('. ') || 'Conversation sans contenu mémorable.'
}
