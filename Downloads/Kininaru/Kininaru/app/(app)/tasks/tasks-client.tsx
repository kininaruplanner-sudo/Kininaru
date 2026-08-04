'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import {
  Plus,
  X,
  ChevronDown,
  Trash2,
  LayoutList,
  LayoutDashboard,
  Flag,
  Tag,
  Calendar,
  CheckSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Priority = 'low' | 'medium' | 'high' | 'urgent'
type Status = 'todo' | 'in_progress' | 'done'
type ViewMode = 'list' | 'kanban'

interface Task {
  id: string
  title: string
  description?: string
  priority: Priority
  status: Status
  due_date?: string
  tags: string[]
  color: string
  created_at: string
  completed_at?: string
}

interface Props {
  tasks: Task[]
  userId: string
}

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string }> = {
  urgent: { label: 'Urgent', color: 'text-red-600', bg: 'bg-red-100' },
  high: { label: 'High', color: 'text-orange-500', bg: 'bg-orange-100' },
  medium: { label: 'Medium', color: 'text-yellow-600', bg: 'bg-yellow-100' },
  low: { label: 'Low', color: 'text-muted-foreground', bg: 'bg-muted' },
}

const KANBAN_COLUMNS: { status: Status; label: string; color: string }[] = [
  { status: 'todo', label: 'To Do', color: 'bg-muted' },
  { status: 'in_progress', label: 'In Progress', color: 'bg-primary/10' },
  { status: 'done', label: 'Done', color: 'bg-[#CDE9D2]/10' },
]

