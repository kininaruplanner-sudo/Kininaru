'use client'

import { useEffect } from 'react'
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * Formes géométriques flottantes du hero — adaptées du concept Shape Hero
 * (Kokonut UI) au langage visuel de Kininaru.
 *
 * Règles d'adaptation :
 * - Aucune couleur codée en dur : chaque forme prend une couleur de la
 *   palette du thème actif (--kt-brand/cool/warm/complement/chart-*), donc
 *   le hero change de personnalité quand l'utilisateur change de thème.
 * - Les formes restent derrière le contenu (pointer-events-none, z-0) et ne
 *   gênent jamais les boutons.
 * - Légère parallaxe souris (désactivée si prefers-reduced-motion ou sur
 *   écran tactile), flottement lent, apparition progressive.
 * - MotionConfig reducedMotion="user" (racine du Landing) désactive les
 *   animations transform pour les utilisateurs qui le demandent.
 */

interface ElegantShapeProps {
  className?: string
  delay?: number
  width?: number
  height?: number
  rotate?: number
  /** Stop de dégradé Tailwind complet, ex. "from-brand/25" (littéral, détecté par Tailwind). */
  from?: string
  borderRadius?: number
  /** Opacité cible du dégradé (0..1). */
  opacity?: number
}

function ElegantShape({
  className,
  delay = 0,
  width = 400,
  height = 100,
  rotate = 0,
  from = 'from-brand/25',
  borderRadius = 16,
  opacity = 1,
}: ElegantShapeProps) {
  return (
    <motion.div
      animate={{ opacity, y: 0, rotate }}
      className={cn('absolute', className)}
      initial={{ opacity: 0, y: -150, rotate: rotate - 15 }}
      transition={{
        duration: 2.4,
        delay,
        ease: [0.23, 0.86, 0.39, 0.96],
        opacity: { duration: 1.2 },
      }}
    >
      <motion.div
        animate={{ y: [0, 15, 0] }}
        className="relative"
        style={{ width, height }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div
          aria-hidden
          className={cn(
            'absolute inset-0',
            'bg-gradient-to-br to-transparent',
            from,
            'ring-1 ring-white/10 [data-theme="nuit"]:ring-white/15',
            'shadow-[0_2px_16px_-2px_rgba(16,24,40,0.06)]',
            'after:absolute after:inset-0 after:rounded-[inherit]',
            'after:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.14),transparent_70%)]'
          )}
          style={{ borderRadius }}
        />
      </motion.div>
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
        animate={{ y: [0, -18, 0], opacity: [0.45, 0.8, 0.45] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-24 -left-24 w-96 h-96 rounded-full kin-gradient-brand opacity-20 blur-3xl"
      />
      <motion.div
        animate={{ y: [0, 16, 0], opacity: [0.35, 0.7, 0.35] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="absolute top-1/3 -right-32 w-[28rem] h-[28rem] rounded-full kin-gradient-accent opacity-[0.13] blur-3xl"
      />
      <motion.div
        animate={{ y: [0, -12, 0], opacity: [0.25, 0.5, 0.25] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="absolute bottom-0 left-1/4 w-72 h-72 rounded-full bg-complement/40 blur-3xl"
      />

      {/* Couche de formes géométriques — les 4 couleurs de la palette du
          thème actif + deux couleurs de graphique pour la diversité. */}
      <motion.div style={{ x: parallaxX, y: parallaxY }} className="absolute inset-0">
        <ElegantShape
          borderRadius={24}
          className="top-[-8%] left-[-12%] hidden sm:block"
          delay={0.3}
          from="from-brand/25"
          height={420}
          opacity={0.9}
          rotate={-8}
          width={280}
        />

        <ElegantShape
          borderRadius={20}
          className="right-[-14%] bottom-[-6%] hidden sm:block"
          delay={0.5}
          from="from-warm/25"
          height={180}
          opacity={0.8}
          rotate={15}
          width={560}
        />

        <ElegantShape
          borderRadius={32}
          className="top-[38%] left-[-6%] hidden md:block"
          delay={0.4}
          from="from-complement/30"
          height={280}
          opacity={0.85}
          rotate={24}
          width={280}
        />

        <ElegantShape
          borderRadius={12}
          className="top-[6%] right-[8%] hidden md:block"
          delay={0.6}
          from="from-cool/30"
          height={90}
          opacity={0.8}
          rotate={-20}
          width={220}
        />

        <ElegantShape
          borderRadius={16}
          className="top-[46%] right-[-8%] hidden lg:block"
          delay={0.7}
          from="from-chart-5/25"
          height={140}
          opacity={0.75}
          rotate={35}
          width={360}
        />

        <ElegantShape
          borderRadius={28}
          className="bottom-[12%] left-[16%] hidden lg:block"
          delay={0.2}
          from="from-cool/25"
          height={180}
          opacity={0.7}
          rotate={-25}
          width={180}
        />

        <ElegantShape
          borderRadius={10}
          className="top-[18%] left-[38%] hidden lg:block"
          delay={0.8}
          from="from-brand/20"
          height={70}
          opacity={0.6}
          rotate={45}
          width={130}
        />

        <ElegantShape
          borderRadius={18}
          className="top-[64%] left-[24%] hidden lg:block"
          delay={0.9}
          from="from-warm/20"
          height={110}
          opacity={0.6}
          rotate={-12}
          width={400}
        />
      </motion.div>

      {/* Fondu bas du hero — réserve visuelle avant la section suivante. */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </div>
  )
}
