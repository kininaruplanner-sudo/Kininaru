'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * Fond géométrique « Memphis » global — formes discrètes (triangles, cercles
 * concentriques, vagues sinueuses, demi-cercles, motifs de points, chevrons,
 * carrés) fixées derrière toutes les pages du site.
 *
 * Règles :
 * - Couleurs de la palette du thème unique (cyan --kt-brand, marine
 *   --kt-cool, orange --kt-warm, terracotta --kt-complement), jamais codées
 *   en dur ailleurs.
 * - Opacités très basses (0.15–0.3) et z-index négatif : le contenu reste
 *   parfaitement lisible, les formes ne gênent jamais les interactions
 *   (pointer-events-none).
 * - Flottement très lent ; désactivé pour les utilisateurs prefers-reduced-motion.
 *
 * À placer une seule fois, directement dans <body> du layout racine.
 */

function FloatShape({
  className,
  delay = 0,
  duration = 16,
  y = 10,
  rotate = 5,
  children,
}: {
  className?: string
  delay?: number
  duration?: number
  y?: number
  rotate?: number
  children: React.ReactNode
}) {
  const reduced = useReducedMotion()
  if (reduced) {
    return <div className={cn('absolute', className)}>{children}</div>
  }
  return (
    <motion.div
      animate={{ y: [0, -y, 0], rotate: [0, rotate, 0] }}
      transition={{ duration, repeat: Infinity, ease: 'easeInOut', delay }}
      className={cn('absolute', className)}
    >
      {children}
    </motion.div>
  )
}

export function MemphisBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none fixed inset-0 z-[-10] overflow-hidden',
        className
      )}
    >
      {/* Halos ambiants — profondeur très douce, dégradés de la palette. */}
      <motion.div
        animate={{ y: [0, -14, 0], opacity: [0.05, 0.09, 0.05] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full kin-gradient-brand blur-3xl"
      />
      <motion.div
        animate={{ y: [0, 12, 0], opacity: [0.04, 0.08, 0.04] }}
        transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="absolute bottom-[-10%] right-[-8%] w-[30rem] h-[30rem] rounded-full kin-gradient-accent blur-3xl"
      />

      {/* Cercles concentriques — haut droit (marine) */}
      <FloatShape className="top-[10%] right-[6%]" delay={0.4} duration={18} rotate={-6}>
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
          <circle cx="60" cy="60" r="56" stroke="var(--kt-cool)" strokeWidth="2" opacity="0.22" />
          <circle cx="60" cy="60" r="40" stroke="var(--kt-cool)" strokeWidth="2" opacity="0.16" />
          <circle cx="60" cy="60" r="12" fill="var(--kt-cool)" opacity="0.18" />
        </svg>
      </FloatShape>

      {/* Vague sinueuse — milieu gauche (cyan) */}
      <FloatShape className="top-[42%] left-[4%] hidden md:block" delay={1.6} duration={20} y={8} rotate={-4}>
        <svg width="150" height="30" viewBox="0 0 150 30" fill="none">
          <path
            d="M2 24 C 20 4, 38 4, 56 18 C 74 32, 92 32, 110 18 C 128 4, 142 6, 148 9"
            stroke="var(--kt-brand)"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.3"
          />
        </svg>
      </FloatShape>

      {/* Demi-cercle — haut gauche (orange) */}
      <FloatShape className="top-[18%] left-[8%] hidden sm:block" delay={0.9} duration={15} rotate={-10}>
        <svg width="80" height="42" viewBox="0 0 80 42" fill="none">
          <path d="M0 42 A40 40 0 0 1 80 42 Z" fill="var(--kt-warm)" opacity="0.2" />
        </svg>
      </FloatShape>

      {/* Triangle — bas droit (orange) */}
      <FloatShape className="bottom-[14%] right-[10%] hidden sm:block" delay={2.2} duration={17} rotate={8}>
        <svg width="70" height="60" viewBox="0 0 70 60" fill="none">
          <path d="M35 3 L68 57 H2 Z" fill="var(--kt-warm)" opacity="0.2" />
        </svg>
      </FloatShape>

      {/* Motif de points — bas gauche (cyan) */}
      <FloatShape className="bottom-[20%] left-[6%] hidden md:block" delay={0.2} duration={22} y={6}>
        <div
          className="w-24 h-16"
          style={{
            backgroundImage: 'radial-gradient(var(--kt-brand) 1.5px, transparent 2px)',
            backgroundSize: '16px 16px',
            opacity: 0.24,
          }}
        />
      </FloatShape>

      {/* Carré pivoté — milieu droit (terracotta) */}
      <FloatShape className="top-[30%] right-[14%] hidden lg:block" delay={2.8} duration={19} rotate={12}>
        <div
          className="w-10 h-10 rounded-md border-2 rotate-12"
          style={{ borderColor: 'var(--kt-complement)', opacity: 0.28 }}
        />
      </FloatShape>

      {/* Chevrons — haut centre (marine) */}
      <FloatShape className="top-[24%] left-[44%] hidden xl:block" delay={1.1} duration={21} rotate={5}>
        <svg width="84" height="50" viewBox="0 0 84 50" fill="none">
          <path d="M6 8 L18 24 L6 40" stroke="var(--kt-cool)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.25" />
          <path d="M30 8 L42 24 L30 40" stroke="var(--kt-cool)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.18" />
          <path d="M54 8 L66 24 L54 40" stroke="var(--kt-cool)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.12" />
        </svg>
      </FloatShape>

      {/* Anneau — bas centre (terracotta) */}
      <FloatShape className="bottom-[30%] right-[24%] hidden lg:block" delay={3.4} duration={23} rotate={-8}>
        <div
          className="w-12 h-12 rounded-full border-2"
          style={{ borderColor: 'var(--kt-complement)', opacity: 0.22 }}
        />
      </FloatShape>

      {/* Petit triangle — haut centre gauche (terracotta) */}
      <FloatShape className="top-[54%] left-[20%] hidden lg:block" delay={1.9} duration={18} rotate={-6}>
        <svg width="44" height="38" viewBox="0 0 44 38" fill="none">
          <path d="M22 2 L42 36 H2 Z" fill="var(--kt-complement)" opacity="0.18" />
        </svg>
      </FloatShape>
    </div>
  )
}
