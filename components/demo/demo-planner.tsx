'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Check,
  Flame,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Timer,
  Trash2,
} from 'lucide-react'
import { KinLogo } from '@/components/kin-logo'
import { Card } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Types + données de départ                                           */
/* ------------------------------------------------------------------ */

type Priority = 'haute' | 'moyenne' | 'basse'

type DemoTask = {
  id: string
  title: string
  done: boolean
  priority: Priority
}

type DemoHabit = {
  id: string
  label: string
  emoji: string
  streak: number
  done: boolean
}

const INITIAL_TASKS: DemoTask[] = [
  { id: 't1', title: 'Préparer la présentation de demain', done: false, priority: 'haute' },
  { id: 't2', title: 'Course pour le dîner', done: false, priority: 'moyenne' },
  { id: 't3', title: 'Relire le chapitre 4', done: true, priority: 'basse' },
]

const INITIAL_HABITS: DemoHabit[] = [
  { id: 'h1', label: 'Lecture · 20 min', emoji: '📖', streak: 6, done: false },
  { id: 'h2', label: 'Marche · 8 000 pas', emoji: '🚶', streak: 3, done: true },
  { id: 'h3', label: 'Boire 1,5 L d’eau', emoji: '💧', streak: 12, done: false },
]

const PRIORITY_STYLE: Record<Priority, { dot: string; label: string }> = {
  haute: { dot: 'bg-kin-coral', label: 'Haute' },
  moyenne: { dot: 'bg-kin-yellow', label: 'Moyenne' },
  basse: { dot: 'bg-kin-sage', label: 'Basse' },
}

const FOCUS_DURATION = 25 * 60

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/* ------------------------------------------------------------------ */
/* Démo                                                                */
/* ------------------------------------------------------------------ */

