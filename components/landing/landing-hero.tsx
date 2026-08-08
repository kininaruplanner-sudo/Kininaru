'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { THEMES, useTheme } from '@/components/theme-provider'
import { LandingPreview } from './landing-preview'

export function LandingHero() {
  const { theme, setTheme } = useTheme()

  return (
    <section className="relative overflow-hidden pt-16 pb-8 sm:pt-24 sm:pb-12">
      {/* Ambient background blobs — decorative, theme-aware via currentColor tokens */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="animate-kin-float-slow absolute -top-24 -left-24 size-[420px] rounded-full bg-primary/10 blur-3xl" />
        <div className="animate-kin-float absolute top-40 -right-32 size-[380px] rounded-full bg-accent/20 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
          >
            Nouveau · pensé pour une vie plus posée
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="mt-5 text-balance font-serif text-4xl font-bold leading-[1.1] text-foreground sm:text-5xl md:text-6xl"
          >
            Un seul endroit pour organiser votre vie.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-5 text-balance text-lg text-muted-foreground sm:text-xl"
          >
            Tâches, calendrier, habitudes, focus et journal réunis dans un espace calme,
            personnalisable et pensé pour durer — sans notifications superflues.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link href="/auth/sign-up">
              <Button size="lg" className="h-11 w-full px-6 text-base sm:w-auto">
                Commencer gratuitement
                <ArrowRight className="w-4 h-4 ml-0.5" />
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button
                variant="outline"
                size="lg"
                className="h-11 w-full px-6 text-base sm:w-auto"
              >
                Se connecter
              </Button>
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-3 text-xs text-muted-foreground"
          >
            Aucune carte bancaire requise · votre compte en moins d'une minute
          </motion.p>

          {/* Signature moment: the landing page previews Kininaru's real theming system. */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-10 flex flex-col items-center gap-3"
          >
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Essayez une ambiance — l'aperçu ci-dessous change en direct
            </span>
            <div className="flex items-center gap-2.5">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTheme(t.value)}
                  aria-label={`Thème ${t.label}`}
                  aria-pressed={theme === t.value}
                  title={t.label}
                  className="group relative size-8 rounded-full border-2 border-card shadow-kin transition-smooth hover:scale-110"
                  style={{ backgroundColor: t.swatches[1] }}
                >
                  {theme === t.value && (
                    <Check className="absolute inset-0 m-auto size-4 text-white drop-shadow" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div
          id="apercu"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-14 scroll-mt-20 sm:mt-20"
        >
          <LandingPreview />
        </motion.div>
      </div>
    </section>
  )
}
