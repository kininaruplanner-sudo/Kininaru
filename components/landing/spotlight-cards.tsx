'use client'

import { useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { CheckSquare, Target, Repeat2, Timer, BookOpen, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Grille de fonctionnalités — adaptée du concept Spotlight Cards (Kokonut UI).
 *
 * Conservé : tilt 3D au mouvement de la souris, glow qui suit, focus qui
 * atténue les cartes voisines, shimmer au survol, ligne d'accent animée en
 * bas, micro-interactions.
 *
 * Adapté à Kininaru :
 * - Aucune couleur hardcodée : chaque carte porte une variable CSS du thème
 *   (--kt-brand, --kt-warm, …), donc glows, badges, lignes et shimmer suivent
 *   automatiquement le thème actif.
 * - Surfaces, bordures, radius et ombres : tokens Kininaru (bg-card,
 *   border-border, rounded-3xl, shadow-kin).
 * - focus-visible au clavier, et le glow reste faible pour préserver la
 *   lisibilité sur mobile (pas de hover requis pour lire).
 */

const TILT_MAX = 9
const TILT_SPRING = { stiffness: 300, damping: 28 } as const
const GLOW_SPRING = { stiffness: 180, damping: 22 } as const

export interface SpotlightItem {
  icon: React.ElementType
  title: string
  description: string
  /** Variable CSS du thème (ex. "var(--kt-brand)") — change avec le thème. */
  color: string
}

export const SPOTLIGHT_ITEMS: SpotlightItem[] = [
  {
    icon: CheckSquare,
    title: 'Tâches',
    description:
      'Organise ce qui doit réellement être fait : priorités, échéances, heure planifiée, sous-tâches — sans jamais ressembler à un tableur.',
    color: 'var(--kt-brand)',
  },
  {
    icon: Target,
    title: 'Objectifs',
    description:
      'Transforme tes grandes ambitions en actions concrètes : chaque tâche se rattache à un objectif et sa progression est calculée sur tes vraies avancées.',
    color: 'var(--kt-warm)',
  },
  {
    icon: Repeat2,
    title: 'Habitudes',
    description:
      'Construis des routines qui évoluent avec ta journée. Kininaru encourage et célèbre — il ne culpabilise jamais.',
    color: 'var(--kt-sage)',
  },
  {
    icon: Timer,
    title: 'Focus',
    description:
      'Entre dans une session de concentration directement depuis une tâche : la durée se pré-remplit, tu commences sans friction.',
    color: 'var(--kt-cool)',
  },
  {
    icon: BookOpen,
    title: 'Journal',
    description:
      'Écris, réfléchis et conserve tes moments importants. Le coach relit ce que tu choisis de partager et en tire des pistes concrètes.',
    color: 'var(--kt-complement)',
  },
  {
    icon: Sparkles,
    title: 'IA Coach',
    description:
      'Il comprend ta journée et te recommande la suite : prochaine action, découpage d’objectifs, brief du matin, bilan du soir.',
    color: 'var(--kt-chart-5)',
  },
]

interface CardProps {
  item: SpotlightItem
  dimmed: boolean
  onHoverStart: () => void
  onHoverEnd: () => void
}

function SpotlightCard({ item, dimmed, onHoverStart, onHoverEnd }: CardProps) {
  const Icon = item.icon
  const cardRef = useRef<HTMLDivElement>(null)

  const normX = useMotionValue(0.5)
  const normY = useMotionValue(0.5)
  const rawRotateX = useTransform(normY, [0, 1], [TILT_MAX, -TILT_MAX])
  const rawRotateY = useTransform(normX, [0, 1], [-TILT_MAX, TILT_MAX])
  const rotateX = useSpring(rawRotateX, TILT_SPRING)
  const rotateY = useSpring(rawRotateY, TILT_SPRING)
  const glowOpacity = useSpring(0, GLOW_SPRING)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    normX.set((e.clientX - rect.left) / rect.width)
    normY.set((e.clientY - rect.top) / rect.height)
  }

  const handleEnter = () => {
    glowOpacity.set(1)
    onHoverStart()
  }

  const handleLeave = () => {
    normX.set(0.5)
    normY.set(0.5)
    glowOpacity.set(0)
    onHoverEnd()
  }

  return (
    <motion.div
      animate={{ scale: dimmed ? 0.96 : 1, opacity: dimmed ? 0.45 : 1 }}
      className={cn(
        'group relative flex flex-col gap-5 overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-kin',
        'transition-[border-color] duration-300',
        'hover:border-primary/35 focus-visible:border-primary/35',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60'
      )}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onMouseMove={handleMouseMove}
      onFocus={handleEnter}
      onBlur={handleLeave}
      ref={cardRef}
      role="group"
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      tabIndex={0}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {/* Teinte d'accent statique — toujours visible, couleur du thème. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl"
        style={{
          background: `radial-gradient(ellipse at 20% 20%, color-mix(in srgb, ${item.color} 16%, transparent), transparent 65%)`,
        }}
      />

      {/* Couche glow au survol — suit la position (opacité pilotée par la souris). */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl"
        style={{
          opacity: glowOpacity,
          background: `radial-gradient(ellipse at 20% 20%, color-mix(in srgb, ${item.color} 26%, transparent), transparent 65%)`,
        }}
      />

      {/* Shimmer au survol — balayage diagonal subtil, teinté thème. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[55%] -translate-x-full -skew-x-12 bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--kt-foreground)_7%,transparent)] to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[280%] motion-reduce:transition-none"
      />

      {/* Badge d'icône — couleur d'accent du thème. */}
      <div
        className="relative z-10 flex h-11 w-11 items-center justify-center rounded-2xl"
        style={{
          background: `color-mix(in srgb, ${item.color} 16%, transparent)`,
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${item.color} 30%, transparent)`,
        }}
      >
        <Icon size={18} strokeWidth={1.9} style={{ color: item.color }} aria-hidden />
      </div>

      {/* Texte */}
      <div className="relative z-10 flex flex-col gap-2">
        <h3 className="kin-h3 text-foreground">{item.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
      </div>

      {/* Ligne d'accent en bas — s'étire au survol, couleur du thème. */}
      <div
        aria-hidden
        className="absolute bottom-0 left-0 h-[2px] w-0 rounded-full transition-all duration-500 group-hover:w-full group-focus-visible:w-full"
        style={{
          background: `linear-gradient(to right, color-mix(in srgb, ${item.color} 70%, transparent), transparent)`,
        }}
      />
    </motion.div>
  )
}

export function SpotlightCards({ items = SPOTLIGHT_ITEMS }: { items?: SpotlightItem[] }) {
  const [hoveredTitle, setHoveredTitle] = useState<string | null>(null)

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <SpotlightCard
          key={item.title}
          item={item}
          dimmed={hoveredTitle !== null && hoveredTitle !== item.title}
          onHoverStart={() => setHoveredTitle(item.title)}
          onHoverEnd={() => setHoveredTitle(null)}
        />
      ))}
    </div>
  )
}
