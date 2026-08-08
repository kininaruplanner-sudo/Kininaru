/**
 * Reads a streamed response from /api/chat chunk by chunk.
 * Used by the Dashboard's Daily AI Insight card.
 */
export async function streamChatResponse(
  messages: { role: 'user' | 'assistant'; content: string }[],
  onChunk: (chunkText: string) => void
): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })

  if (!res.ok || !res.body) {
    let message = `Erreur serveur (${res.status})`

    try {
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const data = (await res.json()) as { error?: string }
        if (data.error) message = data.error
      } else {
        const text = await res.text()
        if (text.trim()) message = text
      }
    } catch {
      // ignore parse errors and fall back to the default message
    }

    throw new Error(message)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let received = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    if (chunk) {
      received = true
      onChunk(chunk)
    }
  }

  if (!received) {
    throw new Error('Groq n\'a renvoyé aucune réponse.')
  }
}
