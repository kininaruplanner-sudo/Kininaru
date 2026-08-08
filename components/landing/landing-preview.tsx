'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  Repeat2,
  Flame,
  Clock,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { cardVariants } from '@/components/ui/card'

const TABS = [
  { id: 'dashboard', label: 'Aperçu', icon: LayoutDashboard },
  { id: 'calendrier', label: 'Calendrier', icon: CalendarDays },
  { id: 'taches', label: 'Tâches', icon: CheckSquare },
  { id: 'habitudes', label: 'Habitudes', icon: Repeat2 },
] as const

type TabId = (typeof TABS)[number]['id']

const STAT_TILES = [
  { label: 'Tâches faites', value: '12/15', icon: CheckSquare, tint: 'text-kin-blue' },
  { label: 'Focus aujourd’hui', value: '95 min', icon: Clock, tint: 'text-kin-lavender' },
  { label: 'Série habitudes', value: '18 jours', icon: Flame, tint: 'text-kin-coral' },
  { label: 'Progrès semaine', value: '+24%', icon: TrendingUp, tint: 'text-kin-sage' },
]

const WEEK_BARS = [40, 65, 30, 80, 55, 90, 45]

const PRIORITY_TASKS = [
  { label: 'Préparer la présentation client', tag: 'Urgent' },
  { label: 'Relire le rapport mensuel', tag: 'Haute' },
  { label: 'Appeler le fournisseur', tag: 'Moyenne' },
]

const CALENDAR_DAYS = Array.from({ length: 35 }, (_, i) => i)
const CALENDAR_EVENT_DAYS = new Set([3, 8, 9, 14, 20, 21, 27])

const AGENDA = [
  { time: '09:00', label: 'Point équipe' },
  { time: '12:30', label: 'Déjeuner avec Sam' },
  { time: '16:00', label: 'Session focus' },
]

const TASK_ROWS = [
  { label: 'Finaliser la maquette landing', done: true, priority: 'Haute' },
  { label: 'Écrire les tests unitaires', done: true, priority: 'Moyenne' },
  { label: 'Répondre aux retours clients', done: false, priority: 'Urgent' },
  { label: 'Planifier le sprint suivant', done: false, priority: 'Basse' },
]

const HABITS = [
  { label: 'Méditation', streak: 12, tint: 'bg-kin-lavender' },
  { label: 'Lecture', streak: 8, tint: 'bg-kin-blue' },
  { label: 'Sport', streak: 21, tint: 'bg-kin-coral' },
  { label: 'Hydratation', streak: 30, tint: 'bg-kin-sage' },
]

export function LandingPreview() {
  const [active, setActive] = useState<TabId>('dashboard')

  return (
    <div className="mx-auto max-w-4xl">
      <div className={cn(cardVariants({ padding: 'sm' }), 'shadow-kin-hover overflow-hidden p-0')}>
        {/* Browser chrome */}
        <div className="flex items-center gap-3 border-b border-border bg-muted/60 px-4 py-3">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-kin-coral" />
            <span className="size-2.5 rounded-full bg-kin-yellow" />
            <span className="size-2.5 rounded-full bg-kin-sage" />
          </div>
          <div className="flex-1 rounded-md bg-card px-3 py-1 text-center text-xs text-muted-foreground border border-border">
            app.kininaru.com
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = active === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-smooth',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-kin'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="size-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Panel */}
        <div className="relative min-h-[340px] bg-background p-4 sm:p-6">
          <AnimatePresence mode="wait">
            {active === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {STAT_TILES.map((tile) => (
                    <div key={tile.label} className={cn(cardVariants({ padding: 'sm' }))}>
                      <tile.icon className={cn('size-4', tile.tint)} />
                      <p className="mt-2 font-serif text-lg font-bold text-foreground">
                        {tile.value}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{tile.label}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className={cn(cardVariants({ padding: 'sm' }), 'sm:col-span-2')}>
                    <p className="mb-3 text-xs font-medium text-muted-foreground">
                      Focus cette semaine
                    </p>
                    <div className="flex h-20 items-end gap-2">
                      {WEEK_BARS.map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t-md bg-primary/70"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className={cn(cardVariants({ padding: 'sm' }))}>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Priorités</p>
                    <ul className="space-y-2">
                      {PRIORITY_TASKS.map((t) => (
                        <li key={t.label} className="text-[11px] text-foreground truncate">
                          • {t.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}

            {active === 'calendrier' && (
              <motion.div
                key="calendrier"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="grid gap-4 sm:grid-cols-3"
              >
                <div className={cn(cardVariants({ padding: 'sm' }), 'sm:col-span-2')}>
                  <div className="grid grid-cols-7 gap-1.5">
                    {CALENDAR_DAYS.map((d) => (
                      <div
                        key={d}
                        className={cn(
                          'flex aspect-square items-center justify-center rounded-md text-[10px]',
                          CALENDAR_EVENT_DAYS.has(d)
                            ? 'bg-primary/15 font-semibold text-primary'
                            : 'text-muted-foreground'
                        )}
                      >
                        {d + 1}
                      </div>
                    ))}
                  </div>
                </div>
                <div className={cn(cardVariants({ padding: 'sm' }))}>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Aujourd’hui</p>
                  <ul className="space-y-2.5">
                    {AGENDA.map((a) => (
                      <li key={a.time} className="flex gap-2 text-[11px]">
                        <span className="font-medium text-primary shrink-0">{a.time}</span>
                        <span className="text-foreground truncate">{a.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}

            {active === 'taches' && (
              <motion.div
                key="taches"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-2"
              >
                {TASK_ROWS.map((row) => (
                  <div
                    key={row.label}
                    className={cn(
                      cardVariants({ padding: 'sm' }),
                      'flex items-center gap-3'
                    )}
                  >
                    <CheckCircle2
                      className={cn(
                        'size-4 shrink-0',
                        row.done ? 'text-kin-sage' : 'text-muted-foreground/40'
                      )}
                    />
                    <span
                      className={cn(
                        'flex-1 text-xs truncate',
                        row.done ? 'text-muted-foreground line-through' : 'text-foreground'
                      )}
                    >
                      {row.label}
                    </span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {row.priority}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}

            {active === 'habitudes' && (
              <motion.div
                key="habitudes"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-2 gap-3 sm:grid-cols-4"
              >
                {HABITS.map((h) => (
                  <div key={h.label} className={cn(cardVariants({ padding: 'sm' }))}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">{h.label}</span>
                      <span className="flex items-center gap-0.5 text-[10px] font-semibold text-kin-coral">
                        <Flame className="size-3" />
                        {h.streak}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-1">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <span
                          key={i}
                          className={cn(
                            'h-4 flex-1 rounded-sm',
                            i < 5 ? h.tint : 'bg-muted'
                          )}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Aperçu illustratif de l'interface — vos propres données remplacent cet exemple dès la
        connexion.
      </p>
    </div>
  )
}
