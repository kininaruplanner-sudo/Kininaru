'use client'

import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface TypewriterSequence {
  text: string
  /** Delete the text once typed, then move to the next sequence. */
  deleteAfter?: boolean
  /** Pause (ms) once this sequence is fully typed (or deleted). */
  pauseAfter?: number
}

interface TypewriterTitleProps {
  sequences: TypewriterSequence[]
  /** Milliseconds per character. */
  typingSpeed?: number
  /** Milliseconds per character while deleting (defaults to half the typing speed). */
  deletingSpeed?: number
  /** Delay before the first character. */
  startDelay?: number
  /** Restart from the first sequence once all are done. */
  autoLoop?: boolean
  className?: string
}

interface State {
  seq: number
  count: number
  deleting: boolean
  /** Text accumulated before the current sequence (joiners included). */
  prefix: string
}

const DEFAULT_PAUSE = 800
const DELETE_PAUSE = 250

/** Smart joiner: insert a single space between two typed segments when needed. */
function join(a: string, b: string) {
  if (a === '' || b === '') return ''
  if (a.endsWith(' ') || b.startsWith(' ')) return ''
  return ' '
}

/**
 * TypewriterTitle — titre en écriture automatique, adapté à l'identité
 * Kininaru (hérite des classes de titre passées, caret à la couleur primaire).
 *
 * - respecte `prefers-reduced-motion` : le texte complet s'affiche
 *   immédiatement, sans animation ;
 * - les séquences s'enchaînent avec un espace intelligent (« vous, » + « pas
 *   à votre place. » → « vous, pas à votre place. ») ;
 * - `autoLoop` repart de la première séquence une fois toutes terminées.
 */
export default function TypewriterTitle({
  sequences,
  typingSpeed = 40,
  deletingSpeed,
  startDelay = 0,
  autoLoop = false,
  className,
}: TypewriterTitleProps) {
  const reduced = useReducedMotion()
  const [state, setState] = useState<State>({ seq: 0, count: 0, deleting: false, prefix: '' })

  const current = sequences[state.seq]
  const displayed = reduced
    ? sequences.map((s) => s.text).join(' ')
    : state.prefix + (current?.text.slice(0, state.count) ?? '')

  const finished =
    !reduced &&
    !autoLoop &&
    current !== undefined &&
    state.count === current.text.length &&
    !state.deleting &&
    !current.deleteAfter &&
    state.seq === sequences.length - 1

  const fullText = sequences.map((s) => s.text).join(' ')

  useEffect(() => {
    if (reduced || sequences.length === 0) return
    const seq = sequences[state.seq]
    if (!seq) return

    let next: State | null = null
    let delay: number

    if (state.count >= seq.text.length && !state.deleting) {
      // Séquence entièrement tapée.
      if (!seq.deleteAfter) {
        const nextIndex = state.seq + 1
        if (nextIndex >= sequences.length) {
          if (!autoLoop) return // Terminé — plus rien à taper.
          next = { seq: 0, count: 0, deleting: false, prefix: '' }
        } else {
          const upcoming = sequences[nextIndex]
          const full = state.prefix + seq.text
          next = { seq: nextIndex, count: 0, deleting: false, prefix: full + join(full, upcoming.text) }
        }
        delay = seq.pauseAfter ?? DEFAULT_PAUSE
      } else {
        delay = seq.pauseAfter ?? DEFAULT_PAUSE
        next = { ...state, deleting: true }
      }
    } else if (state.deleting && state.count === 0) {
      // Séquence entièrement effacée — on passe à la suivante.
      const nextIndex = state.seq + 1
      if (nextIndex >= sequences.length && !autoLoop) return
      const target = autoLoop ? 0 : nextIndex
      delay = DELETE_PAUSE
      next = { seq: target, count: 0, deleting: false, prefix: autoLoop ? '' : state.prefix }
    } else {
      // Un caractère de plus (ou de moins).
      const delta = state.deleting ? -1 : 1
      delay = state.deleting ? (deletingSpeed ?? Math.max(12, typingSpeed / 2)) : typingSpeed
      next = { ...state, count: state.count + delta }
    }

    const timeout = setTimeout(() => {
      if (next) setState(next)
    }, startDelay && state.seq === 0 && state.count === 0 && !state.deleting ? startDelay : delay)
    return () => clearTimeout(timeout)
  }, [state, sequences, typingSpeed, deletingSpeed, startDelay, autoLoop, reduced])

  return (
    <h1 className={cn('text-foreground', className)} aria-label={fullText}>
      <span aria-hidden>{displayed}</span>
      {!finished && (
        <span
          aria-hidden
          className={cn(
            'ml-1 inline-block w-[3px] h-[0.85em] align-[-0.05em] rounded-full bg-primary transition-opacity',
            state.count < (current?.text.length ?? 0) ? 'animate-pulse opacity-80' : 'opacity-40'
          )}
        />
      )}
    </h1>
  )
}
