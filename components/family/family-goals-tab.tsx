'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Minus, Plus, Target, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { cardVariants } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FamilyGoal } from './types'

interface Props {
  goals: FamilyGoal[]
  familyId: string
  userId: string
  isParent: boolean
}

const emptyForm = { title: '', target: '', unit: '', dueDate: '' }

export function FamilyGoalsTab({ goals: initial, familyId, userId, isParent }: Props) {
  const [goals, setGoals] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const resetForm = () => {
    setForm(emptyForm)
    setShowForm(false)
    setError('')
  }

  const addGoal = async () => {
    const targetValue = parseFloat(form.target)
    if (!form.title.trim()) {
      setError("Le titre de l'objectif est requis.")
      return
    }
    if (!targetValue || targetValue <= 0) {
      setError('La valeur cible doit être un nombre supérieur à 0.')
      return
    }
    setLoading(true)
    setError('')

    const { data, error: insertError } = await supabase
      .from('family_goals')
      .insert({
        family_id: familyId,
        created_by: userId,
        title: form.title.trim(),
        target_value: targetValue,
        unit: form.unit.trim() || null,
        due_date: form.dueDate || null,
      })
      .select()
      .single()

    setLoading(false)

    if (insertError || !data) {
      setError(insertError?.message || "Impossible de créer l'objectif.")
      return
    }

    setGoals((prev) => [data, ...prev])
    resetForm()
    router.refresh()
  }

  const adjustProgress = async (goal: FamilyGoal, delta: number) => {
    const nextValue = Math.max(0, goal.current_value + delta)
    const nextStatus = nextValue >= goal.target_value ? 'completed' : 'active'

    setGoals((prev) =>
      prev.map((g) => (g.id === goal.id ? { ...g, current_value: nextValue, status: nextStatus } : g))
    )

    const { error: updateError } = await supabase
      .from('family_goals')
      .update({ current_value: nextValue })
      .eq('id', goal.id)

    if (updateError) {
      setError("Impossible de mettre à jour l'objectif.")
      router.refresh()
    }
  }

  const deleteGoal = async (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id))
    const { error: deleteError } = await supabase.from('family_goals').delete().eq('id', id)
    if (deleteError) {
      setError("Impossible de supprimer l'objectif.")
      router.refresh()
    }
  }

  const active = goals.filter((g) => g.status !== 'completed')
  const completed = goals.filter((g) => g.status === 'completed')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {active.length} objectif{active.length !== 1 ? 's' : ''} en cours
        </p>
        <Button size="sm" onClick={() => setShowForm((v) => !v)} className="gap-1.5">
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? 'Annuler' : 'Nouvel objectif'}
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={cn(cardVariants({ padding: 'md' }), 'space-y-3')}>
              <Input
                placeholder="Ex : Économiser pour les vacances"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                autoFocus
              />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Objectif</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="100"
                    value={form.target}
                    onChange={(e) => setForm({ ...form, target: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Unité (optionnel)</Label>
                  <Input
                    placeholder="€, km, pages..."
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Échéance</Label>
                  <Input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
              {error && (
                <div className="bg-destructive/10 text-destructive text-xs p-2.5 rounded-lg border border-destructive/20">
                  {error}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={resetForm}>
                  Annuler
                </Button>
                <Button size="sm" className="flex-1" onClick={addGoal} disabled={loading}>
                  {loading ? 'Création...' : 'Ajouter'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {goals.length === 0 && !showForm ? (
        <div className="text-center py-12">
          <Target className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Aucun objectif commun pour le moment.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Définissez un objectif que toute la famille peut suivre ensemble.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {[...active, ...completed].map((goal, i) => {
            const pct = Math.min(100, Math.round((goal.current_value / goal.target_value) * 100))
            const canDelete = isParent || goal.created_by === userId
            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                className={cn(cardVariants({ padding: 'md' }))}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{goal.title}</p>
                  {canDelete && (
                    <button
                      onClick={() => deleteGoal(goal.id)}
                      className="text-muted-foreground hover:text-destructive transition-smooth shrink-0"
                      aria-label="Supprimer l'objectif"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      goal.status === 'completed' ? 'bg-kin-sage' : 'bg-primary'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">
                    {goal.current_value}
                    {goal.unit ? ` ${goal.unit}` : ''} / {goal.target_value}
                    {goal.unit ? ` ${goal.unit}` : ''}
                    {goal.status === 'completed' && (
                      <span className="text-kin-sage font-medium ml-1">🎉 Atteint</span>
                    )}
                  </span>

                  {goal.status !== 'completed' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => adjustProgress(goal, -1)}
                        className="flex items-center justify-center size-6 rounded-md bg-muted text-muted-foreground hover:text-foreground transition-smooth"
                        aria-label="Diminuer"
                      >
                        <Minus className="size-3" />
                      </button>
                      <button
                        onClick={() => adjustProgress(goal, 1)}
                        className="flex items-center justify-center size-6 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-smooth"
                        aria-label="Augmenter"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
