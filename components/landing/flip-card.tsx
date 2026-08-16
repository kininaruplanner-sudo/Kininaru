'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Repeat2, Target, Repeat, Timer, TrendingUp, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/**
 * Card Flip — adapté du concept Kokonut UI au langage Kininaru.
 *
 * Recto : le problème (« Vous avez déjà une liste de choses à faire. »).
 * Verso : comment Kininaru transforme cette liste (priorisation, objectifs,
 * habitudes, focus, progression, adaptation) + un bouton vers une action
 * réelle (inscription).
 *
 * Adaptations :
 * - Aucune couleur orange/indigo hardcodée : tout passe par les tokens du
 *   thème (--kt-primary, --kt-warm, --kt-sage, …).
 * - Retournement 3D au survol (desktop) et au tap (mobile) ; perspective et
 *   apparition en cascade des éléments du verso.
 * - `prefers-reduced-motion` : la rotation devient instantanée (motion-reduce).
 */

const TRANSFORM_FEATURES = [
  { icon: Target, text: 'Priorisation : une prochaine action claire, pas 47 choses à trier' },
  { icon: Repeat2, text: 'Objectifs : chaque tâche se rattache à une ambition concrète' },
  { icon: Repeat, text: 'Habitudes : des routines qui évoluent avec ta journée' },
  { icon: Timer, text: 'Focus : lancer une session directement depuis une tâche' },
  { icon: TrendingUp, text: 'Progression : voir le chemin parcouru, pas seulement la liste' },
  { icon: Sparkles, text: 'Adaptation : le coach ajuste la journée à ce qui s’est réellement passé' },
]

interface FlipCardProps {
  frontTitle?: string
  frontSubtitle?: string
  backTitle?: string
  backDescription?: string
  ctaLabel?: string
  ctaHref?: string
}

export function FlipCard({
  frontTitle = 'Vous avez déjà une liste de choses à faire.',
  frontSubtitle = '47 choses à faire. Aucune idée par où commencer.',
  backTitle = 'Kininaru transforme cette liste',
  backDescription = 'Une liste devient un système qui vous guide, du matin au soir.',
  ctaLabel = 'Commencer gratuitement',
  ctaHref = '/auth/sign-up',
}: FlipCardProps) {
  const [isFlipped, setIsFlipped] = useState(false)
  const flippedRef = useRef(false)

  return (
    <div
      className="group relative h-[400px] w-full max-w-[380px] [perspective:2000px] mx-auto select-none"
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => {
        setIsFlipped(false)
        flippedRef.current = false
      }}
      onClick={() => {
        // Tap mobile : bascule manuelle (hover n'existe pas sur écran tactile).
        flippedRef.current = !flippedRef.current
        setIsFlipped(flippedRef.current)
      }}
    >
      <div
        className={cn(
          'relative h-full w-full',
          '[transform-style:preserve-3d]',
          'transition-[transform] duration-500 ease-[cubic-bezier(0.77,0,0.175,1)]',
          'motion-reduce:transition-none',
          isFlipped ? '[transform:rotateY(180deg)]' : '[transform:rotateY(0deg)]'
        )}
      >
        {/* ---------- Recto : le problème ---------- */}
        <div
          className={cn(
            'absolute inset-0 h-full w-full',
            '[backface-visibility:hidden] [transform:rotateY(0deg)]',
            'overflow-hidden rounded-3xl border border-border bg-card',
            'shadow-kin transition-shadow duration-500',
            'group-hover:shadow-kin-hover'
          )}
        >
          <div className="relative h-full overflow-hidden bg-gradient-to-b from-card to-muted/60">
            {/* Anneaux concentriques pulsants — couleur primaire du thème. */}
            <div aria-hidden className="absolute inset-0 flex items-start justify-center pt-16">
              <div className="relative flex h-[120px] w-[240px] items-center justify-center">
                {[...Array(6)].map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'kin-ring absolute h-12 w-12 rounded-full border-2 border-primary/60 motion-reduce:hidden',
                      'bg-[color-mix(in_srgb,var(--kt-primary)_8%,transparent)]'
                    )}
                    style={{ animationDelay: `${i * 0.45}s` }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <h3 className="kin-h2 text-foreground leading-snug">{frontTitle}</h3>
                <p className="text-sm text-muted-foreground leading-snug">{frontSubtitle}</p>
              </div>
              <div className="group/icon relative shrink-0">
                <div
                  aria-hidden
                  className="absolute inset-[-8px] rounded-xl bg-gradient-to-br from-warm/20 via-warm/10 to-transparent"
                />
                <Repeat2
                  aria-hidden
                  className="relative z-10 h-5 w-5 text-warm transition-transform duration-300 group-hover/icon:-rotate-12 group-hover/icon:scale-110"
                />
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground/80 flex items-center gap-1.5">
              <Repeat2 className="w-3 h-3" /> Survole ou touche la carte pour voir la suite
            </p>
          </div>
        </div>

        {/* ---------- Verso : la transformation ---------- */}
        <div
          className={cn(
            'absolute inset-0 h-full w-full',
            '[backface-visibility:hidden] [transform:rotateY(180deg)]',
            'rounded-3xl border border-border bg-card',
            'bg-gradient-to-b from-card to-muted/50 p-6',
            'shadow-kin transition-shadow duration-500 group-hover:shadow-kin-hover',
            'flex flex-col'
          )}
        >
          <div className="flex-1 space-y-5">
            <div className="space-y-2">
              <h3 className="kin-h2 text-foreground leading-snug">{backTitle}</h3>
              <p className="text-sm text-muted-foreground leading-snug">{backDescription}</p>
            </div>

            <ul className="space-y-2.5">
              {TRANSFORM_FEATURES.map((f, index) => (
                <li
                  key={f.text}
                  className="flex items-start gap-2.5 text-sm text-foreground/90 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
                  style={{
                    transform: isFlipped ? 'translateX(0)' : 'translateX(-10px)',
                    opacity: isFlipped ? 1 : 0,
                    transitionDelay: `${index * 55 + 150}ms`,
                  }}
                >
                  <f.icon aria-hidden className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                  <span className="leading-snug">{f.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <Button
              size="lg"
              className="w-full"
              render={
                <Link href={ctaHref} className="inline-flex w-full items-center justify-center gap-1.5">
                  {ctaLabel}
                  <ArrowRight
                    aria-hidden
                    className="w-4 h-4 transition-transform duration-300 group-hover/button:translate-x-0.5"
                  />
                </Link>
              }
            />
            <p className="mt-2.5 text-center text-[11px] text-muted-foreground">
              Gratuit pour commencer · aucune carte requise
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
