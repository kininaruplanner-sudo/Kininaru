'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
  parseISO,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, X, Calendar, Clock, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const EVENT_COLORS = [
  '#CDE9D2', '#FFC8B8', '#B9A7FF', '#FFF1B6', '#BFDFFF', '#CDE9D2', '#FFC8B8',
]

type ViewMode = 'month' | 'week' | 'day'

interface CalendarEvent {
  id: string
  title: string
  start_at: string
  end_at: string
  color: string
  category: string
  description?: string
  location?: string
}

interface Props {
  events: CalendarEvent[]
  userId: string
}

export function CalendarClient({ events: initialEvents, userId }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<ViewMode>('month')
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const [form, setForm] = useState({
    title: '',
    start_at: '',
    end_at: '',
    color: EVENT_COLORS[0],
    category: 'default',
    description: '',
    location: '',
  })

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd })

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(currentDate, { weekStartsOn: 1 }) })

  const eventsForDay = (day: Date) =>
    events.filter((e) => isSameDay(parseISO(e.start_at), day))

  const openNewEvent = (day?: Date) => {
    const d = day ?? new Date()
    const dateStr = format(d, "yyyy-MM-dd'T'HH:mm")
    const endStr = format(new Date(d.getTime() + 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm")
    setForm({
      title: '',
      start_at: dateStr,
      end_at: endStr,
      color: EVENT_COLORS[0],
      category: 'default',
      description: '',
      location: '',
    })
    setShowModal(true)
  }

  const saveEvent = async () => {
    if (!form.title.trim()) return
    setLoading(true)
    const { data, error } = await supabase
      .from('events')
      .insert({
        user_id: userId,
        title: form.title,
        start_at: new Date(form.start_at).toISOString(),
        end_at: new Date(form.end_at).toISOString(),
        color: form.color,
        category: form.category,
        description: form.description,
        location: form.location,
      })
      .select()
      .single()

    if (data) {
      setEvents((prev) => [...prev, data])
      setShowModal(false)
    }
    setLoading(false)
  }

  const deleteEvent = async (id: string) => {
    await supabase.from('events').delete().eq('id', id)
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }

  const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-serif font-bold text-foreground">Calendar</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (view === 'month') setCurrentDate(subMonths(currentDate, 1))
                else setCurrentDate(new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000))
              }}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-smooth"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1 text-sm font-medium rounded-lg hover:bg-muted text-foreground transition-smooth"
            >
              {view === 'month'
                ? format(currentDate, 'MMMM yyyy')
                : `${format(weekStart, 'MMM d')} – ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`}
            </button>
            <button
              onClick={() => {
                if (view === 'month') setCurrentDate(addMonths(currentDate, 1))
                else setCurrentDate(new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000))
              }}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-smooth"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-xl p-1 gap-1">
            {(['month', 'week', 'day'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-lg capitalize transition-smooth',
                  view === v
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <Button
            onClick={() => openNewEvent()}
            size="sm"
            className="gap-1.5 transition-smooth hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            New event
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <AnimatePresence mode="wait">
          {view === 'month' && (
            <motion.div
              key="month"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Header */}
              <div className="grid grid-cols-7 mb-2">
                {DAYS_OF_WEEK.map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                    {d}
                  </div>
                ))}
              </div>
              {/* Days grid */}
              <div className="grid grid-cols-7 border-l border-t border-border rounded-xl overflow-hidden">
                {calDays.map((day) => {
                  const dayEvents = eventsForDay(day)
                  const isCurrentMonth = isSameMonth(day, currentDate)
                  const isSelected = selectedDay && isSameDay(day, selectedDay)
                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => {
                        setSelectedDay(day)
                        openNewEvent(day)
                      }}
                      className={cn(
                        'min-h-[100px] border-r border-b border-border p-1.5 cursor-pointer transition-smooth group',
                        !isCurrentMonth && 'bg-muted/20',
                        isSelected && 'bg-primary/5',
                        isCurrentMonth && 'hover:bg-muted/30'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={cn(
                            'text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-smooth',
                            isToday(day)
                              ? 'bg-primary text-primary-foreground font-bold'
                              : !isCurrentMonth
                              ? 'text-muted-foreground/40'
                              : 'text-foreground group-hover:bg-muted'
                          )}
                        >
                          {format(day, 'd')}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div
                            key={event.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteEvent(event.id)
                            }}
                            className="text-xs px-1.5 py-0.5 rounded-md truncate font-medium text-white cursor-pointer hover:opacity-80 transition-smooth"
                            style={{ backgroundColor: event.color ?? '#CDE9D2' }}
                            title={`${event.title} — click to delete`}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-muted-foreground px-1">
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {view === 'week' && (
            <motion.div
              key="week"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day) => {
                  const dayEvents = eventsForDay(day)
                  return (
                    <div key={day.toISOString()} className="space-y-1">
                      <div
                        className={cn(
                          'text-center py-2 rounded-xl text-sm font-medium',
                          isToday(day)
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground'
                        )}
                      >
                        <div className="text-xs uppercase">{format(day, 'EEE')}</div>
                        <div className="text-lg">{format(day, 'd')}</div>
                      </div>
                      <div
                        className="min-h-[400px] bg-muted/30 rounded-xl p-2 space-y-1 cursor-pointer hover:bg-muted/50 transition-smooth"
                        onClick={() => openNewEvent(day)}
                      >
                        {dayEvents.map((event) => (
                          <div
                            key={event.id}
                            className="p-2 rounded-lg text-xs text-white font-medium cursor-pointer hover:opacity-80 transition-smooth"
                            style={{ backgroundColor: event.color ?? '#CDE9D2' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteEvent(event.id)
                            }}
                            title="Click to delete"
                          >
                            <div className="truncate">{event.title}</div>
                            <div className="opacity-80 mt-0.5">
                              {format(parseISO(event.start_at), 'HH:mm')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {view === 'day' && (
            <motion.div
              key="day"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="max-w-2xl mx-auto">
                <h2 className="text-xl font-serif font-semibold text-foreground mb-4 text-center">
                  {format(currentDate, 'EEEE, MMMM d')}
                </h2>
                <div className="space-y-2">
                  {eventsForDay(currentDate).length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                      <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
                      <p>No events today</p>
                      <button
                        onClick={() => openNewEvent(currentDate)}
                        className="mt-2 text-sm text-primary hover:underline"
                      >
                        Add an event
                      </button>
                    </div>
                  ) : (
                    eventsForDay(currentDate).map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start gap-3 p-4 bg-card border border-border rounded-2xl hover:shadow-md transition-smooth"
                      >
                        <div
                          className="w-3 h-3 rounded-full mt-1 shrink-0"
                          style={{ backgroundColor: event.color }}
                        />
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{event.title}</p>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {format(parseISO(event.start_at), 'HH:mm')} –{' '}
                              {format(parseISO(event.end_at), 'HH:mm')}
                            </span>
                            {event.location && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                {event.location}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => deleteEvent(event.id)}
                          className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-smooth"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                  <button
                    onClick={() => openNewEvent(currentDate)}
                    className="w-full p-4 border-2 border-dashed border-border rounded-2xl text-sm text-muted-foreground hover:border-primary hover:text-primary transition-smooth flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add event
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Event creation modal */}
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
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="glass border border-border rounded-3xl p-6 w-full max-w-md shadow-kin-hover"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-serif font-bold text-foreground">New Event</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-smooth"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    placeholder="Event title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="mt-1 transition-smooth"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Start</Label>
                    <Input
                      type="datetime-local"
                      value={form.start_at}
                      onChange={(e) => setForm({ ...form, start_at: e.target.value })}
                      className="mt-1 transition-smooth"
                    />
                  </div>
                  <div>
                    <Label>End</Label>
                    <Input
                      type="datetime-local"
                      value={form.end_at}
                      onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                      className="mt-1 transition-smooth"
                    />
                  </div>
                </div>

                <div>
                  <Label>Location (optional)</Label>
                  <Input
                    placeholder="Add a location"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="mt-1 transition-smooth"
                  />
                </div>

                <div>
                  <Label>Color</Label>
                  <div className="flex gap-2 mt-2">
                    {EVENT_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setForm({ ...form, color: c })}
                        className={cn(
                          'w-7 h-7 rounded-full transition-smooth hover:scale-110',
                          form.color === c && 'ring-2 ring-offset-2 ring-foreground scale-110'
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
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
                    onClick={saveEvent}
                    disabled={loading || !form.title.trim()}
                  >
                    {loading ? 'Saving...' : 'Save event'}
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
