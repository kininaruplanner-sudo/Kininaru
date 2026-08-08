'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { parseISO } from 'date-fns'
import { format } from '@/lib/date-fr'
import { BookOpen, Save, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const MOODS = [
  { value: 1, emoji: '😔', label: 'Triste' },
  { value: 2, emoji: '😕', label: 'Maussade' },
  { value: 3, emoji: '😐', label: 'Neutre' },
  { value: 4, emoji: '🙂', label: 'Bien' },
  { value: 5, emoji: '😄', label: 'Super' },
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
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  const currentEntry = entries.find((e) => e.entry_date === selectedDate)

  const [form, setForm] = useState({
    mood: currentEntry?.mood ?? 3,
    content: currentEntry?.content ?? '',
    gratitude: currentEntry?.gratitude ?? '',
    goals: currentEntry?.goals ?? '',
  })

  const loadEntry = (date: string) => {
    setSelectedDate(date)
    const entry = entries.find((e) => e.entry_date === date)
    setForm({
      mood: entry?.mood ?? 3,
      content: entry?.content ?? '',
      gratitude: entry?.gratitude ?? '',
      goals: entry?.goals ?? '',
    })
    setSaved(false)
  }

  const navigateDay = (direction: -1 | 1) => {
    const current = new Date(selectedDate)
    current.setDate(current.getDate() + direction)
    const newDate = current.toISOString().split('T')[0]
    loadEntry(newDate)
  }

  const saveEntry = async () => {
    setSaving(true)
    const payload = {
      user_id: userId,
      entry_date: selectedDate,
      mood: form.mood,
      content: form.content,
      gratitude: form.gratitude,
      goals: form.goals,
    }

    const { data } = await supabase
      .from('journal_entries')
      .upsert(payload, { onConflict: 'user_id,entry_date' })
      .select()
      .single()

    if (data) {
      setEntries((prev) => {
        const exists = prev.find((e) => e.entry_date === selectedDate)
        if (exists) return prev.map((e) => (e.entry_date === selectedDate ? data : e))
        return [data, ...prev]
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  const moodAvg = entries.length
    ? (entries.reduce((a, e) => a + (e.mood ?? 3), 0) / entries.length).toFixed(1)
    : '—'

  const isToday = selectedDate === new Date().toISOString().split('T')[0]
  const isFuture = selectedDate > new Date().toISOString().split('T')[0]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div>
          <h1 className="text-xl font-serif font-bold text-foreground">Journal</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {entries.length} entrées &middot; humeur moy. {moodAvg}/5
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] h-full">
          {/* Entry list sidebar */}
          <div className="border-r border-border bg-card/30 overflow-y-auto p-3 space-y-1 max-h-[calc(100vh-65px)] lg:max-h-full">
            <button
              onClick={() => loadEntry(new Date().toISOString().split('T')[0])}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl transition-smooth text-left',
                isToday ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              )}
            >
              <Plus className={cn('w-4 h-4 shrink-0', isToday ? 'text-primary-foreground' : 'text-primary')} />
              <div>
                <p className={cn('text-sm font-medium', isToday ? 'text-primary-foreground' : 'text-foreground')}>
                  Aujourd'hui
                </p>
                <p className={cn('text-xs', isToday ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                  {format(new Date(), 'MMMM d, yyyy')}
                </p>
              </div>
            </button>

            {entries.length === 0 && (
              <p className="text-xs text-muted-foreground text-center px-3 py-4">
                Vos entrées précédentes apparaîtront ici.
              </p>
            )}

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
                    {isToday ? "Aujourd'hui" : format(new Date(selectedDate + 'T12:00:00'), 'EEEE')}
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
                <p className="text-sm font-medium text-foreground mb-3">Comment vous sentez-vous ?</p>
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
                  Qu'avez-vous en tête ?
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Écrivez librement sur votre journée, vos pensées, vos ressentis..."
                  className="w-full h-36 px-0 py-1 text-sm text-foreground bg-transparent border-none resize-none focus:outline-none placeholder:text-muted-foreground leading-relaxed"
                />
              </Card>

              {/* Gratitude */}
              <Card padding="sm">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Pour quoi êtes-vous reconnaissant(e) ?
                </label>
                <textarea
                  value={form.gratitude}
                  onChange={(e) => setForm({ ...form, gratitude: e.target.value })}
                  placeholder="3 choses que vous appréciez aujourd'hui..."
                  className="w-full h-20 px-0 py-1 text-sm text-foreground bg-transparent border-none resize-none focus:outline-none placeholder:text-muted-foreground leading-relaxed"
                />
              </Card>

              {/* Goals */}
              <Card padding="sm">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Objectifs pour demain
                </label>
                <textarea
                  value={form.goals}
                  onChange={(e) => setForm({ ...form, goals: e.target.value })}
                  placeholder="Que voulez-vous accomplir demain ?"
                  className="w-full h-20 px-0 py-1 text-sm text-foreground bg-transparent border-none resize-none focus:outline-none placeholder:text-muted-foreground leading-relaxed"
                />
              </Card>

              <Button
                onClick={saveEntry}
                disabled={saving || isFuture}
                className={cn(
                  'gap-2 transition-smooth',
                  saved && 'bg-kin-sage hover:bg-kin-sage'
                )}
              >
                <Save className="w-4 h-4" />
                {saving ? 'Enregistrement...' : saved ? 'Enregistré !' : 'Enregistrer'}
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
