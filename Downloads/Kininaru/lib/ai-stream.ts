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
  if (!res.ok || !res.body) throw new Error('AI request failed')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    onChunk(decoder.decode(value, { stream: true }))
  }
}
