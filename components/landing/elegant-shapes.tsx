'use client'

import { useEffect } from 'react'
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * Fond géométrique « Memphis moderne » du hero — triangles, cercles
 * concentriques, demi-cercles, vagues, carrés, chevrons et motifs de points,
 * animés lentement (flottaison, rotation, respiration d'opacité).
 *
 * Règles d'adaptation :
 * - Aucune couleur codée en dur : chaque forme utilise les tokens de la
 *   palette du thème actif (--kt-brand cyan / --kt-cool marine /
 *   --kt-warm orange / --kt-complement terracotta), donc le hero change de
 *   personnalité quand l'utilisateur change de thème.
 * - Les formes restent derrière le contenu (pointer-events-none, z-0) avec
 *   des opacités subtiles : la lisibilité du texte n'est jamais perturbée.
 * - Apparition fluide au défilement (whileInView, une fois), parallaxe
 *   souris légère (désactivée si prefers-reduced-motion ou écran tactile),
 *   flottement très lent, MotionConfig reducedMotion="user" (racine du
 *   Landing) coupe les animations de transform à la demande.
 */

const EASE: [number, number, number, number] = [0.23, 0.86, 0.39, 0.96]

/** Enveloppe d'apparition au défilement (scroll-triggered, une seule fois). */
function Shape({
  className,
  delay = 0,
  children,
}: {
  className?: string
  delay?: number
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6, y: 40 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 1.1, delay, ease: EASE }}
      className={cn('absolute', className)}
    >
      {children}
    </motion.div>
  )
}

