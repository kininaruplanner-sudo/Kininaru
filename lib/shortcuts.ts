/**
 * Kininaru — keyboard shortcuts
 *
 * Single source of truth for the shortcuts shown in the command palette's
 * help dialog and in Settings → Raccourcis clavier. Keeps one registry so
 * the UI and the actual listeners never drift apart.
 */

export interface ShortcutInfo {
  /** Key labels to display (e.g. ["Ctrl", "K"]). */
  keys: string[]
  label: string
}

export const KEYBOARD_SHORTCUTS: ShortcutInfo[] = [
  { keys: ['Ctrl', 'K'], label: 'Ouvrir la palette de commandes' },
  { keys: ['?'], label: 'Afficher les raccourcis clavier' },
  { keys: ['Esc'], label: 'Fermer la palette ou l’aide' },
  { keys: ['↑', '↓'], label: 'Naviguer dans la palette' },
  { keys: ['Entrée'], label: 'Sélectionner l’élément actif' },
]

/**
 * True when the keydown event originated from a typing context (input,
 * textarea, select, contentEditable). Global shortcuts that would type a
 * character (e.g. `?`) must never fire while the user is writing — the
 * browser's native key handling belongs to the field.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target) return false
  const el = target as HTMLElement | null
  if (!el || typeof el.tagName !== 'string') return false
  const tag = el.tagName.toUpperCase()
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true
}
