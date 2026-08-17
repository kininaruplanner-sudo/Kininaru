'use client'

import { motion, useReducedMotion, type TargetAndTransition, type Transition } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * CoachMascot — le visage du coach IA Kininaru.
 *
 * Forme géométrique abstraite : un cristal / losange arrondi dont la
 * silhouette reprend la géométrie du logo (le pétale central du lotus
 * est déjà un losange arrondi — M32 25 C 36.8 32 … dans kin-logo.tsx) et
 * deux petits pétales de base qui ferment la fleur. Pas de robot, pas de
 * personnage cartoon : uniquement des yeux minimalistes, une bouche très
 * simple et beaucoup de respiration.
 *
 * - `variant="gradient"`  → cristal rempli du dégradé de marque
 *   (brand → cool → warm, comme le logo) — pour les surfaces claires.
 * - `variant="onPrimary"` → cristal en `--kt-primary-foreground` (blanc)
 *   avec détails en `--kt-primary` — pour la bulle / les boutons primaires.
 *
 * Les expressions suivent les couleurs et l'ambiance du thème actif
 * (tokens --kt-*), jamais de couleurs codées en dur. Toutes les animations
 * sont coupées avec `prefers-reduced-motion` (via useReducedMotion).
 */
export type CoachMood =
  | 'calm' // état normal → expression calme
  | 'thinking' // réflexion → œil asymétrique + petit « o »
  | 'analyzing' // analyse → regards en barres + mouvement subtil
  | 'success' // réussite → yeux en arcs + sourire
  | 'progress' // progression détectée → petite étincelle lumineuse
  | 'notify' // notification → yeux élargis, légère réaction
  | 'loading' // chargement → respiration très subtile

interface CoachMascotProps {
  mood?: CoachMood
  className?: string
  /** gradient = cristal aux couleurs de la marque ; onPrimary = cristal
      blanc destiné aux surfaces primaires (bouton/bulle). */
  variant?: 'gradient' | 'onPrimary'
  /** false désactive toutes les animations (clignement, respiration, glow). */
  animated?: boolean
}