export function TasksClient({ tasks: initialTasks, userId }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [view, setView] = useState<ViewMode>('list')
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<Priority | 'all'>('all')
  const [loading, setLoading] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const supabase = createClient()

  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as Priority,
    due_date: '',
    tags: [] as string[],
    color: '#CDE9D2',
  })

  const filteredTasks =
    filter === 'all' ? tasks : tasks.filter((t) => t.priority === filter)

  const addTag = () => {
    const tag = tagInput.trim()
    if (tag && !form.tags.includes(tag)) {
      setForm({ ...form, tags: [...form.tags, tag] })
    }
    setTagInput('')
  }

  const saveTask = async () => {
    if (!form.title.trim()) return
    setLoading(true)

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: userId,
        title: form.title,
        description: form.description,
        priority: form.priority,
        due_date: form.due_date || null,
        tags: form.tags,
        color: form.color,
        status: 'todo',
      })
      .select()
      .single()

    if (data) {
      setTasks((prev) => [data, ...prev])
      setShowModal(false)
      setForm({ title: '', description: '', priority: 'medium', due_date: '', tags: [], color: '#CDE9D2' })
    }
    setLoading(false)
  }

  const updateStatus = async (id: string, status: Status) => {
    await supabase
      .from('tasks')
      .update({
        status,
        completed_at: status === 'done' ? new Date().toISOString() : null,
      })
      .eq('id', id)
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)))
  }

  const deleteTask = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  const doneTasks = tasks.filter((t) => t.status === 'done').length
  const completionRate = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div>
          <h1 className="text-xl font-serif font-bold text-foreground">Tasks</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {doneTasks} of {tasks.length} completed &middot; {completionRate}%
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-xl p-1 gap-1">
            <button
              onClick={() => setView('list')}
              className={cn(
                'p-2 rounded-lg transition-smooth',
                view === 'list' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('kanban')}
              className={cn(
                'p-2 rounded-lg transition-smooth',
                view === 'kanban' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutDashboard className="w-4 h-4" />
            </button>
          </div>
          <Button
            size="sm"
            onClick={() => setShowModal(true)}
            className="gap-1.5 transition-smooth hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            New Task
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-6 py-3 border-b border-border bg-card/50 overflow-x-auto">
        {(['all', 'urgent', 'high', 'medium', 'low'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-smooth shrink-0',
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
            )}
          >
            {f === 'all' ? 'All tasks' : f}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <AnimatePresence mode="wait">
          {view === 'list' && (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-2 max-w-3xl"
            >
              {filteredTasks.length === 0 ? (
                <div className="text-center py-16">
                  <CheckSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-muted-foreground">No tasks yet</p>
                  <button
                    onClick={() => setShowModal(true)}
                    className="mt-2 text-sm text-primary hover:underline"
                  >
                    Create your first task
                  </button>
                </div>
              ) : (
                filteredTasks.map((task, i) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: i * 0.03, duration: 0.2 }}
                    className={cn(
                      'group flex items-start gap-3 p-4 bg-card border border-border rounded-2xl hover:shadow-md transition-smooth',
                      task.status === 'done' && 'opacity-60'
                    )}
                  >
                    {/* Status toggle */}
                    <button
                      onClick={() =>
                        updateStatus(task.id, task.status === 'done' ? 'todo' : 'done')
                      }
                      className={cn(
                        'mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-smooth hover:scale-110',
                        task.status === 'done'
                          ? 'bg-[#CDE9D2] border-[#CDE9D2]'
                          : 'border-border hover:border-primary'
                      )}
                    >
                      {task.status === 'done' && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium text-foreground', task.status === 'done' && 'line-through')}>
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {task.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', PRIORITY_CONFIG[task.priority as Priority]?.bg, PRIORITY_CONFIG[task.priority as Priority]?.color)}>
                          {PRIORITY_CONFIG[task.priority as Priority]?.label}
                        </span>
                        {task.due_date && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(task.due_date), 'MMM d')}
                          </span>
                        )}
                        {task.tags?.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded-full text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-smooth">
                      {task.status !== 'in_progress' && task.status !== 'done' && (
                        <button
                          onClick={() => updateStatus(task.id, 'in_progress')}
                          className="p-1.5 rounded-lg hover:bg-primary/10 hover:text-primary text-muted-foreground transition-smooth text-xs"
                          title="Mark in progress"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-smooth"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}

          {view === 'kanban' && (
            <motion.div
              key="kanban"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex gap-4 min-h-full"
            >
              {KANBAN_COLUMNS.map((col) => {
                const colTasks = filteredTasks.filter((t) => t.status === col.status)
                return (
                  <div key={col.status} className="flex-1 min-w-[240px]">
                    <div className={cn('px-3 py-2 rounded-xl mb-3', col.color)}>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                        <span className="text-xs bg-background rounded-full px-2 py-0.5 text-muted-foreground">
                          {colTasks.length}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {colTasks.map((task, i) => (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="p-3 bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-smooth cursor-pointer"
                        >
                          <p className="text-sm font-medium text-foreground mb-2">{task.title}</p>
                          <div className="flex items-center justify-between">
                            <span className={cn('text-xs px-2 py-0.5 rounded-full', PRIORITY_CONFIG[task.priority as Priority]?.bg, PRIORITY_CONFIG[task.priority as Priority]?.color)}>
                              {PRIORITY_CONFIG[task.priority as Priority]?.label}
                            </span>
                            <button
                              onClick={() => deleteTask(task.id)}
                              className="p-1 hover:text-destructive text-muted-foreground transition-smooth"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {col.status !== 'done' && (
                            <button
                              onClick={() =>
                                updateStatus(
                                  task.id,
                                  col.status === 'todo' ? 'in_progress' : 'done'
                                )
                              }
                              className="mt-2 w-full text-xs text-center py-1 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground transition-smooth"
                            >
                              Move to {col.status === 'todo' ? 'In Progress' : 'Done'}
                            </button>
                          )}
                        </motion.div>
                      ))}
                      <button
                        onClick={() => setShowModal(true)}
                        className="w-full p-3 border-2 border-dashed border-border rounded-xl text-xs text-muted-foreground hover:border-primary hover:text-primary transition-smooth flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add task
                      </button>
                    </div>
                  </div>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Task creation modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="glass border border-border rounded-3xl p-6 w-full max-w-md shadow-kin-hover"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-serif font-bold text-foreground">New Task</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-smooth"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Task title</Label>
                  <Input
                    placeholder="What needs to be done?"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="mt-1 transition-smooth"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                        saveTask()
                      }
                    }}
                  />
                </div>

                <div>
                  <Label>Description (optional)</Label>
                  <textarea
                    placeholder="Add more details..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="mt-1 w-full h-20 px-3 py-2 text-sm bg-background border border-input rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-ring transition-smooth"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Priority</Label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
                      className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring transition-smooth"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <Label>Due date</Label>
                    <Input
                      type="date"
                      value={form.due_date}
                      onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                      className="mt-1 transition-smooth"
                    />
                  </div>
                </div>

                <div>
                  <Label>Tags</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      placeholder="Add a tag"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      className="flex-1 transition-smooth"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) addTag()
                      }}
                    />
                    <Button variant="outline" size="sm" onClick={addTag}>
                      <Tag className="w-4 h-4" />
                    </Button>
                  </div>
                  {form.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {form.tags.map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 px-2 py-0.5 bg-secondary text-secondary-foreground rounded-full text-xs"
                        >
                          {tag}
                          <button
                            onClick={() => setForm({ ...form, tags: form.tags.filter((t) => t !== tag) })}
                            className="hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1 transition-smooth"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 transition-smooth hover:scale-[1.02]"
                    onClick={saveTask}
                    disabled={loading || !form.title.trim()}
                  >
                    {loading ? 'Saving...' : 'Create task'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
