'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, isPast } from 'date-fns'
import {
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Trash2,
  LayoutList,
  LayoutDashboard,
  Flag,
  Tag,
  Calendar,
  CheckSquare,
  Search,
  ArrowUpDown,
  GripVertical,
  ListChecks,
  Pencil,
  Play,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cardVariants } from '@/components/ui/card'
import { palette } from '@/lib/palette'
import { PageHeader } from '@/components/page-header'

type Priority = 'low' | 'medium' | 'high' | 'urgent'
type Status = 'todo' | 'in_progress' | 'done'
type ViewMode = 'list' | 'kanban'
type SortKey = 'newest' | 'oldest' | 'priority' | 'due' | 'alpha'
type StatusFilter = 'all' | Status

interface Task {
  id: string
  parent_id?: string | null
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

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; border: string }> = {
  urgent: { label: 'Urgent', color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-l-destructive' },
  high: { label: 'High', color: 'text-kin-coral', bg: 'bg-kin-coral/20', border: 'border-l-kin-coral' },
  medium: { label: 'Medium', color: 'text-kin-yellow', bg: 'bg-kin-yellow/20', border: 'border-l-kin-yellow' },
  low: { label: 'Low', color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-l-border' },
}

const PRIORITY_ORDER: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'priority', label: 'Priority' },
  { value: 'due', label: 'Due date' },
  { value: 'alpha', label: 'Alphabetical' },
]

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
]

const KANBAN_COLUMNS: { status: Status; label: string; color: string }[] = [
  { status: 'todo', label: 'To Do', color: 'bg-muted' },
  { status: 'in_progress', label: 'In Progress', color: 'bg-primary/10' },
  { status: 'done', label: 'Done', color: 'bg-kin-sage/10' },
]

// ---- Small shared pieces (previously duplicated between List and Kanban) ----

function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = PRIORITY_CONFIG[priority]
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0', cfg.bg, cfg.color)}>
      {(priority === 'urgent' || priority === 'high') && <Flag className="w-3 h-3" />}
      {cfg.label}
    </span>
  )
}

function TagList({ tags, max = 3 }: { tags: string[]; max?: number }) {
  if (!tags?.length) return null
  const shown = tags.slice(0, max)
  const extra = tags.length - shown.length
  return (
    <>
      {shown.map((tag) => (
        <span key={tag} className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded-full text-xs">
          {tag}
        </span>
      ))}
      {extra > 0 && <span className="text-xs text-muted-foreground">+{extra}</span>}
    </>
  )
}

function SubtaskProgress({ done, total }: { done: number; total: number }) {
  if (total === 0) return null
  const pct = Math.round((done / total) * 100)
  return (
    <span className="flex items-center gap-1.5 shrink-0">
      <span className="w-12 h-1 bg-muted rounded-full overflow-hidden">
        <span className="block h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-[10px] text-muted-foreground">{done}/{total}</span>
    </span>
  )
}