export function DemoPlanner() {
  const [tasks, setTasks] = useState<DemoTask[]>(INITIAL_TASKS)
  const [habits, setHabits] = useState<DemoHabit[]>(INITIAL_HABITS)
  const [draft, setDraft] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_DURATION)
  const [running, setRunning] = useState(false)

  // La session est terminée dès que le compteur atteint zéro : l'état
  // « en cours » est dérivé, donc aucun setState n'est nécessaire dans un
  // effet quand le minuteur arrive au bout.
  const finished = secondsLeft === 0
  const isRunning = running && !finished

  // Décompte réel du minuteur : l'intervalle ne tourne que pendant une
  // session active (isRunning est faux dès que le compteur atteint zéro ou
  // pendant une pause), donc aucun état à synchroniser ailleurs.
  useEffect(() => {
    if (!isRunning) return
    const id = window.setInterval(() => {
      setSecondsLeft((previous) => Math.max(0, previous - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [isRunning])

  const doneTasks = tasks.filter((task) => task.done).length
  const doneHabits = habits.filter((habit) => habit.done).length
  const progress = tasks.length === 0 ? 0 : Math.round((doneTasks / tasks.length) * 100)

  function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = draft.trim()
    if (!title) return
    setTasks((current) => [
      ...current,
      { id: `t${Date.now()}`, title, done: false, priority: 'moyenne' },
    ])
    setDraft('')
  }

  function toggleTask(id: string) {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, done: !task.done } : task)),
    )
  }

  function removeTask(id: string) {
    setTasks((current) => current.filter((task) => task.id !== id))
  }

  function toggleHabit(id: string) {
    setHabits((current) =>
      current.map((habit) => (habit.id === id ? { ...habit, done: !habit.done } : habit)),
    )
  }

  function resetDemo() {
    setTasks(INITIAL_TASKS)
    setHabits(INITIAL_HABITS)
    setDraft('')
    setRunning(false)
    setSecondsLeft(FOCUS_DURATION)
  }

  // La suggestion du coach est entièrement dérivée de l'état de la démo :
  // elle change au fur et à mesure que l'on coche, ajoute ou lance le focus.
  const suggestion = useMemo(() => {
    if (isRunning) {
      return 'Tu es en session focus. Le coach te laisse tranquille jusqu’à la fin du minuteur.'
    }
    if (finished) {
      return 'Session terminée. Prends 5 minutes de pause avant la suivante — c’est ce qui tient sur la durée.'
    }
    const nextTask = tasks.find((task) => !task.done)
    if (!nextTask) {
      return 'Tout est coché. C’est le bon moment pour préparer demain en une seule tâche.'
    }
    if (doneTaskShare(doneTasks, tasks.length) >= 50) {
      return `Bien avancé. La suite logique : « ${nextTask.title} », puis tu lèves le pied.`
    }
    return `Commence par « ${nextTask.title} » — 25 minutes suffisent pour la lancer.`
  }, [tasks, doneTasks, isRunning, finished])

  return (
    <div className="min-h-dvh bg-background">
      <header className="glass-topbar sticky top-0 z-30 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link href="/" aria-label="Kininaru — accueil" className="flex items-center gap-2.5">
            <KinLogo variant="row" markClassName="w-8 h-8" wordmarkClassName="text-lg" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-card text-xs font-medium text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
              Démo interactive
            </span>
            <Link
              href="/auth/sign-up"
              className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'gap-1.5')}
            >
              Créer mon compte
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="mb-8 sm:mb-10 max-w-2xl">
          <p className="kin-script kin-gradient-vivid text-lg sm:text-xl mb-2">
            Ma journée évolue.
          </p>
          <h1 className="kin-display text-[clamp(1.9rem,6vw,2.75rem)] mb-3">
            Essaie Kininaru sans compte.
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Coche une tâche, ajoute la tienne, lance une session de focus : tout réagit
            comme dans l’application. Rien n’est enregistré, tu peux tout casser.
          </p>
        </div>

        <div className="grid gap-4 lg:gap-5 lg:grid-cols-3">
          {/* ------------------------- Tâches ------------------------- */}
          <Card padding="lg" className="lg:col-span-2 flex flex-col">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="kin-h2">Ma journée</h2>
                <p className="kin-caption mt-0.5">
                  {doneTasks}/{tasks.length} terminée{doneTasks > 1 ? 's' : ''} ·{' '}
                  {progress} % de la liste
                </p>
              </div>
              <span className="text-xs font-medium text-muted-foreground">Aujourd’hui</span>
            </div>

            <div
              className="h-1.5 rounded-full bg-muted overflow-hidden mb-5"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label="Progression de la journée"
            >
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>

            <ul className="space-y-2 mb-4">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="group flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/50 border border-border/60"
                >
                  <button
                    type="button"
                    onClick={() => toggleTask(task.id)}
                    aria-pressed={task.done}
                    aria-label={`${task.done ? 'Décocher' : 'Cocher'} : ${task.title}`}
                    className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-smooth',
                      task.done
                        ? 'bg-kin-sage border-kin-sage text-white'
                        : 'border-border hover:border-primary',
                    )}
                  >
                    {task.done && <Check className="w-3 h-3" strokeWidth={3.5} aria-hidden="true" />}
                  </button>

                  <span
                    className={cn(
                      'flex-1 text-sm',
                      task.done ? 'text-muted-foreground line-through' : 'text-foreground',
                    )}
                  >
                    {task.title}
                  </span>

                  <span className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_STYLE[task.priority].dot)}
                      aria-hidden="true"
                    />
                    <span className="kin-caption hidden sm:inline">
                      {PRIORITY_STYLE[task.priority].label}
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={() => removeTask(task.id)}
                    aria-label={`Supprimer : ${task.title}`}
                    className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-smooth text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
              {tasks.length === 0 && (
                <li className="px-3 py-6 rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground">
                  Liste vide. Ajoute une tâche pour voir le coach réagir.
                </li>
              )}
            </ul>

            <form onSubmit={addTask} className="flex gap-2 mt-auto">
              <label htmlFor="demo-task" className="sr-only">
                Nouvelle tâche
              </label>
              <input
                id="demo-task"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ajouter une tâche…"
                className="flex-1 h-10 px-3 rounded-xl border border-border bg-background text-sm placeholder:text-muted-foreground focus-visible:border-ring"
              />
              <button
                type="submit"
                aria-label="Ajouter la tâche"
                disabled={!draft.trim()}
                className={cn(buttonVariants({ variant: 'default' }), 'h-10 px-3 gap-1.5')}
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">Ajouter</span>
              </button>
            </form>
          </Card>

          {/* ------------------- Focus + habitudes ------------------- */}
          <div className="space-y-4 lg:space-y-5">
            <Card padding="lg">
              <div className="flex items-center gap-2 mb-4">
                <Timer className="w-4 h-4 text-primary" aria-hidden="true" />
                <h2 className="kin-h2">Session focus</h2>
              </div>

              <p
                className="text-5xl font-bold tabular-nums text-foreground mb-1"
                role="timer"
                aria-live="off"
              >
                {formatTime(secondsLeft)}
              </p>
              <p className="kin-caption mb-4">
                {finished
                  ? 'Session terminée · prends une pause'
                  : isRunning
                    ? 'En cours · le coach patiente'
                    : '25 minutes sans notification'}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (finished) {
                      setSecondsLeft(FOCUS_DURATION)
                      setRunning(true)
                      return
                    }
                    setRunning((current) => !current)
                  }}
                  className={cn(buttonVariants({ variant: 'default' }), 'flex-1 h-10 gap-1.5')}
                >
                  {isRunning ? (
                    <>
                      <Pause className="w-4 h-4" aria-hidden="true" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" aria-hidden="true" />
                      {finished ? 'Relancer' : 'Démarrer'}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRunning(false)
                    setSecondsLeft(FOCUS_DURATION)
                  }}
                  aria-label="Réinitialiser le minuteur"
                  className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'h-10 w-10')}
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </Card>

            <Card padding="lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="kin-h2">Habitudes</h2>
                <span className="kin-caption">
                  {doneHabits}/{habits.length}
                </span>
              </div>

              <ul className="space-y-2">
                {habits.map((habit) => (
                  <li key={habit.id}>
                    <button
                      type="button"
                      onClick={() => toggleHabit(habit.id)}
                      aria-pressed={habit.done}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-smooth',
                        habit.done
                          ? 'border-kin-sage/40 bg-kin-sage/10'
                          : 'border-border/60 bg-muted/40 hover:border-primary/40',
                      )}
                    >
                      <span aria-hidden="true" className="text-base">
                        {habit.emoji}
                      </span>
                      <span className="flex-1 text-sm text-foreground">{habit.label}</span>
                      <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                        <Flame className="w-3.5 h-3.5" aria-hidden="true" />
                        {habit.streak + (habit.done ? 1 : 0)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>

        {/* ------------------------- Coach ------------------------- */}
        <Card padding="lg" className="mt-4 lg:mt-5 border-primary/20 bg-primary/5">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" aria-hidden="true" />
            </span>
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">
                Suggestion du coach
              </p>
              <p className="text-sm sm:text-base text-foreground leading-relaxed" aria-live="polite">
                {suggestion}
              </p>
            </div>
          </div>
        </Card>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-5">
          <div>
            <p className="text-sm font-semibold text-foreground">
              La démo s’arrête ici. Tes vraies données continuent.
            </p>
            <p className="kin-caption mt-0.5">
              Compte gratuit · synchronisation, journal, calendrier et coach IA.
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={resetDemo}
              className={cn(buttonVariants({ variant: 'outline' }), 'h-10 flex-1 sm:flex-none')}
            >
              Réinitialiser
            </button>
            <Link
              href="/auth/sign-up"
              className={cn(buttonVariants({ variant: 'default' }), 'h-10 gap-1.5 flex-1 sm:flex-none')}
            >
              Créer mon compte
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

function doneTaskShare(done: number, total: number) {
  if (total === 0) return 0
  return Math.round((done / total) * 100)
}
