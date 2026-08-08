'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function LandingCta() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center shadow-kin-hover sm:px-12 sm:py-20"
        >
          <div className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full bg-primary-foreground/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 size-64 rounded-full bg-primary-foreground/10 blur-3xl" />

          <h2 className="text-balance font-serif text-3xl font-bold text-primary-foreground sm:text-4xl">
            Votre espace calme vous attend.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-balance text-primary-foreground/80">
            Créez votre compte en moins d’une minute et retrouvez tâches, calendrier et habitudes
            réunis au même endroit.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/auth/sign-up">
              <Button
                size="lg"
                className="h-11 w-full bg-card px-6 text-base text-foreground shadow-kin hover:bg-card hover:opacity-90 sm:w-auto"
              >
                Commencer gratuitement
                <ArrowRight className="w-4 h-4 ml-0.5" />
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button
                size="lg"
                variant="ghost"
                className="h-11 w-full px-6 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto"
              >
                Se connecter
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
