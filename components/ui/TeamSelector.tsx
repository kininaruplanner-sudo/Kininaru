'use client'

import { useState } from 'react'
import { Minus, Plus, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TeamSelectorProps {
  /** Label au-dessus du sélecteur (ex. « Taille de la famille »). */
  label?: string
  defaultValue?: number
  min?: number
  max?: number
  onChange?: (size: number) => void
  className?: string
}

/** Couleurs d'avatars — palette « étiquettes » Kininaru (themes.css). */
const AVATAR_COLORS = ['#F6B7D2', '#CDB8FF', '#CDE9D2', '#FFF1B6', '#BFDFFF', '#FFC8B8']

/**
 * TeamSelector — sélecteur de taille d'équipe / de famille, adapté à
 * l'identité Kininaru : pastilles d'avatars aux couleurs des étiquettes,
 * boutons − / + tactiles (≥ 44 px), contraste de la palette.
 */
export default function TeamSelector({
  label,
  defaultValue = 2,
  min = 1,
  max = 10,
  onChange,
  className,
}: TeamSelectorProps) {
  const [size, setSize] = useState(defaultValue)

  const clamp = (n: number) => Math.min(max, Math.max(min, n))

  const update = (next: number) => {
    const value = clamp(next)
    setSize(value)
    onChange?.(value)
  }

  const shown = Math.min(size, AVATAR_COLORS.length)
  const overflow = size - shown

  return (
    <div className={cn('inline-flex flex-col items-center gap-3', className)}>
      {label && (
        <span className="kin-caption uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-primary" />
          {label}
        </span>
      )}

      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-kin">
        <button
          type="button"
          onClick={() => update(size - 1)}
          disabled={size <= min}
          aria-label="Diminuer"
          className="w-11 h-11 rounded-xl border border-border text-foreground flex items-center justify-center hover:bg-muted hover:border-primary/40 active:scale-95 transition-smooth disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Minus className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center min-w-28 px-1">
          <div className="flex items-center" aria-hidden>
            {Array.from({ length: shown }).map((_, i) => (
              <span
                key={i}
                className="w-6 h-6 rounded-full border-2 border-card -ml-1.5 first:ml-0"
                style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
              />
            ))}
            {overflow > 0 && (
              <span className="ml-1.5 text-xs font-semibold text-muted-foreground">+{overflow}</span>
            )}
          </div>
          <span className="mt-1 text-sm font-semibold text-foreground tabular-nums">
            {size} {size > 1 ? 'personnes' : 'personne'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => update(size + 1)}
          disabled={size >= max}
          aria-label="Augmenter"
          className="w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:brightness-110 active:scale-95 transition-smooth disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
