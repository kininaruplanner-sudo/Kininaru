'use client'

import { motion } from 'framer-motion'

/**
 * Subtle geometric Memphis background for auth pages.
 * Animated shapes float slowly behind the form card, reinforcing
 * Kininaru's visual identity without competing with the content.
 */
export function AuthBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Brand radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(600px_circle_at_50%_0%,color-mix(in_srgb,var(--kt-primary)_8%,transparent),transparent_70%)]" />

      {/* Top-right circle */}
      <motion.div
        className="absolute -top-20 -right-16 w-64 h-64 rounded-full border border-primary/10"
        animate={{ rotate: 360 }}
        transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
      />

      {/* Bottom-left triangle-ish blob */}
      <motion.div
        className="absolute bottom-[10%] -left-12 w-40 h-40 rounded-2xl border border-kin-coral/10 rotate-12"
        animate={{ y: [0, -12, 0], rotate: [12, 18, 12] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Mid-right dot */}
      <motion.div
        className="absolute top-1/3 right-[8%] w-3 h-3 rounded-full bg-primary/15"
        animate={{ scale: [1, 1.4, 1], opacity: [0.15, 0.25, 0.15] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Top-left small square */}
      <motion.div
        className="absolute top-[15%] left-[12%] w-5 h-5 border border-accent/15 rotate-45"
        animate={{ rotate: [45, 90, 45] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Bottom-right cross */}
      <motion.div
        className="absolute bottom-[20%] right-[15%] text-primary/10 text-2xl font-light select-none"
        animate={{ opacity: [0.08, 0.16, 0.08] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      >
        +
      </motion.div>
    </div>
  )
}
