'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { isToday, isTomorrow, isPast } from 'date-fns'
import { format } from '@/lib/date-fr'
import { fr } from 'date-fns/locale'
import { CalendarDays, Plus, Trash2, X, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { cardVariants } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PALETTE_VALUES } from '@/lib/palette'
import type { FamilyEvent } from './types'

interface Props {
  events: FamilyEvent[]
  familyId: string
  userId: string
  isParent: boolean
}

function dayLabel(dateStr: string) {
  const d = new Date(dateStr)
  if (isToday(d)) return "Aujourd'hui"
  if (isTomorrow(d)) return 'Demain'
  return format(d, 'EEEE d MMMM', { locale: fr })
}

const emptyForm = { title: '', description: '', location: '', date: '', start: '', end: '' }

export function FamilyCalendarTab({ events: initial, familyId, userId, isParent }: Props) {
  const [events, setEvents] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const upcoming = events.filter((e) => !isPast(new Date(e.end_at)))
  const past = events.filter((e) => isPast(new Date(e.end_at)))

  const resetForm = () => {
    setForm(emptyForm)
    setShowForm(false)
    setError('')
  }

  const addEvent = async () => {
    if (!form.title.trim() || !form.date || !form.start || !form.end) {
      setError('Le titre, la date et les horaires sont requis.')
      return
    }
    const startAt = new Date(`${form.date}T${form.start}`)
    const endAt = new Date(`${form.date}T${form.end}`)
    if (endAt <= startAt) {
      setError("L'heure de fin doit être après l'heure de début.")
      return
    }

    setLoading(true)
    setError('')

    const { data, error: insertError } = await supabase
      .from('family_events')
      .insert({
        family_id: familyId,
        created_by: userId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        location: form.location.trim() || null,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        color: PALETTE_VALUES[Math.floor(Math.random() * PALETTE_VALUES.length)] ?? '#BFDFFF',
      })
      .select()
      .single()

    setLoading(false)

    if (insertError || !data) {
      setError(insertError?.message || "Impossible de créer l'événement.")
      return
    }

    setEvents((prev) => [...prev, data].sort((a, b) => a.start_at.localeCompare(b.start_at)))
    resetForm()
    router.refresh()
  }

  const deleteEvent = async (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id))
    const { error: deleteError } = await supabase.from('family_events').delete().eq('id', id)
    if (deleteError) {
      setError("Impossible de supprimer l'événement.")
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {upcoming.length} événement{upcoming.length !== 1 ? 's' : ''} à venir
        </p>
        <Button size="sm" onClick={() => setShowForm((v) => !v)} className="gap-1.5">
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? 'Annuler' : 'Nouvel événement'}
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
                placeholder="Titre de l'événement"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                autoFocus
              />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Date</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Début</Label>
                  <Input
                    type="time"
                    value={form.start}
                    onChange={(e) => setForm({ ...form, start: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Fin</Label>
                  <Input
                    type="time"
                    value={form.end}
                    onChange={(e) => setForm({ ...form, end: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
              <Input
                placeholder="Lieu (optionnel)"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
              {error && (
                <div className="bg-destructive/10 text-destructive text-xs p-2.5 rounded-lg border border-destructive/20">
                  {error}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={resetForm}>
                  Annuler
                </Button>
                <Button size="sm" className="flex-1" onClick={addEvent} disabled={loading}>
                  {loading ? 'Création...' : 'Ajouter'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {events.length === 0 && !showForm ? (
        <div className="text-center py-12">
          <CalendarDays className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Aucun événement partagé pour le moment.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Ajoutez le premier rendez-vous ou événement familial.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {upcoming.map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.03 }}
              className={cn(cardVariants({ padding: 'sm' }), 'flex items-center gap-3')}
            >
              <span
                className="w-1 self-stretch rounded-full shrink-0"
                style={{ backgroundColor: event.color }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {dayLabel(event.start_at)} · {format(new Date(event.start_at), 'HH:mm')}–
                  {format(new Date(event.end_at), 'HH:mm')}
                  {event.location && (
                    <span className="inline-flex items-center gap-0.5 ml-1.5">
                      <MapPin className="size-2.5" />
                      {event.location}
                    </span>
                  )}
                </p>
              </div>
              {(isParent || event.created_by === userId) && (
                <button
                  onClick={() => deleteEvent(event.id)}
                  className="text-muted-foreground hover:text-destructive transition-smooth shrink-0"
                  aria-label="Supprimer l'événement"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </motion.div>
          ))}

          {past.length > 0 && (
            <details className="pt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-smooth">
                {past.length} événement{past.length !== 1 ? 's' : ''} passé{past.length !== 1 ? 's' : ''}
              </summary>
              <div className="space-y-2 mt-2">
                {past.map((event) => (
                  <div
                    key={event.id}
                    className={cn(cardVariants({ padding: 'sm' }), 'flex items-center gap-3 opacity-60')}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground">{dayLabel(event.start_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