/** Flottaison + rotation lentes et continues d'une forme. */
function Float({
  delay = 0,
  duration = 12,
  y = 14,
  rotate = 6,
  className,
  children,
}: {
  delay?: number
  duration?: number
  y?: number
  rotate?: number
  className?: string
  children: React.ReactNode
}) {
  return (
    <motion.div
      animate={{ y: [0, -y, 0], rotate: [0, rotate, 0] }}
      transition={{ duration, repeat: Infinity, ease: 'easeInOut', delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function HeroShapes() {
  const reduced = useReducedMotion()

  // Parallaxe très légère : le fond se déplace de quelques pixels en sens
  // inverse de la souris. Désactivée pour les utilisateurs reduced-motion.
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const parallaxX = useSpring(mx, { stiffness: 40, damping: 22 })
  const parallaxY = useSpring(my, { stiffness: 40, damping: 22 })

  useEffect(() => {
    if (reduced) return
    const onMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2
      const ny = (e.clientY / window.innerHeight - 0.5) * 2
      mx.set(nx * -9)
      my.set(ny * -9)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [mx, my, reduced])

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* Halos ambiants — couleurs de la palette, flottement très lent. */}
      <motion.div
        animate={{ y: [0, -18, 0], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-24 -left-24 w-96 h-96 rounded-full kin-gradient-brand opacity-20 blur-3xl"
      />
      <motion.div
        animate={{ y: [0, 16, 0], opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="absolute top-1/3 -right-32 w-[28rem] h-[28rem] rounded-full kin-gradient-accent opacity-[0.12] blur-3xl"
      />
      <motion.div
        animate={{ y: [0, -12, 0], opacity: [0.2, 0.45, 0.2] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="absolute bottom-0 left-1/4 w-72 h-72 rounded-full bg-cool/30 blur-3xl"
      />

      {/* Couche Memphis — formes géométriques animées de la palette du thème. */}
      <motion.div style={{ x: parallaxX, y: parallaxY }} className="absolute inset-0">
        {/* Triangle — haut gauche (cyan) */}
        <Shape className="top-[12%] left-[4%] hidden md:block" delay={0.2}>
          <Float delay={0.4} duration={11} rotate={8}>
            <svg width="92" height="80" viewBox="0 0 92 80" fill="none">
              <path d="M46 4 L90 76 H2 Z" fill="var(--kt-brand)" opacity="0.28" />
            </svg>
          </Float>
        </Shape>

        {/* Cercles concentriques — milieu gauche (marine) */}
        <Shape className="top-[38%] left-[-3%] hidden lg:block" delay={0.45}>
          <Float delay={1.2} duration={14} rotate={-6}>
            <svg width="150" height="150" viewBox="0 0 150 150" fill="none">
              <circle cx="75" cy="75" r="70" stroke="var(--kt-cool)" strokeWidth="2" opacity="0.35" />
              <circle cx="75" cy="75" r="52" stroke="var(--kt-cool)" strokeWidth="2" opacity="0.25" />
              <circle cx="75" cy="75" r="18" fill="var(--kt-cool)" opacity="0.3" />
            </svg>
          </Float>
        </Shape>

        {/* Demi-cercle — haut droit (orange) */}
        <Shape className="top-[8%] right-[4%] hidden sm:block" delay={0.3}>
          <Float delay={0.8} duration={13} rotate={-10}>
            <svg width="110" height="60" viewBox="0 0 110 60" fill="none">
              <path d="M0 60 A55 55 0 0 1 110 60 Z" fill="var(--kt-warm)" opacity="0.3" />
            </svg>
          </Float>
        </Shape>

        {/* Vague sinueuse — bas gauche (marine) */}
        <Shape className="bottom-[16%] left-[6%] hidden lg:block" delay={0.55}>
          <Float delay={0.6} duration={16} y={10} rotate={-4}>
            <svg width="170" height="34" viewBox="0 0 170 34" fill="none">
              <path
                d="M2 28 C 22 4, 42 4, 62 20 C 82 36, 102 36, 122 20 C 142 4, 162 4, 168 10"
                stroke="var(--kt-cool)"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.4"
              />
            </svg>
          </Float>
        </Shape>

        {/* Carré pivoté — milieu droit (terracotta) */}
        <Shape className="top-[42%] right-[6%] hidden lg:block" delay={0.65}>
          <Float delay={1.8} duration={15} rotate={14}>
            <div
              className="w-16 h-16 rounded-lg border-2 rotate-12"
              style={{ borderColor: 'var(--kt-complement)', opacity: 0.4 }}
            />
          </Float>
        </Shape>

        {/* Chevrons — centre droit (orange) */}
        <Shape className="top-[58%] right-[-2%] hidden xl:block" delay={0.75}>
          <Float delay={0.2} duration={12} rotate={6}>
            <svg width="120" height="70" viewBox="0 0 120 70" fill="none">
              <path d="M8 12 L24 34 L8 56" stroke="var(--kt-warm)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
              <path d="M40 12 L56 34 L40 56" stroke="var(--kt-warm)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
              <path d="M72 12 L88 34 L72 56" stroke="var(--kt-warm)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.18" />
            </svg>
          </Float>
        </Shape>

        {/* Motif de points — haut centre (cyan) */}
        <Shape className="top-[18%] left-[36%] hidden xl:block" delay={0.85}>
          <Float delay={2.4} duration={17} y={8} rotate={0}>
            <div
              className="w-28 h-16"
              style={{
                backgroundImage: 'radial-gradient(var(--kt-brand) 2px, transparent 2.5px)',
                backgroundSize: '18px 18px',
                opacity: 0.35,
              }}
            />
          </Float>
        </Shape>

        {/* Petit triangle — bas droit (terracotta) */}
        <Shape className="bottom-[8%] right-[16%] hidden md:block" delay={0.5}>
          <Float delay={1.5} duration={13} rotate={-8}>
            <svg width="64" height="56" viewBox="0 0 64 56" fill="none">
              <path d="M32 4 L62 52 H2 Z" fill="var(--kt-complement)" opacity="0.3" />
            </svg>
          </Float>
        </Shape>

        {/* Cercle contour — centre bas (cyan) */}
        <Shape className="bottom-[26%] left-[24%] hidden lg:block" delay={0.95}>
          <Float delay={0.1} duration={18} y={10} rotate={0}>
            <div
              className="w-14 h-14 rounded-full border-2"
              style={{ borderColor: 'var(--kt-brand)', opacity: 0.35 }}
            />
          </Float>
        </Shape>

        {/* Deuxième vague fine — haut (orange) */}
        <Shape className="top-[28%] right-[18%] hidden xl:block" delay={1.05}>
          <Float delay={2.9} duration={15} y={8} rotate={5}>
            <svg width="120" height="22" viewBox="0 0 120 22" fill="none">
              <path
                d="M2 14 C 18 2, 34 2, 50 12 C 66 22, 82 22, 98 12 C 108 6, 116 4, 118 4"
                stroke="var(--kt-warm)"
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity="0.4"
              />
            </svg>
          </Float>
        </Shape>

        {/* Demi-cercle petit — bas gauche (cyan) */}
        <Shape className="bottom-[38%] left-[8%] hidden xl:block" delay={0.6}>
          <Float delay={3.4} duration={14} rotate={10}>
            <svg width="70" height="40" viewBox="0 0 70 40" fill="none">
              <path d="M0 40 A35 35 0 0 1 70 40 Z" fill="var(--kt-brand)" opacity="0.25" />
            </svg>
          </Float>
        </Shape>

        {/* Anneau — haut droit (orange) */}
        <Shape className="top-[40%] right-[24%] hidden xl:block" delay={0.7}>
          <Float delay={1.1} duration={16} rotate={-12}>
            <div
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: 'var(--kt-warm)', opacity: 0.4 }}
            />
          </Float>
        </Shape>
      </motion.div>

      {/* Fondu bas du hero — réserve visuelle avant la section suivante. */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </div>
  )
}
