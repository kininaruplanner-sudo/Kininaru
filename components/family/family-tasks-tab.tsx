'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Circle, CheckSquare, Plus, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { cardVariants } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FamilyMember, FamilyTask, FamilyTaskPriority } from './types'

interface Props {
  tasks: FamilyTask[]
  members: FamilyMember[]
  familyId: string
  userId: string
  isParent: boolean
}

const PRIORITY_CONFIG: Record<FamilyTaskPriority, { label: string; className: string }> = {
  urgent: { label: 'Urgent', className: 'bg-destructive/10 text-destructive' },
  high: { label: 'Haute', className: 'bg-kin-coral/20 text-kin-coral' },
  medium: { label: 'Moyenne', className: 'bg-kin-yellow/20 text-kin-yellow' },
  low: { label: 'Basse', className: 'bg-kin-sage/20 text-kin-sage' },
}

const emptyForm = { title: '', assignedTo: '', priority: 'medium' as FamilyTaskPriority, dueDate: '' }

export function FamilyTasksTab({ tasks: initial, members, familyId, userId, isParent }: Props) {
  const [tasks, setTasks] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const memberName = (id: string | null) =>
    id ? members.find((m) => m.user_id === id)?.display_name ?? 'Membre' : null

  const resetForm = () => {
    setForm(emptyForm)
    setShowForm(false)
    setError('')
  }

  const addTask = async () => {
    if (!form.title.trim()) {
      setError('Le titre est requis.')
      return
    }
    setLoading(true)
    setError('')

    const { data, error: insertError } = await supabase
      .from('family_tasks')
      .insert({
        family_id: familyId,
        created_by: userId,
        assigned_to: form.assignedTo || null,
        title: form.title.trim(),
        priority: form.priority,
        due_date: form.dueDate || null,
      })
      .select()
      .single()

    setLoading(false)

    if (insertError || !data) {
      setError(insertError?.message || 'Impossible de créer la tâche.')
      return
    }

    setTasks((prev) => [data, ...prev])
    resetForm()
    router.refresh()
  }

  const toggleStatus = async (task: FamilyTask) => {
    const nextStatus = task.status === 'done' ? 'todo' : 'done'
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, status: nextStatus, completed_at: nextStatus === 'done' ? new Date().toISOString() : null }
          : t
      )
    )
    const { error: updateError } = await supabase
      .from('family_tasks')
      .update({
        status: nextStatus,
        completed_at: nextStatus === 'done' ? new Date().toISOString() : null,
      })
      .eq('id', task.id)

    if (updateError) {
      setError('Impossible de mettre à jour la tâche.')
      router.refresh()
    }
  }

  const deleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    const { error: deleteError } = await supabase.from('family_tasks').delete().eq('id', id)
    if (deleteError) {
      setError('Impossible de supprimer la tâche.')
      router.refresh()
    }
  }

  const pending = tasks.filter((t) => t.status !== 'done')
  const done = tasks.filter((t) => t.status === 'done')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {pending.length} tâche{pending.length !== 1 ? 's' : ''} en cours
        </p>
        <Button size="sm" onClick={() => setShowForm((v) => !v)} className="gap-1.5">
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? 'Annuler' : 'Nouvelle tâche'}
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
                placeholder="Que faut-il faire ?"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) addTask()
                }}
              />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Assigné à</Label>
                  <select
                    value={form.assignedTo}
                    onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                    className="mt-1 w-full h-9 px-2 text-xs bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring transition-smooth"
                  >
                    <option value="">Personne</option>
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.display_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Priorité</Label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value as FamilyTaskPriority })}
                    className="mt-1 w-full h-9 px-2 text-xs bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring transition-smooth"
                  >
                    <option value="low">Basse</option>
                    <option value="medium">Moyenne</option>
                    <option value="high">Haute</option>
                    <option value="urgent">Urgent</option>
                  </select>
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
                <Button size="sm" className="flex-1" onClick={addTask} disabled={loading}>
                  {loading ? 'Création...' : 'Ajouter'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {tasks.length === 0 && !showForm ? (
        <div className="text-center py-12">
          <CheckSquare className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Aucune tâche familiale pour le moment.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Ajoutez une tâche et assignez-la à un membre de la famille.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...pending, ...done].map((task, i) => {
            const assignee = memberName(task.assigned_to)
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
                className={cn(cardVariants({ padding: 'sm' }), 'flex items-center gap-3')}
              >
                <button
                  onClick={() => toggleStatus(task)}
                  className="shrink-0"
                  aria-label={task.status === 'done' ? 'Marquer à faire' : 'Marquer terminée'}
                >
                  {task.status === 'done' ? (
                    <CheckCircle2 className="w-5 h-5 text-kin-sage" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground/50" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'text-sm truncate',
                      task.status === 'done'
                        ? 'text-muted-foreground line-through'
                        : 'text-foreground'
                    )}
                  >
                    {task.title}
                  </p>
                  {(assignee || task.due_date) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {assignee && <>Assignée à {assignee}</>}
                      {assignee && task.due_date && ' · '}
                      {task.due_date && `Échéance ${task.due_date}`}
                    </p>
                  )}
                </div>

                <span
                  className={cn(
                    'shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium',
                    PRIORITY_CONFIG[task.priority].className
                  )}
                >
                  {PRIORITY_CONFIG[task.priority].label}
                </span>

                {(isParent || task.created_by === userId) && (
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-muted-foreground hover:text-destructive transition-smooth shrink-0"
                    aria-label="Supprimer la tâche"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
