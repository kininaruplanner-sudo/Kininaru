const DEFAULT_MODELS = ['llama-3.3-70b-versatile']

export function getGroqModelCandidates(configuredModel) {
  const cleaned = (configuredModel || '').trim()
  const unique = []
  const seen = new Set()

  if (cleaned) {
    unique.push(cleaned)
    seen.add(cleaned)
  }

  for (const model of DEFAULT_MODELS) {
    if (!seen.has(model)) {
      unique.push(model)
      seen.add(model)
    }
  }

  return unique
}
