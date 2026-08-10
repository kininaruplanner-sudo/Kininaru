'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO, addDays } from 'date-fns'
import {
  BookOpen,
  Save,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Sparkles,
  Lightbulb,
  ListChecks,
  X,
  Loader2,
  Check,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Minus,
  Link2,
  Smile,
  Heading1,
  Heading2,
  Eye,
  PencilLine,
  Target,
  ClipboardList,
  MessageCircleQuestion,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  renderMarkdown,
  wrapSelection,
  insertAtCursor,
  blockAtCursor,
} from '@/lib/journal/markdown'

const MOODS = [
  { value: 1, emoji: '😔', label: 'Sad' },
  { value: 2, emoji: '😕', label: 'Down' },
  { value: 3, emoji: '😐', label: 'Neutral' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
]

const EMOJIS = ['😊', '🎯', '✨', '📚', '💪', '🌟', '🔥', '🧘', '☕', '🌿', '💡', '❤️', '🎉', '🌅', '😌', '🙏', '📝', '🏆']

type AiMode = 'summarize' | 'ideas' | 'actions' | 'reflect' | 'goal' | 'tasks' | 'plan'

const AI_ACTIONS: { mode: AiMode; icon: React.ElementType; label: string; hint: string }[] = [
  { mode: 'summarize', icon: Sparkles, label: 'Résumer', hint: 'Un résumé court et clair' },
  { mode: 'ideas', icon: Lightbulb, label: 'Trouver les idées principales', hint: 'Faire ressortir les thèmes' },
  { mode: 'reflect', icon: MessageCircleQuestion, label: 'M’aider à réfléchir', hint: 'Questions bienveillantes' },
  { mode: 'goal', icon: Target, label: 'Créer un objectif', hint: 'Un objectif + des étapes' },
  { mode: 'tasks', icon: ListChecks, label: 'Créer des tâches', hint: 'Une liste d’actions concrètes' },
  { mode: 'plan', icon: ClipboardList, label: 'Créer un plan', hint: 'Un plan simple et réalisable' },
]

interface Entry {
  id: string
  entry_date: string
  mood: number | null
  content: string | null
  gratitude: string | null
  goals: string | null
}

interface Props {
  entries: Entry[]
  userId: string
}

interface JournalProposal {
  title: string
  steps: string[]
}

export function JournalClient({ entries: initialEntries, userId }: Props) {
  const [entries, setEntries] = useState(initialEntries)
  // Local calendar-day key so "Today" is the user's local day in any timezone.
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  // Auto-save status: idle → saving → saved / error (debounced, see below).
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Rich editor: preview mode + formatting toolbar + AI menu + proposals.
  const [preview, setPreview] = useState(false)
  const [aiMenuOpen, setAiMenuOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [aiMode, setAiMode] = useState<AiMode | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  // Thought → action: structured proposal awaiting user confirmation.
  const [proposal, setProposal] = useState<JournalProposal | null>(null)
  const [selectedSteps, setSelectedSteps] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createDone, setCreateDone] = useState<{ parentId: string; title: string } | null>(null)

  const supabase = createClient()

  const currentEntry = entries.find((e) => e.entry_date === selectedDate)

  const [form, setForm] = useState({
    mood: currentEntry?.mood ?? 3,
    content: currentEntry?.content ?? '',
    gratitude: currentEntry?.gratitude ?? '',
    goals: currentEntry?.goals ?? '',
  })

  const hasText =
    form.content.trim() !== '' || form.gratitude.trim() !== '' || form.goals.trim() !== ''

  /** Single save path (manual button, auto-save and day switches all use it). */
  const persist = useCallback(
    async (
      date: string,
      values: { mood: number; content: string; gratitude: string; goals: string }
    ): Promise<boolean> => {
      setSaveState('saving')
      const payload = {
        user_id: userId,
        entry_date: date,
        mood: values.mood,
        content: values.content,
        gratitude: values.gratitude,
        goals: values.goals,
      }
      try {
        const { data, error } = await supabase
          .from('journal_entries')
          .upsert(payload, { onConflict: 'user_id,entry_date' })
          .select()
          .single()
        if (error) {
          setSaveState('error')
          return false
        }
        if (data) {
          setEntries((prev) => {
            const exists = prev.find((e) => e.entry_date === date)
            if (exists) return prev.map((e) => (e.entry_date === date ? data : e))
            return [data, ...prev]
          })
          setSaveState('saved')
          return true
        }
        setSaveState('error')
        return false
      } catch {
        setSaveState('error')
        return false
      }
    },
    [supabase, userId]
  )

  // Auto-save: debounced — nothing is lost if the user leaves the page right
  // after typing. Only runs when there is actual text (no junk rows).
  useEffect(() => {
    if (!hasText) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      void persist(selectedDate, form)
    }, 1500)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.content, form.gratitude, form.goals, form.mood])

  // Flush any pending auto-save when the tab is hidden/closed (best effort —
  // never lose silent content).
  useEffect(() => {
    const flush = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      if (hasText && saveState !== 'saving') void persist(selectedDate, form)
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasText, form, selectedDate, saveState])

  const loadEntry = (date: string) => {
    // Flush any pending auto-save for the CURRENT day before switching.
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (hasText) void persist(selectedDate, form)
    setSelectedDate(date)
    const entry = entries.find((e) => e.entry_date === date)
    setForm({
      mood: entry?.mood ?? 3,
      content: entry?.content ?? '',
      gratitude: entry?.gratitude ?? '',
      goals: entry?.goals ?? '',
    })
    setSaved(false)
    setAiMode(null)
    setAiResult(null)
    setAiError(null)
    setProposal(null)
    setCreateDone(null)
    setCreateError(null)
    setPreview(false)
  }

  const navigateDay = (direction: -1 | 1) => {
    // Anchor at noon to avoid timezone drift when shifting by whole days.
    const current = new Date(selectedDate + 'T12:00:00')
    const newDate = format(addDays(current, direction), 'yyyy-MM-dd')
    loadEntry(newDate)
  }

  const deleteEntry = async () => {
    if (!currentEntry) return
    if (!window.confirm('Supprimer cette entrée de journal ?')) return
    await supabase.from('journal_entries').delete().eq('id', currentEntry.id)
    setEntries((prev) => prev.filter((e) => e.id !== currentEntry.id))
    setForm({ mood: 3, content: '', gratitude: '', goals: '' })
  }

  const saveEntry = async () => {
    setSaving(true)
    await persist(selectedDate, form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  /* ---------------------------------------------------------------- */
  /* Editor toolbar                                                    */
  /* ---------------------------------------------------------------- */

  // Toolbar handlers read the editor through its DOM id inside click handlers
  // only — never during render (keeps the react-hooks rules happy).
  const getEditor = () =>
    document.getElementById('journal-editor') as HTMLTextAreaElement | null
  const ta = () => getEditor()

  const tools: { label: string; icon: React.ElementType; onPress: () => void }[] = [
    {
      label: 'Titre',
      icon: Heading1,
      onPress: () => {
        const el = ta()
        if (el) blockAtCursor(el, '# ')
      },
    },
    {
      label: 'Sous-titre',
      icon: Heading2,
      onPress: () => {
        const el = ta()
        if (el) blockAtCursor(el, '## ')
      },
    },
    {
      label: 'Gras',
      icon: Bold,
      onPress: () => {
        const el = ta()
        if (el) wrapSelection(el, '**', '**', 'texte en gras')
      },
    },
    {
      label: 'Italique',
      icon: Italic,
      onPress: () => {
        const el = ta()
        if (el) wrapSelection(el, '*', '*', 'italique')
      },
    },
    {
      label: 'Souligné',
      icon: Underline,
      onPress: () => {
        const el = ta()
        if (el) wrapSelection(el, '__', '__', 'souligné')
      },
    },
    {
      label: 'Liste à puces',
      icon: List,
      onPress: () => {
        const el = ta()
        if (el) blockAtCursor(el, '- ')
      },
    },
    {
      label: 'Liste numérotée',
      icon: ListOrdered,
      onPress: () => {
        const el = ta()
        if (el) blockAtCursor(el, '1. ')
      },
    },
    {
      label: 'Checklist',
      icon: ListChecks,
      onPress: () => {
        const el = ta()
        if (el) blockAtCursor(el, '- [ ] ')
      },
    },
    {
      label: 'Citation',
      icon: Quote,
      onPress: () => {
        const el = ta()
        if (el) blockAtCursor(el, '> ')
      },
    },
    {
      label: 'Séparateur',
      icon: Minus,
      onPress: () => {
        const el = ta()
        if (el) insertAtCursor(el, '\n---\n')
      },
    },
    {
      label: 'Lien',
      icon: Link2,
      onPress: () => {
        const el = ta()
        if (!el) return
        const url = window.prompt('URL du lien (https://… ou /page)')
        if (url && url.trim()) wrapSelection(el, '[', `](${url.trim()})`, 'texte du lien')
      },
    },
  ]

  const toggleCheck = useCallback(
    (lineIndex: number) => {
      setForm((prev) => {
        const lines = prev.content.split('\n')
        const line = lines[lineIndex]
        if (!line) return prev
        const match = line.match(/^(\s*[-*]\s+)\[([ xX])\](.*)$/)
        if (!match) return prev
        lines[lineIndex] = `${match[1]}[${match[2].toLowerCase() === 'x' ? ' ' : 'x'}${match[3]}`
        return { ...prev, content: lines.join('\n') }
      })
    },
    []
  )

  /* ---------------------------------------------------------------- */
  /* Journal AI — 6 actions, structured proposals for goal/tasks/plan  */
  /* ---------------------------------------------------------------- */

  const runAi = async (mode: AiMode) => {
    const text = form.content.trim()
    if (!text || aiBusy) return
    setAiMenuOpen(false)
    setAiMode(mode)
    setAiBusy(true)
    setAiError(null)
    setAiResult(null)
    setProposal(null)
    setCreateDone(null)
    setCreateError(null)
    try {
      const res = await fetch('/api/ai/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mode }),
      })
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string }
        setAiError(d.error ?? "L'assistant est temporairement indisponible. Réessaie dans un instant.")
        return
      }
      const d = (await res.json()) as { text: string; structured?: JournalProposal | null }
      if (d.structured) {
        setProposal(d.structured)
        setSelectedSteps(d.structured.steps)
      } else {
        setAiResult(d.text)
      }
    } catch {
      setAiError("L'assistant est temporairement indisponible. Réessaie dans un instant.")
    } finally {
      setAiBusy(false)
    }
  }

  const closeAiPanel = () => {
    setAiMode(null)
    setAiResult(null)
    setAiError(null)
    setProposal(null)
    setCreateDone(null)
    setCreateError(null)
  }

  const toggleStep = (step: string) => {
    setSelectedSteps((prev) =>
      prev.includes(step) ? prev.filter((s) => s !== step) : [...prev, step]
    )
  }

  /** Creates the objective + ONLY the user-confirmed steps (never silently). */
  const createObjective = async () => {
    if (!proposal || selectedSteps.length === 0 || creating) return
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/ai/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actions: [
            {
              action: 'create_objective',
              data: { parent_title: proposal.title, steps: selectedSteps },
            },
          ],
        }),
      })
      const d = (await res.json().catch(() => ({}))) as { error?: string; results?: { ok: boolean; id?: string; message?: string }[] }
      if (!res.ok || !d.results || !d.results[0]?.ok) {
        setCreateError(d.error ?? d.results?.[0]?.message ?? 'Impossible de créer l’objectif.')
        return
      }
      setCreateDone({ parentId: d.results[0].id ?? '', title: proposal.title })
    } catch {
      setCreateError('Impossible de créer l’objectif. Réessaie dans un instant.')
    } finally {
      setCreating(false)
    }
  }

  const moodAvg = entries.length
    ? (entries.reduce((a, e) => a + (e.mood ?? 3), 0) / entries.length).toFixed(1)
    : '—'

  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const isToday = selectedDate === todayKey
  const isFuture = selectedDate > todayKey

  const aiModeLabel = AI_ACTIONS.find((a) => a.mode === aiMode)?.label

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <PageHeader
        icon={BookOpen}
        title="Journal"
        subtitle={`${entries.length} entrées · humeur moyenne ${moodAvg}/5`}
      />

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] h-full">
          {/* Entry list sidebar */}
          <div className="border-r border-border bg-card/30 overflow-y-auto p-3 space-y-1 max-h-[calc(100vh-65px)] lg:max-h-full">
            <button
              onClick={() => loadEntry(todayKey)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl transition-smooth text-left',
                isToday ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              )}
            >
              <Plus className={cn('w-4 h-4 shrink-0', isToday ? 'text-primary-foreground' : 'text-primary')} />
              <div>
                <p className={cn('text-sm font-medium', isToday ? 'text-primary-foreground' : 'text-foreground')}>
                  Today
                </p>
                <p className={cn('text-xs', isToday ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                  {format(new Date(), 'MMMM d, yyyy')}
                </p>
              </div>
            </button>

            {entries.map((entry) => {
              const mood = MOODS.find((m) => m.value === entry.mood)
              const isSelected = entry.entry_date === selectedDate
              return (
                <button
                  key={entry.id}
                  onClick={() => loadEntry(entry.entry_date)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-xl transition-smooth text-left',
                    isSelected ? 'bg-muted' : 'hover:bg-muted/50'
                  )}
                >
                  <span className="text-xl">{mood?.emoji ?? '😐'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {format(parseISO(entry.entry_date), 'MMM d, yyyy')}
                    </p>
                    {entry.content && (
                      <p className="text-xs text-muted-foreground truncate">{entry.content}</p>
                    )}
                  </div>
                </button>
              )
            })}
            {entries.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Aucune entrée pour ce jour — écrivez votre première pensée dans l&apos;éditeur.
              </p>
            )}
          </div>

          {/* Editor */}
          <div className="p-6 overflow-y-auto">
            <motion.div
              key={selectedDate}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="max-w-2xl space-y-6"
            >
              {/* Date navigation */}
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => navigateDay(-1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="text-center">
                  <h2 className="text-lg font-serif font-bold text-foreground">
                    {isToday ? 'Today' : format(new Date(selectedDate + 'T12:00:00'), 'EEEE')}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedDate + 'T12:00:00'), 'MMMM d, yyyy')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => navigateDay(1)}
                  disabled={isToday}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Mood selector */}
              <Card padding="sm">
                <p className="text-sm font-medium text-foreground mb-3">How are you feeling?</p>
                <div className="flex gap-3 justify-center">
                  {MOODS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setForm({ ...form, mood: m.value })}
                      className={cn(
                        'flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-200',
                        form.mood === m.value
                          ? 'bg-primary/10 ring-2 ring-primary scale-110'
                          : 'hover:bg-muted hover:scale-105'
                      )}
                    >
                      <span className="text-2xl">{m.emoji}</span>
                      <span className="text-xs text-muted-foreground">{m.label}</span>
                    </button>
                  ))}
                </div>
              </Card>

              {/* Rich journal content */}
              <Card padding="sm">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="text-sm font-medium text-foreground">
                    <BookOpen className="w-4 h-4 inline mr-1.5 text-primary" />
                    What&apos;s on your mind?
                  </label>
                  <button
                    type="button"
                    onClick={() => setPreview((p) => !p)}
                    className={cn(
                      'flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5 transition-smooth',
                      preview
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                  >
                    {preview ? <PencilLine className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {preview ? 'Éditer' : 'Aperçu'}
                  </button>
                </div>

                {/* Formatting toolbar */}
                {!preview && (
                  <div className="flex flex-wrap items-center gap-0.5 pb-2 mb-2 border-b border-border">
                    {tools.map((tool) => (
                      <button
                        key={tool.label}
                        type="button"
                        title={tool.label}
                        aria-label={tool.label}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => tool.onPress()}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth"
                      >
                        <tool.icon className="w-4 h-4" />
                      </button>
                    ))}
                    {/* Emoji picker */}
                    <div className="relative">
                      <button
                        type="button"
                        title="Émojis"
                        aria-label="Émojis"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setEmojiOpen((v) => !v)}
                        className={cn(
                          'w-8 h-8 flex items-center justify-center rounded-lg transition-smooth',
                          emojiOpen ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                      >
                        <Smile className="w-4 h-4" />
                      </button>
                      <AnimatePresence>
                        {emojiOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 6, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 6, scale: 0.96 }}
                            transition={{ duration: 0.15 }}
                            className="absolute left-0 top-9 z-30 w-56 rounded-2xl border border-border bg-card shadow-kin-hover p-2 grid grid-cols-8 gap-0.5"
                          >
                            {EMOJIS.map((e) => (
                              <button
                                key={e}
                                type="button"
                                onClick={() => {
                                  const el = ta()
                                  if (el) insertAtCursor(el, `${e} `)
                                  setEmojiOpen(false)
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-muted transition-smooth text-base"
                              >
                                {e}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {/* Editor / preview */}
                {preview ? (
                  <div className="min-h-36 py-1 text-sm leading-relaxed">
                    {renderMarkdown(form.content, { onToggleCheck: toggleCheck })}
                  </div>
                ) : (
                  <textarea
                    id="journal-editor"
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    onKeyDown={(e) => {
                      // Tab in editor = insert a small indentation (keeps mobile
                      // keyboards happy too — no focus change).
                      if (e.key === 'Tab') {
                        e.preventDefault()
                        insertAtCursor(e.currentTarget, '  ')
                      }
                    }}
                    placeholder={
                      'Écrivez librement…\n\n# Un titre\n## Un sous-titre\n- [ ] une idée à faire\n- une note\n> une citation\n\n**gras**, *italique*, __souligné__, [lien](https://…)'
                    }
                    className="w-full min-h-36 px-0 py-1 text-sm text-foreground bg-transparent border-none resize-y focus:outline-none placeholder:text-muted-foreground/70 leading-relaxed"
                  />
                )}

                {/* Journal AI (§15.5 §3-5) — one entrypoint, 6 actions */}
                <div className="flex flex-wrap items-center gap-2 pt-3 mt-1 border-t border-border">
                  <div className="relative">
                    <Button
                      size="xs"
                      disabled={aiBusy || !form.content.trim()}
                      onClick={() => setAiMenuOpen((v) => !v)}
                      className="gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      ✨ Demander à Kininaru
                    </Button>
                    <AnimatePresence>
                      {aiMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-20" onClick={() => setAiMenuOpen(false)} />
                          <motion.div
                            initial={{ opacity: 0, y: 6, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 6, scale: 0.97 }}
                            transition={{ duration: 0.15 }}
                            className="absolute left-0 top-full mt-1 z-30 w-72 rounded-2xl border border-border bg-card shadow-kin-hover p-1.5"
                          >
                            {AI_ACTIONS.map((a) => (
                              <button
                                key={a.mode}
                                type="button"
                                onClick={() => void runAi(a.mode)}
                                className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-xl hover:bg-muted transition-smooth text-left"
                              >
                                <span className="w-7 h-7 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center mt-0.5">
                                  <a.icon className="w-3.5 h-3.5" />
                                </span>
                                <span>
                                  <span className="block text-[13px] font-medium text-foreground">{a.label}</span>
                                  <span className="block text-[11px] text-muted-foreground">{a.hint}</span>
                                </span>
                              </button>
                            ))}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium ml-auto">
                    IA · une seule entrée envoyée
                  </span>
                </div>

                <AnimatePresence>
                  {(aiMode || proposal) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-xs font-semibold text-foreground">
                            {aiModeLabel ?? 'Proposition'}
                          </p>
                          <button
                            type="button"
                            onClick={closeAiPanel}
                            disabled={creating}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-smooth disabled:opacity-50"
                            aria-label="Fermer le panneau IA"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {aiBusy ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin motion-reduce:hidden" />
                            Kininaru réfléchit…
                          </div>
                        ) : aiError ? (
                          <p className="text-sm text-destructive leading-relaxed">{aiError}</p>
                        ) : createDone ? (
                          /* Success — objective + tasks created */
                          <div>
                            <div className="flex items-start gap-2.5">
                              <CheckCircle2 className="w-4 h-4 text-kin-sage shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  Objectif créé : {createDone.title}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {selectedSteps.length} tâche{selectedSteps.length > 1 ? 's' : ''} ajoutée
                                  {selectedSteps.length > 1 ? 's' : ''} — prête{selectedSteps.length > 1 ? 's' : ''} à être
                                  terminée{selectedSteps.length > 1 ? 's' : ''}.
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3">
                              <a href={`/tasks`}>
                                <Button size="xs" variant="outline" className="gap-1.5">
                                  Voir mes tâches
                                  <ArrowRight className="w-3 h-3" />
                                </Button>
                              </a>
                              {createDone.parentId && (
                                <a
                                  href={`/focus?taskId=${createDone.parentId}&task=${encodeURIComponent(
                                    createDone.title
                                  )}`}
                                >
                                  <Button size="xs" className="gap-1.5">
                                    <Target className="w-3 h-3" />
                                    Commencer maintenant
                                  </Button>
                                </a>
                              )}
                            </div>
                          </div>
                        ) : proposal ? (
                          /* Thought → action: confirmation before anything is created */
                          <div>
                            <p className="text-[13px] font-medium text-foreground">
                              💡 J’ai trouvé une idée exploitable.
                            </p>
                            <p className="text-sm text-foreground mt-1.5">
                              Objectif : <span className="font-semibold">{proposal.title}</span>
                            </p>
                            <div className="mt-2.5 space-y-1.5">
                              {proposal.steps.map((step) => {
                                const checked = selectedSteps.includes(step)
                                return (
                                  <button
                                    key={step}
                                    type="button"
                                    onClick={() => toggleStep(step)}
                                    className="w-full flex items-start gap-2.5 text-left"
                                  >
                                    <span
                                      className={cn(
                                        'mt-0.5 w-[18px] h-[18px] shrink-0 rounded-[6px] border-2 flex items-center justify-center transition-smooth',
                                        checked
                                          ? 'bg-primary border-primary'
                                          : 'border-border hover:border-primary'
                                      )}
                                    >
                                      {checked && (
                                        <Check className="w-3 h-3 text-primary-foreground" />
                                      )}
                                    </span>
                                    <span
                                      className={cn(
                                        'text-sm leading-snug',
                                        checked ? 'text-foreground' : 'text-muted-foreground'
                                      )}
                                    >
                                      {step}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                            {createError && (
                              <p className="text-xs text-destructive mt-2">{createError}</p>
                            )}
                            <div className="flex flex-wrap gap-2 mt-3">
                              <Button
                                size="xs"
                                disabled={selectedSteps.length === 0 || creating}
                                onClick={() => void createObjective()}
                                className="gap-1.5"
                              >
                                {creating ? (
                                  <Loader2 className="w-3 h-3 animate-spin motion-reduce:hidden" />
                                ) : (
                                  <Target className="w-3 h-3" />
                                )}
                                Créer l’objectif
                              </Button>
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => {
                                  setProposal(null)
                                  setAiMode(null)
                                }}
                              >
                                Annuler
                              </Button>
                              <span className="text-[10px] text-muted-foreground/80 self-center ml-auto">
                                Seules les tâches cochées seront créées.
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                            {aiResult}
                          </p>
                        )}
                        {!proposal && !createDone && (
                          <p className="text-[10px] text-muted-foreground/80 mt-2 leading-snug">
                            Seule cette entrée est envoyée à l’IA — rien d’autre de votre compte.
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>

              {/* Gratitude */}
              <Card padding="sm">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  What are you grateful for?
                </label>
                <textarea
                  value={form.gratitude}
                  onChange={(e) => setForm({ ...form, gratitude: e.target.value })}
                  placeholder="3 things you appreciate today..."
                  className="w-full h-20 px-0 py-1 text-sm text-foreground bg-transparent border-none resize-none focus:outline-none placeholder:text-muted-foreground leading-relaxed"
                />
              </Card>

              {/* Goals */}
              <Card padding="sm">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Goals for tomorrow
                </label>
                <textarea
                  value={form.goals}
                  onChange={(e) => setForm({ ...form, goals: e.target.value })}
                  placeholder="What will you accomplish tomorrow?"
                  className="w-full h-20 px-0 py-1 text-sm text-foreground bg-transparent border-none resize-none focus:outline-none placeholder:text-muted-foreground leading-relaxed"
                />
              </Card>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={saveEntry}
                  disabled={saving || isFuture}
                  className={cn(
                    'gap-2 transition-smooth',
                    saved && 'bg-kin-sage hover:bg-kin-sage'
                  )}
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Entry'}
                </Button>
                {currentEntry && (
                  <Button
                    variant="outline"
                    onClick={deleteEntry}
                    className="gap-2 text-destructive hover:bg-destructive/10 transition-smooth"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                )}
                {/* Auto-save status: Sauvegarde… / ✓ Sauvegardé / ⚠ + Réessayer */}
                {saveState === 'saving' && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin motion-reduce:hidden" />
                    Sauvegarde…
                  </span>
                )}
                {saveState === 'saved' && (
                  <span className="flex items-center gap-1.5 text-xs text-kin-sage">
                    <Check className="w-3 h-3" />
                    ✓ Sauvegardé
                  </span>
                )}
                {saveState === 'error' && (
                  <span className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="w-3 h-3" />
                    ⚠ Impossible de sauvegarder
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => void persist(selectedDate, form)}
                      className="text-destructive underline underline-offset-2 hover:bg-destructive/10"
                    >
                      Réessayer
                    </Button>
                  </span>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
