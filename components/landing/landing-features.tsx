'use client'

import { motion } from 'framer-motion'
import {
  CalendarDays,
  CheckSquare,
  Timer,
  Repeat2,
  BookOpen,
  Sparkles,
  BarChart3,
  Trophy,
  Palette,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { cardVariants } from '@/components/ui/card'

const FEATURES = [
  {
    icon: CalendarDays,
    title: 'Calendrier intelligent',
    description: 'Visualisez vos événements et rendez-vous sans jamais perdre le fil de la semaine.',
  },
  {
    icon: CheckSquare,
    title: 'Tâches & priorités',
    description: 'Classez ce qui compte vraiment et avancez sur l’essentiel, un jour à la fois.',
  },
  {
    icon: Timer,
    title: 'Sessions Focus',
    description: 'Un minuteur épuré pour des blocs de travail sans distraction, suivis dans le temps.',
  },
  {
    icon: Repeat2,
    title: 'Habitudes & séries',
    description: 'Construisez des routines durables et gardez la motivation grâce à vos séries.',
  },
  {
    icon: BookOpen,
    title: 'Journal quotidien',
    description: 'Un espace privé pour noter vos pensées et suivre votre état d’esprit au fil du temps.',
  },
  {
    icon: Sparkles,
    title: 'Assistant IA',
    description: 'Un coup de pouce contextuel qui comprend votre planning pour vous conseiller.',
  },
  {
    icon: BarChart3,
    title: 'Statistiques & progrès',
    description: 'Des tendances claires sur votre productivité, votre focus et vos habitudes.',
  },
  {
    icon: Trophy,
    title: 'Succès & motivation',
    description: 'Débloquez des paliers qui célèbrent votre régularité, pas seulement vos résultats.',
  },
  {
    icon: Palette,
    title: 'Thèmes personnalisables',
    description: 'Six ambiances visuelles, dont un mode sombre, pour un espace qui vous ressemble.',
  },
]

export function LandingFeatures() {
  return (
    <section id="fonctionnalites" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance font-serif text-3xl font-bold text-foreground sm:text-4xl">
            Tout ce qu’il faut, rien de superflu.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Neuf modules pensés pour s’assembler naturellement — utilisez-les tous, ou seulement
            ceux dont vous avez besoin aujourd’hui.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.35, delay: (i % 3) * 0.06 }}
              className={cn(cardVariants({ padding: 'lg', hover: true }))}
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <feature.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-serif text-base font-bold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
