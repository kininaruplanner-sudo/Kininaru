'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { Target, Plus, X, Check, Trash2, ChevronRight, Sparkles, CalendarDays } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cardVariants } from '@/components/ui/card'

interface Goal {
  id: string
  title: string
  target_date: string | null
  status: 'active' | 'done' | 'archived'
  created_at: string
}

interface LinkedTask {
  id: string
  title: string
  status: string
  goal_id: string
}

interface Props {
  goals: Goal[]
  tasks: LinkedTask[]
  userId: string
}

/**
 * Objectifs — la direction qui donne du sens aux tâches du quotidien.
 *
 * Un objectif est volontairement simple : un titre, une date visée (optionnelle)
 * et un statut. La progression est calculée à partir des tâches RÉELLEMENT
 * rattachées (tasks.goal_id) : jamais de chiffre inventé. L'IA peut proposer
 * de transformer une entrée de journal en objectif — jamais sans confirmation.
 */
export function GoalsClient({ goals: initialGoals, tasks, userId }: Props) {
  const [goals, setGoals] = useState<Goal[]>(initialGoals)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const active = goals.filter((g) => g.status === 'active')
  const done = goals.filter((g) => g.status === 'done')

  const tasksFor = (goalId: string) => tasks.filter((t) => t.goal_id === goalId)
  const progressFor = (goalId: string) => {
    const list = tasksFor(goalId)
    if (list.length === 0) return null
    const doneCount = list.filter((t) => t.status === 'done').length
    return { done: doneCount, total: list.length }
  }

  const createGoal = async () => {
    const clean = title.trim()
    if (!clean) return
    setBusy(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('goals')
        .insert({
          user_id: userId,
          title: clean,
          target_date: targetDate || null,
          status: 'active',
        })
        .select('*')
        .single()
      if (err) throw err
      if (data) setGoals((prev) => [data as Goal, ...prev])
      setTitle('')
      setTargetDate('')
      setShowForm(false)
    } catch {
      setError("L'objectif n'a pas pu être créé. Réessaie dans un instant.")
    } finally {
      setBusy(false)
    }
  }

  const setStatus = async (id: string, status: Goal['status']) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, status } : g)))
    await supabase.from('goals').update({ status }).eq('id', id).eq('user_id', userId)
  }

  const remove = async (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id))
    // Les tâches rattachées ne sont jamais supprimées (FK on delete set null).
    await supabase.from('goals').delete().eq('id', id).eq('user_id', userId)
  }

  return (
    <div className="flex flex-col min-h-0">
      <PageHeader
        title="Objectifs"
        subtitle="Une direction claire pour tes journées — jamais inventée, toujours reliée à tes vraies actions."
        icon={Target}
        actions={
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Annuler' : 'Nouvel objectif'}
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={cn(cardVariants(), 'p-4 sm:p-5 space-y-3')}
            >
              <div className="space-y-1.5">
                <Label htmlFor="goal-title">Objectif</Label>
                <Input
                  id="goal-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex. : réussir mon bac de maths"
                  maxLength={200}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void createGoal()
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goal-date">Date visée (optionnelle)</Label>
                <Input
                  id="goal-date"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full sm:w-52"
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button onClick={() => void createGoal()} disabled={!title.trim() || busy} size="sm">
                <Plus className="w-4 h-4" /> Créer l’objectif
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {goals.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {active.length > 0 && (
              <div className="space-y-3">
                {active.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    progress={progressFor(goal.id)}
                    onComplete={() => void setStatus(goal.id, 'done')}
                    onDelete={() => void remove(goal.id)}
                  />
                ))}
              </div>
            )}

            {done.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/70 px-1 pb-2">
                  Objectifs atteints
                </h3>
                <div className="space-y-3">
                  {done.map((goal) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      progress={progressFor(goal.id)}
                      done
                      onComplete={() => void setStatus(goal.id, 'active')}
                      onDelete={() => void remove(goal.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function GoalCard({
  goal,
  progress,
  done = false,
  onComplete,
  onDelete,
}: {
  goal: Goal
  progress: { done: number; total: number } | null
  done?: boolean
  onComplete: () => void
  onDelete: () => void
}) {
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : null
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(cardVariants(), 'p-4 sm:p-5', done && 'opacity-75')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
              done ? 'bg-kin-sage/20 text-kin-sage' : 'bg-primary/10 text-primary'
            )}
          >
            {done ? <Check className="w-4 h-4" /> : <Target className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <h3 className={cn('text-sm font-semibold text-foreground leading-snug', done && 'line-through')}>
              {goal.title}
            </h3>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {goal.target_date && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" /> {format(new Date(goal.target_date), 'dd MMM yyyy')}
                </span>
              )}
              {progress && (
                <span className="font-medium text-foreground/80">
                  {progress.done}/{progress.total} tâche{progress.total > 1 ? 's' : ''}
                </span>
              )}
              {!progress && <span>Objectif en cours — relie des tâches via l’assistant</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onComplete}
            className="p-2.5 min-w-11 min-h-11 flex items-center justify-center rounded-xl text-muted-foreground hover:text-kin-sage hover:bg-kin-sage/10 transition-smooth"
            title={done ? 'Rouvrir' : 'Marquer comme atteint'}
            aria-label={done ? 'Rouvrir l’objectif' : 'Marquer comme atteint'}
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2.5 min-w-11 min-h-11 flex items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-smooth"
            title="Supprimer (les tâches restent)"
            aria-label="Supprimer l’objectif"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {progress && pct !== null && (
        <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', done ? 'bg-kin-sage' : 'bg-primary')}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      )}
    </motion.div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Target className="w-6 h-6 text-primary" />
      </div>
      <h3 className="kin-h3 text-foreground mb-2">Donne une direction à tes journées</h3>
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">
        Un objectif relie tes tâches entre elles : « réussir mon bac », « tenir une routine sportive »…
        Le coach peut transformer une entrée de journal en objectif — toujours avec ta confirmation.
      </p>
      <Button
        variant="outline"
        size="sm"
        render={
          <Link href="/ai" className="inline-flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" /> Demander au coach
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        }
      />
    </div>
  )
}
