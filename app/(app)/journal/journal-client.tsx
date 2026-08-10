'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO, addDays } from 'date-fns'
import { BookOpen, Save, ChevronLeft, ChevronRight, Plus, Trash2, Sparkles, Lightbulb, ListChecks, X, Loader2, Check } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const MOODS = [
  { value: 1, emoji: '😔', label: 'Sad' },
  { value: 2, emoji: '😕', label: 'Down' },
  { value: 3, emoji: '😐', label: 'Neutral' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
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

export function JournalClient({ entries: initialEntries, userId }: Props) {
  const [entries, setEntries] = useState(initialEntries)
  // Local calendar-day key so "Today" is the user's local day in any timezone.
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  // Auto-save status: 'idle' → 'saving' → 'saved' (debounced, see below).
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Journal AI actions (ÉTAPE 14 §27): summarize / ideas / action plan.
  const [aiMode, setAiMode] = useState<'summarize' | 'ideas' | 'actions' | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
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
  const persist = async (
    date: string,
    values: { mood: number; content: string; gratitude: string; goals: string }
  ) => {
    setSaveState('saving')
    const payload = {
      user_id: userId,
      entry_date: date,
      mood: values.mood,
      content: values.content,
      gratitude: values.gratitude,
      goals: values.goals,
    }
    const { data } = await supabase
      .from('journal_entries')
      .upsert(payload, { onConflict: 'user_id,entry_date' })
      .select()
      .single()
    if (data) {
      setEntries((prev) => {
        const exists = prev.find((e) => e.entry_date === date)
        if (exists) return prev.map((e) => (e.entry_date === date ? data : e))
        return [data, ...prev]
      })
      setSaveState('saved')
    } else {
      setSaveState('idle')
    }
  }

  // Auto-save (§26): debounced — nothing is lost if the user leaves the page
  // right after typing. Only runs when there is actual text (no junk rows).
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

  const runAi = async (mode: 'summarize' | 'ideas' | 'actions') => {
    const text = form.content.trim()
    if (!text || aiBusy) return
    setAiMode(mode)
    setAiBusy(true)
    setAiError(null)
    setAiResult(null)
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
      const d = (await res.json()) as { text: string }
      setAiResult(d.text)
    } catch {
      setAiError("L'assistant est temporairement indisponible. Réessaie dans un instant.")
    } finally {
      setAiBusy(false)
    }
  }

  const moodAvg = entries.length
    ? (entries.reduce((a, e) => a + (e.mood ?? 3), 0) / entries.length).toFixed(1)
    : '—'

  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const isToday = selectedDate === todayKey
  const isFuture = selectedDate > todayKey

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

              {/* Journal content */}
              <Card padding="sm">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  <BookOpen className="w-4 h-4 inline mr-1.5 text-primary" />
                  What&apos;s on your mind?
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Write freely about your day, thoughts, feelings..."
                  className="w-full h-36 px-0 py-1 text-sm text-foreground bg-transparent border-none resize-none focus:outline-none placeholder:text-muted-foreground leading-relaxed"
                />

                {/* Journal AI actions (§27) — advice-only, triggered by the user */}
                <div className="flex flex-wrap items-center gap-2 pt-3 mt-1 border-t border-border">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    AI tools
                  </span>
                  {[
                    { mode: 'summarize' as const, icon: Sparkles, label: 'Summarize' },
                    { mode: 'ideas' as const, icon: Lightbulb, label: 'Key ideas' },
                    { mode: 'actions' as const, icon: ListChecks, label: 'Action plan' },
                  ].map((a) => (
                    <Button
                      key={a.mode}
                      variant="outline"
                      size="xs"
                      disabled={aiBusy || !form.content.trim()}
                      onClick={() => void runAi(a.mode)}
                      className="gap-1"
                    >
                      <a.icon className="w-3 h-3" />
                      {a.label}
                    </Button>
                  ))}
                </div>

                <AnimatePresence>
                  {aiMode && (
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
                            {aiMode === 'summarize'
                              ? 'Summary'
                              : aiMode === 'ideas'
                                ? 'Key ideas'
                                : 'Action plan'}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setAiMode(null)
                              setAiResult(null)
                              setAiError(null)
                            }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-smooth"
                            aria-label="Close AI result"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {aiBusy ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin motion-reduce:hidden" />
                            Analyzing this entry…
                          </div>
                        ) : aiError ? (
                          <p className="text-sm text-destructive leading-relaxed">{aiError}</p>
                        ) : (
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                            {aiResult}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground/80 mt-2 leading-snug">
                          Only this entry is sent to the AI — nothing else from your account.
                        </p>
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

              <div className="flex items-center gap-3">
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
                {/* Auto-save status (§26) */}
                {saveState === 'saving' && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin motion-reduce:hidden" />
                    Saving…
                  </span>
                )}
                {saveState === 'saved' && (
                  <span className="flex items-center gap-1.5 text-xs text-kin-sage">
                    <Check className="w-3 h-3" />
                    Saved
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
