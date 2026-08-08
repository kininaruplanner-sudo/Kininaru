'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'

const SHORTCUTS: { keys: string[]; description: string }[] = [
  { keys: ['⌘', 'K'], description: 'Ouvrir la recherche globale' },
  { keys: ['↑', '↓'], description: 'Naviguer dans les résultats' },
  { keys: ['↵'], description: 'Sélectionner un résultat' },
  { keys: ['Esc'], description: 'Fermer une fenêtre ou une recherche' },
  { keys: ['?'], description: "Afficher ces raccourcis" },
]

function isTypingContext(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !isTypingContext(e.target)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Raccourcis clavier" maxWidth="max-w-sm">
      <ul className="space-y-3">
        {SHORTCUTS.map((s) => (
          <li key={s.description} className="flex items-center justify-between gap-4">
            <span className="text-sm text-foreground">{s.description}</span>
            <span className="flex items-center gap-1 shrink-0">
              {s.keys.map((k) => (
                <kbd
                  key={k}
                  className="min-w-[1.5rem] text-center text-[11px] font-medium px-1.5 py-1 rounded-md bg-muted text-muted-foreground border border-border"
                >
                  {k}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
