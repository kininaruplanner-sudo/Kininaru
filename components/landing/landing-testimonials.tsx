'use client'

import { motion } from 'framer-motion'
import { Quote } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cardVariants } from '@/components/ui/card'

// Témoignages illustratifs — à remplacer par de vrais retours dès que
// vous aurez vos premiers utilisateurs.
const TESTIMONIALS = [
  {
    quote:
      'J’utilisais quatre applications différentes. Depuis que tout est au même endroit, je ne perds plus dix minutes par jour à chercher où j’avais noté quoi.',
    name: 'Léa M.',
    role: 'Cheffe de projet freelance',
    tint: 'bg-kin-lavender',
  },
  {
    quote:
      'Les sessions Focus m’ont vraiment aidé à tenir mes objectifs de la semaine. Le suivi des séries d’habitudes est le petit coup de pouce qu’il me manquait.',
    name: 'Thomas R.',
    role: 'Développeur indépendant',
    tint: 'bg-kin-blue',
  },
  {
    quote:
      'Le thème sombre et l’interface calme changent tout pour moi le soir. C’est la première app de productivité que je garde ouverte sans m’en lasser.',
    name: 'Nadia B.',
    role: 'Étudiante en master',
    tint: 'bg-kin-coral',
  },
]

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
}

export function LandingTestimonials() {
  return (
    <section id="temoignages" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance font-serif text-3xl font-bold text-foreground sm:text-4xl">
            Ce qu’en disent celles et ceux qui l’utilisent.
          </h2>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <motion.figure
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.35, delay: i * 0.08 }}
              className={cn(cardVariants({ padding: 'lg' }), 'flex flex-col')}
            >
              <Quote className="size-5 text-primary/40" />
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-foreground">
                {t.quote}
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span
                  className={cn(
                    'flex size-9 items-center justify-center rounded-full text-xs font-semibold text-foreground/80',
                    t.tint
                  )}
                >
                  {initials(t.name)}
                </span>
                <span>
                  <span className="block text-sm font-medium text-foreground">{t.name}</span>
                  <span className="block text-xs text-muted-foreground">{t.role}</span>
                </span>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  )
}