export function CoachMascot({
  mood = 'calm',
  className,
  variant = 'gradient',
  animated = true,
}: CoachMascotProps) {
  const reduced = useReducedMotion()
  const motionOff = reduced || !animated

  const faceFill = variant === 'onPrimary' ? 'var(--kt-primary-foreground)' : 'url(#kin-mascot-grad)'
  const detail = variant === 'onPrimary' ? 'var(--kt-primary)' : '#FFFFFF'

  /* ---------------- Géométrie des yeux / bouche par humeur ---------------- */

  const eyes = (() => {
    switch (mood) {
      case 'thinking':
        return (
          <>
            <circle cx="26.5" cy="24.5" r="2" fill={detail} />
            {/* œil droit plus petit et légèrement plus haut → réflexion */}
            <circle cx="38.7" cy="22.7" r="1.45" fill={detail} />
          </>
        )
      case 'analyzing':
        return (
          <>
            {/* regards concentrés */}
            <rect x="24" y="23.2" width="5" height="2" rx="1" fill={detail} />
            <rect x="35" y="23.2" width="5" height="2" rx="1" fill={detail} />
          </>
        )
      case 'success':
        return (
          <>
            {/* yeux joyeux en arcs */}
            <path d="M23.2 25 Q26 22.2 28.8 25" stroke={detail} strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M35.2 25 Q38 22.2 40.8 25" stroke={detail} strokeWidth="2" strokeLinecap="round" fill="none" />
          </>
        )
      case 'notify':
        return (
          <>
            {/* yeux légèrement élargis → réaction */}
            <circle cx="26.5" cy="24.5" r="2.6" fill={detail} />
            <circle cx="37.5" cy="24.5" r="2.6" fill={detail} />
          </>
        )
      default:
        return (
          <>
            <circle cx="26.5" cy="24.5" r="2" fill={detail} />
            <circle cx="37.5" cy="24.5" r="2" fill={detail} />
          </>
        )
    }
  })()

  const mouth = (() => {
    switch (mood) {
      case 'thinking':
        // petit « o » songeur
        return <circle cx="32" cy="36.6" r="1.25" fill={detail} />
      case 'analyzing':
        // ligne droite, neutre
        return <path d="M30.4 36.4 H33.6" stroke={detail} strokeWidth="1.9" strokeLinecap="round" />
      case 'success':
        // sourire franc
        return <path d="M28.4 34 Q32 38.2 35.6 34" stroke={detail} strokeWidth="2" strokeLinecap="round" fill="none" />
      case 'notify':
        // petit « o » surpris
        return <circle cx="32" cy="36.6" r="1.25" fill={detail} />
      default:
        // sourire discret, calme
        return <path d="M29.2 34.6 Q32 37.4 34.8 34.6" stroke={detail} strokeWidth="1.9" strokeLinecap="round" fill="none" />
    }
  })()

  // Clignement périodique des yeux (toutes les humeurs sauf « analyzing »,
  // dont les regards en barres seraient bizarres à cligner).
  const blink = !motionOff && mood !== 'analyzing'

  /* ---------------- Animations d'ambiance par humeur ---------------- */
  /* Mouvements fluides et discrets, jamais exagérés. */

  const moodLoop: { animate?: TargetAndTransition; transition?: Transition } = (() => {
    if (motionOff) return {}
    switch (mood) {
      case 'thinking':
        return {
          animate: { y: [0, -1.6, 0] },
          transition: { duration: 3.6, repeat: Infinity, ease: 'easeInOut' },
        }
      case 'analyzing':
        return {
          animate: { opacity: [1, 0.82, 1] },
          transition: { duration: 2.8, repeat: Infinity, ease: 'easeInOut' },
        }
      case 'loading':
        return {
          animate: { scale: [1, 1.035, 1] },
          transition: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' },
        }
      default:
        return {}
    }
  })()

  // Petit « pop » à l'apparition pour la réussite / la notification.
  const popOnMount = !motionOff && (mood === 'success' || mood === 'notify')

  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      {variant === 'gradient' && (
        <defs>
          <linearGradient id="kin-mascot-grad" x1="0%" y1="20%" x2="100%" y2="90%">
            <stop offset="0%" style={{ stopColor: 'var(--kt-brand)' }} />
            <stop offset="52%" style={{ stopColor: 'var(--kt-cool)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--kt-warm)' }} />
          </linearGradient>
        </defs>
      )}

      <motion.g
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        initial={popOnMount ? { scale: 0.9, opacity: 0.6 } : false}
        animate={moodLoop.animate ?? { scale: 1, opacity: 1 }}
        transition={moodLoop.transition ?? { duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Cristal / losange arrondi — le pétale central du logo, agrandi. */}
        <path
          d="M32 9 C 41.5 19, 43.5 30, 32 47.5 C 20.5 30, 22.5 19, 32 9 Z"
          fill={faceFill}
        />
        {/* Deux petits pétales de base — ferment le lotus, ancrent la forme. */}
        <path
          d="M21.5 46.5 C 15 49, 9.5 53, 7.5 57 C 12 55.5, 17 53.5, 22.5 52 Z"
          fill={faceFill}
        />
        <path
          d="M42.5 46.5 C 49 49, 54.5 53, 56.5 57 C 52 55.5, 47 53.5, 41.5 52 Z"
          fill={faceFill}
        />

        {/* Étincelle lumineuse — progression détectée */}
        {mood === 'progress' && (
          <motion.path
            d="M45.5 11 L46.85 14.85 L50.7 16.2 L46.85 17.55 L45.5 21.4 L44.15 17.55 L40.3 16.2 L44.15 14.85 Z"
            fill={detail}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            animate={motionOff ? undefined : { opacity: [0.35, 1, 0.35], scale: [0.85, 1.18, 0.85] }}
            transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        {/* Yeux (avec clignement) */}
        <motion.g
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          animate={blink ? { scaleY: [1, 0.12, 1] } : undefined}
          transition={{ duration: 0.35, times: [0, 0.5, 1], repeat: Infinity, repeatDelay: 3.2, ease: 'easeInOut' }}
        >
          {eyes}
        </motion.g>

        {/* Bouche */}
        {mouth}
      </motion.g>
    </svg>
  )
}
