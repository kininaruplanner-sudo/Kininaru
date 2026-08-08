'use client'

import { motion } from 'framer-motion'

const STATS = [
  { value: '9', label: 'modules réunis dans un seul espace' },
  { value: '6', label: 'thèmes visuels, dont un mode sombre' },
  { value: '100%', label: 'de vos données restent les vôtres' },
  { value: '0', label: 'notification qui ne vous concerne pas' },
]

export function LandingStats() {
  return (
    <section className="border-y border-border bg-muted/40 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 sm:gap-6">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.35, delay: i * 0.08 }}
              className="text-center"
            >
              <p className="font-serif text-4xl font-bold text-primary sm:text-5xl">
                {stat.value}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
