import 'server-only'

/**
 * Resolves the Groq API key from server env vars only.
 */
export function getGroqApiKey(): string | undefined {
  const key = process.env.GROQ_API_KEY?.trim()

  return key || undefined
}