export function TasksClient({ tasks: initialTasks, userId }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [view, setView] = useState<ViewMode>('list')
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()

  // Opened via the command palette's quick-create shortcut (?new=1)
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowModal(true)
      router.replace(window.location.pathname)
    }
  }, [searchParams, router])

  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [subtaskDraft, setSubtaskDraft] = useState<Record<string, string>>({})

  const [loading, setLoading] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const supabase = createClient()

  // Kanban drag state
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<Status | null>(null)

  const [form, setForm] = useState<{
    title: string
    description: string
    priority: Priority
    due_date: string
    tags: string[]
    color: string
  }>({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    tags: [],
    color: palette('sage'),
  })

  // ---- Subtask grouping ----
  const topLevelTasks = useMemo(() => tasks.filter((t) => !t.parent_id), [tasks])
  const subtasksByParent = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      if (t.parent_id) {
        if (!map.has(t.parent_id)) map.set(t.parent_id, [])
        map.get(t.parent_id)!.push(t)
      }
    }
    return map
  }, [tasks])

  const allTags = useMemo(
    () => Array.from(new Set(tasks.flatMap((t) => t.tags || []))).sort(),
    [tasks]
  )

  // ---- Filter + search + sort pipeline ----
  const filteredTasks = useMemo(() => {
    let list = topLevelTasks
    if (priorityFilter !== 'all') list = list.filter((t) => t.priority === priorityFilter)
    if (view === 'list' && statusFilter !== 'all') list = list.filter((t) => t.status === statusFilter)
    if (selectedTags.length > 0) list = list.filter((t) => t.tags?.some((tag) => selectedTags.includes(tag)))
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.tags?.some((tag) => tag.toLowerCase().includes(q))
      )
    }

    const sorted = [...list]
    switch (sortKey) {
      case 'newest':
        sorted.sort((a, b) => b.created_at.localeCompare(a.created_at))
        break
      case 'oldest':
        sorted.sort((a, b) => a.created_at.localeCompare(b.created_at))
        break
      case 'priority':
        sorted.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
        break
      case 'due':
        sorted.sort((a, b) => {
          if (!a.due_date && !b.due_date) return 0
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return a.due_date.localeCompare(b.due_date)
        })
        break
      case 'alpha':
        sorted.sort((a, b) => a.title.localeCompare(b.title))
        break
    }
    return sorted
  }, [topLevelTasks, priorityFilter, statusFilter, selectedTags, search, sortKey, view])

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const addTag = () => {
    const tag = tagInput.trim()
    if (tag && !form.tags.includes(tag)) {
      setForm({ ...form, tags: [...form.tags, tag] })
    }
    setTagInput('')
  }

  const openNewTask = () => {
    setEditingTask(null)
    setForm({ title: '', description: '', priority: 'medium', due_date: '', tags: [], color: palette('sage') })
    setShowModal(true)
  }

  const openEditTask = (task: Task) => {
    setEditingTask(task)
    setForm({
      title: task.title,
      description: task.description ?? '',
      priority: task.priority,
      due_date: task.due_date ?? '',
      tags: task.tags ?? [],
      color: task.color ?? palette('sage'),
    })
    setShowModal(true)
  }

  const saveTask = async () => {
    if (!form.title.trim()) return
    setLoading(true)

    const payload = {
      title: form.title,
      description: form.description,
      priority: form.priority,
      due_date: form.due_date || null,
      tags: form.tags,
      color: form.color,
    }

    if (editingTask) {
      const { data } = await supabase
        .from('tasks')
        .update(payload)
        .eq('id', editingTask.id)
        .select()
        .single()
      if (data) {
        setTasks((prev) => prev.map((t) => (t.id === data.id ? data : t)))
        setShowModal(false)
      }
    } else {
      const { data } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          ...payload,
          status: 'todo',
        })
        .select()
        .single()

      if (data) {
        setTasks((prev) => [data, ...prev])
        setShowModal(false)
      }
    }
    setLoading(false)
  }

  const updateStatus = async (id: string, status: Status) => {
    const completedAt = status === 'done' ? new Date().toISOString() : null
    await supabase
      .from('tasks')
      .update({
        status,
        completed_at: completedAt,
      })
      .eq('id', id)
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status, completed_at: completedAt ?? undefined } : t)))
  }

  const deleteTask = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  const addSubtask = async (parentId: string) => {
    const title = (subtaskDraft[parentId] || '').trim()
    if (!title) return
    const { data } = await supabase
      .from('tasks')
      .insert({
        user_id: userId,
        parent_id: parentId,
        title,
        priority: 'medium',
        status: 'todo',
      })
      .select()
      .single()
    if (data) {
      setTasks((prev) => [...prev, data])
      setSubtaskDraft((prev) => ({ ...prev, [parentId]: '' }))
    }
  }

  const doneTasks = topLevelTasks.filter((t) => t.status === 'done').length
  const completionRate = topLevelTasks.length > 0 ? Math.round((doneTasks / topLevelTasks.length) * 100) : 0

  const hasActiveFilters = priorityFilter !== 'all' || statusFilter !== 'all' || selectedTags.length > 0 || search.trim() !== ''
  const clearFilters = () => {
    setPriorityFilter('all')
    setStatusFilter('all')
    setSelectedTags([])
    setSearch('')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <PageHeader
        icon={CheckSquare}
        title="Tâches"
        subtitle={`${doneTasks} terminées sur ${topLevelTasks.length} · ${completionRate} %`}
        actions={
          <>
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Rechercher une tâche..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-40 sm:w-52 pl-8 transition-smooth"
              />
            </div>
            <div className="flex bg-muted rounded-xl p-1 gap-1">
              <button
                onClick={() => setView('list')}
                className={cn(
                  'p-2 rounded-lg transition-smooth',
                  view === 'list' ? 'bg-card shadow-kin text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label="Vue liste"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('kanban')}
                className={cn(
                  'p-2 rounded-lg transition-smooth',
                  view === 'kanban' ? 'bg-card shadow-kin text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label="Vue kanban"
              >
                <LayoutDashboard className="w-4 h-4" />
              </button>
            </div>
            <Button
              size="sm"
              onClick={openNewTask}
              className="gap-1.5 transition-smooth hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              Nouvelle tâche
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-border bg-card/50">
        {view === 'list' && (
          <div className="flex bg-muted rounded-full p-0.5 gap-0.5 shrink-0">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium transition-smooth',
                  statusFilter === s.value ? 'bg-card shadow-kin text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {(['all', 'urgent', 'high', 'medium', 'low'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setPriorityFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-smooth shrink-0',
              priorityFilter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
            )}
          >
            {f === 'all' ? 'All tasks' : f}
          </button>
        ))}

        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium transition-smooth',
                  selectedTags.includes(tag)
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'
                )}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {hasActiveFilters && (
          <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground transition-smooth shrink-0">
            Clear filters
          </button>
        )}

        <div className="ml-auto relative shrink-0">
          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="h-8 pl-8 pr-6 text-xs bg-muted rounded-full border-none focus:outline-none focus:ring-2 focus:ring-ring transition-smooth appearance-none cursor-pointer"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
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
                  <p className="text-muted-foreground">
                    {hasActiveFilters ? 'No tasks match your filters' : 'No tasks yet'}
                  </p>
                  {hasActiveFilters ? (
                    <button onClick={clearFilters} className="mt-2 text-sm text-primary hover:underline">
                      Clear filters
                    </button>
                  ) : (
                    <button
                      onClick={openNewTask}
                      className="mt-2 text-sm text-primary hover:underline"
                    >
                      Create your first task
                    </button>
                  )}
                </div>
              ) : (
                filteredTasks.map((task, i) => {
                  const subtasks = subtasksByParent.get(task.id) || []
                  const doneSubtasks = subtasks.filter((s) => s.status === 'done').length
                  const isExpanded = expanded.has(task.id)
                  const overdue = task.due_date && task.status !== 'done' && isPast(new Date(task.due_date))

                  return (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: i * 0.03, duration: 0.2 }}
                      className={cn(
                        cardVariants({ padding: 'sm', hover: true }),
                        'group flex flex-col gap-0 border-l-4',
                        PRIORITY_CONFIG[task.priority]?.border,
                        task.status === 'done' && 'opacity-60'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Status toggle */}
                        <button
                          onClick={() => updateStatus(task.id, task.status === 'done' ? 'todo' : 'done')}
                          className={cn(
                            'mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-smooth hover:scale-110',
                            task.status === 'done'
                              ? 'bg-kin-sage border-kin-sage'
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
                          <div className="flex items-center gap-1.5">
                            {subtasks.length > 0 && (
                              <button
                                onClick={() => toggleExpanded(task.id)}
                                className="text-muted-foreground hover:text-foreground transition-smooth shrink-0"
                              >
                                <ChevronRight className={cn('w-3.5 h-3.5 transition-transform duration-200', isExpanded && 'rotate-90')} />
                              </button>
                            )}
                            <p className={cn('text-sm font-medium text-foreground truncate', task.status === 'done' && 'line-through')}>
                              {task.title}
                            </p>
                          </div>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {task.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <PriorityBadge priority={task.priority} />
                            {task.due_date && (
                              <span className={cn('flex items-center gap-1 text-xs', overdue ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                                <Calendar className="w-3 h-3" />
                                {format(new Date(task.due_date), 'MMM d')}
                                {overdue && ' · overdue'}
                              </span>
                            )}
                            <TagList tags={task.tags} />
                            <SubtaskProgress done={doneSubtasks} total={subtasks.length} />
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-smooth">
                          {task.status !== 'done' && (
                            <Link
                              href={`/focus?taskId=${task.id}&task=${encodeURIComponent(task.title)}`}
                              title={`▶ Commencer « ${task.title} »`}
                              className="p-1.5 rounded-lg text-kin-sage hover:bg-kin-sage/10 transition-smooth"
                            >
                              <Play className="w-4 h-4" />
                            </Link>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEditTask(task)}
                            className="hover:bg-primary/10 hover:text-primary"
                            title="Edit task"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {task.status !== 'in_progress' && task.status !== 'done' && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => updateStatus(task.id, 'in_progress')}
                              className="hover:bg-primary/10 hover:text-primary"
                              title="Mark in progress"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => deleteTask(task.id)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Subtasks panel */}
                      <AnimatePresence initial={false}>
                        {isExpanded && subtasks.length > 0 && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                            className="overflow-hidden"
                          >
                            <div className="pl-8 pt-2 space-y-1">
                              {subtasks.map((s) => (
                                <div key={s.id} className="flex items-center gap-2 group/sub">
                                  <button
                                    onClick={() => updateStatus(s.id, s.status === 'done' ? 'todo' : 'done')}
                                    className={cn(
                                      'w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-smooth',
                                      s.status === 'done' ? 'bg-kin-sage border-kin-sage' : 'border-border hover:border-primary'
                                    )}
                                  >
                                    {s.status === 'done' && (
                                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </button>
                                  <span className={cn('text-xs flex-1 truncate', s.status === 'done' ? 'text-muted-foreground line-through' : 'text-foreground')}>
                                    {s.title}
                                  </span>
                                  <button
                                    onClick={() => deleteTask(s.id)}
                                    className="opacity-0 group-hover/sub:opacity-100 text-muted-foreground hover:text-destructive transition-smooth"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Add subtask (always available, even before any exist) */}
                      <div className={cn('flex items-center gap-2', subtasks.length > 0 ? 'pl-8 mt-1' : 'pl-8 mt-2')}>
                        <ListChecks className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <input
                          value={subtaskDraft[task.id] || ''}
                          onChange={(e) => setSubtaskDraft((prev) => ({ ...prev, [task.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.nativeEvent.isComposing) addSubtask(task.id)
                          }}
                          placeholder="Add subtask..."
                          className="flex-1 text-xs bg-transparent border-none focus:outline-none placeholder:text-muted-foreground py-1"
                        />
                      </div>
                    </motion.div>
                  )
                })
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
              // Horizontal scroll on small screens: three 240px-min columns
              // would otherwise overflow the viewport on phones.
              className="flex gap-4 min-h-full overflow-x-auto pb-2"
            >
              {KANBAN_COLUMNS.map((col) => {
                const colTasks = filteredTasks.filter((t) => t.status === col.status)
                const isDragOver = dragOverCol === col.status
                return (
                  <div
                    key={col.status}
                    className="flex-1 min-w-[240px]"
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOverCol(col.status)
                    }}
                    onDragLeave={() => setDragOverCol((prev) => (prev === col.status ? null : prev))}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (dragTaskId) updateStatus(dragTaskId, col.status)
                      setDragTaskId(null)
                      setDragOverCol(null)
                    }}
                  >
                    <div className={cn('px-3 py-2 rounded-xl mb-3', col.color)}>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                        <span className="text-xs bg-background rounded-full px-2 py-0.5 text-muted-foreground">
                          {colTasks.length}
                        </span>
                      </div>
                    </div>
                    <div
                      className={cn(
                        'space-y-2 min-h-[120px] rounded-2xl transition-smooth',
                        isDragOver && 'ring-2 ring-primary/40 ring-offset-2 ring-offset-background bg-primary/5'
                      )}
                    >
                      {colTasks.map((task, i) => {
                        const subtasks = subtasksByParent.get(task.id) || []
                        const doneSubtasks = subtasks.filter((s) => s.status === 'done').length
                        return (
                          <motion.div
                            key={task.id}
                            layout
                            draggable
                            onDragStart={() => setDragTaskId(task.id)}
                            onDragEnd={() => {
                              setDragTaskId(null)
                              setDragOverCol(null)
                            }}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: dragTaskId === task.id ? 0.4 : 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className={cn(
                              cardVariants({ padding: 'sm', hover: true }),
                              'shadow-kin cursor-grab active:cursor-grabbing border-l-4',
                              PRIORITY_CONFIG[task.priority]?.border
                            )}
                          >
                            <div className="flex items-start gap-1.5 mb-2">
                              <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
                              <p className="text-sm font-medium text-foreground flex-1">{task.title}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mb-2 pl-5">
                              <TagList tags={task.tags} max={2} />
                            </div>
                            <div className="flex items-center justify-between pl-5">
                              <div className="flex items-center gap-2">
                                <PriorityBadge priority={task.priority} />
                                <SubtaskProgress done={doneSubtasks} total={subtasks.length} />
                              </div>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => deleteTask(task.id)}
                                className="hover:bg-destructive/10 hover:text-destructive"
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                            {col.status !== 'done' && (
                              <div className="mt-2 ml-5 flex gap-1.5">
                                <button
                                  onClick={() =>
                                    updateStatus(
                                      task.id,
                                      col.status === 'todo' ? 'in_progress' : 'done'
                                    )
                                  }
                                  className="flex-1 text-xs text-center py-1 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground transition-smooth"
                                >
                                  Move to {col.status === 'todo' ? 'In Progress' : 'Done'}
                                </button>
                                <Link
                                  href={`/focus?taskId=${task.id}&task=${encodeURIComponent(task.title)}`}
                                  title={`▶ Commencer « ${task.title} »`}
                                  className="px-2.5 flex items-center justify-center rounded-lg bg-kin-sage/15 text-kin-sage hover:bg-kin-sage hover:text-white transition-smooth"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                </Link>
                              </div>
                            )}
                          </motion.div>
                        )
                      })}
                      <button
                        onClick={openNewTask}
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
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
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
                <h2 className="text-lg font-serif font-bold text-foreground">
                  {editingTask ? 'Edit Task' : 'New Task'}
                </h2>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowModal(false)}>
                  <X className="w-4 h-4" />
                </Button>
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
                      list="existing-tags"
                      className="flex-1 transition-smooth"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) addTag()
                      }}
                    />
                    <datalist id="existing-tags">
                      {allTags.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
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
                    {loading ? 'Saving...' : editingTask ? 'Save changes' : 'Create task'}
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
