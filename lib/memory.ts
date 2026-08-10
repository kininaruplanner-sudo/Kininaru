'use client'

/**
 * AI memory master switch (ÉTAPE 15.5 §15).
 *
 * Device-local (localStorage) and OPT-IN by default: the assistant only
 * injects stored memories into a conversation when this is ON. Stored
 * memories remain fully visible and deletable in Settings → Mémoire.
 * Nothing here is secret — the switch only controls whether the server
 * adds the user's saved memories as context to chat requests.
 */

const KEY = 'kininaru-memory-enabled'
const CHANGE_EVENT = 'kininaru-memory-changed'

export function isMemoryEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0'
  } catch {
    return true
  }
}

export function setMemoryEnabled(enabled: boolean) {
  try {
    localStorage.setItem(KEY, enabled ? '1' : '0')
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
  } catch {
    // storage unavailable
  }
}
