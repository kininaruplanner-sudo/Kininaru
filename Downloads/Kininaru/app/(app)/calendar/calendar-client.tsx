'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfDay,
  addMinutes,
  isToday,
  isBefore,
  parseISO,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, X, Calendar, Clock, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cardVariants } from '@/components/ui/card'
import { palette } from '@/lib/palette'

const EVENT_COLORS = [
  palette('rose-dark'), palette('lavender'), palette('blue'), palette('sage'),
  palette('yellow'), palette('coral'), palette('violet'), palette('rose'),
]

type ViewMode = 'month' | 'week' | 'day' | 'agenda'

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

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const HOUR_HEIGHT = 48
const SNAP_MINUTES = 15
const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const minutesFromMidnight = (d: Date) => d.getHours() * 60 + d.getMinutes()
const dateFromDayAndMinutes = (day: Date, minutes: number) => addMinutes(startOfDay(day), minutes)

/** Greedy overlap-column layout so same-day overlapping events sit side by side instead of stacking illegibly. */
function layoutDayEvents(dayEvents: CalendarEvent[]) {
  const sorted = [...dayEvents].sort(
    (a, b) => parseISO(a.start_at).getTime() - parseISO(b.start_at).getTime()
  )
  const columns: CalendarEvent[][] = []
  const colIndex = new Map<string, number>()
  for (const ev of sorted) {
    const start = parseISO(ev.start_at).getTime()
    let placed = false
    for (let c = 0; c < columns.length; c++) {
      const lastInCol = columns[c][columns[c].length - 1]
      if (parseISO(lastInCol.end_at).getTime() <= start) {
        columns[c].push(ev)
        colIndex.set(ev.id, c)
        placed = true
        break
      }
    }
    if (!placed) {
      columns.push([ev])
      colIndex.set(ev.id, columns.length - 1)
    }
  }
  const totalCols = columns.length || 1
  return sorted.map((ev) => ({ event: ev, col: colIndex.get(ev.id)!, totalCols }))
}

// ---------------------------------------------------------------------
// Mini calendar (month navigator + date-jump, sidebar)
// ---------------------------------------------------------------------
function MiniCalendar({
  month,
  onMonthChange,
  selected,
  onSelect,
  eventDates,
}: {
  month: Date
  onMonthChange: (d: Date) => void
  selected: Date
  onSelect: (d: Date) => void
  eventDates: Set<string>
}) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start, end })

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-foreground">{format(month, 'MMMM yyyy')}</span>
        <div className="flex gap-0.5">
          <Button variant="ghost" size="icon-xs" onClick={() => onMonthChange(subMonths(month, 1))}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={() => onMonthChange(addMonths(month, 1))}>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {DAYS_OF_WEEK.map((d) => (
          <span key={d} className="text-[10px] text-muted-foreground">{d[0]}</span>
        ))}
        {days.map((day) => {
          const inMonth = isSameMonth(day, month)
          const isSel = isSameDay(day, selected)
          const hasEvents = eventDates.has(format(day, 'yyyy-MM-dd'))
          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelect(day)}
              className={cn(
                'relative w-7 h-7 mx-auto flex items-center justify-center text-xs rounded-full transition-smooth',
                !inMonth && 'text-muted-foreground/30',
                isSel && 'bg-primary text-primary-foreground font-semibold',
                !isSel && isToday(day) && 'text-primary font-semibold',
                !isSel && inMonth && 'hover:bg-muted text-foreground'
              )}
            >
              {format(day, 'd')}
              {hasEvents && !isSel && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Time grid (shared by Day and Week views) — hour rows, drag to move,
// drag the bottom edge to resize, live current-time indicator.
// ---------------------------------------------------------------------
interface DragState {
  id: string
  mode: 'move' | 'resize'
  dayIdx: number
  origStartMin: number
  origEndMin: number
  liveStartMin: number
  liveEndMin: number
  liveDayIdx: number
}

function TimeGrid({
  days,
  events,
  onSlotClick,
  onEventMove,
  onEventResize,
  onDeleteEvent,
}: {
  days: Date[]
  events: CalendarEvent[]
  onSlotClick: (day: Date, minutes: number) => void
  onEventMove: (id: string, newStart: Date, newEnd: Date) => void
  onEventResize: (id: string, newEnd: Date) => void
  onDeleteEvent: (id: string) => void
}) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const [now, setNow] = useState(new Date())
  const justDraggedRef = useRef(false)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!drag) return

    const handleMove = (e: PointerEvent) => {
      setDrag((d) => {
        if (!d) return d
        if (d.mode === 'resize') {
          const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
          const gridEl = el?.closest('[data-hour-grid]') as HTMLElement | null
          if (!gridEl) return d
          const rect = gridEl.getBoundingClientRect()
          const y = e.clientY - rect.top
          const rawMin = Math.round((y / HOUR_HEIGHT) * 60 / SNAP_MINUTES) * SNAP_MINUTES
          const newEnd = Math.max(d.origStartMin + SNAP_MINUTES, Math.min(24 * 60, rawMin))
          return { ...d, liveEndMin: newEnd }
        }
        // move
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
        const col = el?.closest('[data-day-idx]') as HTMLElement | null
        if (!col) return d
        const dayIdx = Number(col.dataset.dayIdx)
        const rect = col.getBoundingClientRect()
        const y = e.clientY - rect.top
        const duration = d.origEndMin - d.origStartMin
        const rawStart = Math.round((y / HOUR_HEIGHT) * 60 / SNAP_MINUTES) * SNAP_MINUTES - duration / 2
        const snappedStart = Math.round(rawStart / SNAP_MINUTES) * SNAP_MINUTES
        const clampedStart = Math.max(0, Math.min(24 * 60 - duration, snappedStart))
        return { ...d, liveStartMin: clampedStart, liveEndMin: clampedStart + duration, liveDayIdx: dayIdx }
      })
    }

    const handleUp = () => {
      justDraggedRef.current = true
      setDrag((d) => {
        if (d) {
          if (d.mode === 'resize') {
            onEventResize(d.id, dateFromDayAndMinutes(days[d.dayIdx], d.liveEndMin))
          } else {
            onEventMove(
              d.id,
              dateFromDayAndMinutes(days[d.liveDayIdx], d.liveStartMin),
              dateFromDayAndMinutes(days[d.liveDayIdx], d.liveEndMin)
            )
          }
        }
        return null
      })
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [drag, days, onEventMove, onEventResize])

  const startDrag = (event: CalendarEvent, dayIdx: number, mode: 'move' | 'resize') => {
    const startMin = minutesFromMidnight(parseISO(event.start_at))
    const endMin = minutesFromMidnight(parseISO(event.end_at))
    setDrag({ id: event.id, mode, dayIdx, origStartMin: startMin, origEndMin: endMin, liveStartMin: startMin, liveEndMin: endMin, liveDayIdx: dayIdx })
  }

  return (
    <div className="flex border-t border-l border-border rounded-xl overflow-hidden bg-card">
      {/* Hour label gutter */}
      <div className="w-14 shrink-0">
        <div className="h-10 border-b border-border" />
        {HOURS.map((h) => (
          <div
            key={h}
            className="border-b border-border/60 text-[10px] text-muted-foreground text-right pr-1.5 relative"
            style={{ height: HOUR_HEIGHT }}
          >
            {h > 0 && <span className="absolute -top-2 right-1.5">{format(addMinutes(startOfDay(new Date()), h * 60), 'ha')}</span>}
          </div>
        ))}
      </div>

      {/* Days area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header row */}
        <div className="h-10 flex border-b border-border">
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={cn('flex-1 border-r border-border flex flex-col items-center justify-center', isToday(day) && 'bg-primary/5')}
            >
              <span className="text-[10px] uppercase text-muted-foreground">{format(day, 'EEE')}</span>
              <span className={cn('text-sm font-medium leading-none', isToday(day) ? 'text-primary font-bold' : 'text-foreground')}>
                {format(day, 'd')}
              </span>
            </div>
          ))}
        </div>

        {/* Hour grid row */}
        <div className="flex relative" data-hour-grid style={{ height: HOURS.length * HOUR_HEIGHT }}>
          {days.map((day, dayIdx) => {
            const dayEvents = events.filter((e) => isSameDay(parseISO(e.start_at), day) && e.id !== drag?.id)
            const layout = layoutDayEvents(dayEvents)
            return (
              <div
                key={day.toISOString()}
                data-day-idx={dayIdx}
                className="flex-1 border-r border-border relative"
                onClick={(e) => {
                  if (justDraggedRef.current) {
                    justDraggedRef.current = false
                    return
                  }
                  if ((e.target as HTMLElement).closest('[data-event-block]')) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const y = e.clientY - rect.top
                  const minutes = Math.round((y / HOUR_HEIGHT) * 60 / SNAP_MINUTES) * SNAP_MINUTES
                  onSlotClick(day, minutes)
                }}
              >
                {HOURS.map((h) => (
                  <div key={h} className="border-b border-border/60" style={{ height: HOUR_HEIGHT }} />
                ))}

                {isToday(day) && (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                    style={{ top: (minutesFromMidnight(now) / 60) * HOUR_HEIGHT }}
                  >
                    <span className="w-2 h-2 rounded-full bg-destructive -ml-1 shrink-0" />
                    <span className="flex-1 h-px bg-destructive" />
                  </div>
                )}

                {layout.map(({ event, col, totalCols }) => {
                  const startMin = minutesFromMidnight(parseISO(event.start_at))
                  const endMin = minutesFromMidnight(parseISO(event.end_at))
                  const top = (startMin / 60) * HOUR_HEIGHT
                  const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 22)
                  const widthPct = 100 / totalCols
                  const leftPct = col * widthPct
                  return (
                    <motion.div
                      key={event.id}
                      data-event-block
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.15 }}
                      className="absolute rounded-lg px-2 py-1 text-white text-xs overflow-hidden cursor-grab active:cursor-grabbing shadow-kin hover:shadow-kin-hover transition-shadow group/ev"
                      style={{
                        top,
                        height,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        backgroundColor: event.color ?? 'var(--kt-sage)',
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        startDrag(event, dayIdx, 'move')
                      }}
                    >
                      <p className="font-medium truncate">{event.title}</p>
                      {height > 32 && (
                        <p className="opacity-80 truncate">
                          {format(parseISO(event.start_at), 'HH:mm')}–{format(parseISO(event.end_at), 'HH:mm')}
                        </p>
                      )}
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteEvent(event.id)
                        }}
                        className="absolute top-0.5 right-0.5 opacity-0 group-hover/ev:opacity-100 transition-smooth hover:bg-black/20 rounded p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <div
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          startDrag(event, dayIdx, 'resize')
                        }}
                        className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize"
                      />
                    </motion.div>
                  )
                })}
              </div>
            )
          })}

          {/* Live drag preview, positioned relative to the whole row so it can cross day columns */}
          {drag && (
            <div
              className="absolute rounded-lg px-2 py-1 text-white text-xs overflow-hidden ring-2 ring-white/70 shadow-kin-hover z-30 pointer-events-none"
              style={{
                top: (drag.liveStartMin / 60) * HOUR_HEIGHT,
                height: Math.max(((drag.liveEndMin - drag.liveStartMin) / 60) * HOUR_HEIGHT, 22),
                left: `calc(${(drag.liveDayIdx / days.length) * 100}% + 2px)`,
                width: `calc(${(1 / days.length) * 100}% - 4px)`,
                backgroundColor: events.find((e) => e.id === drag.id)?.color ?? 'var(--kt-sage)',
              }}
            >
              <p className="font-medium truncate">{events.find((e) => e.id === drag.id)?.title}</p>
              <p className="opacity-80 truncate">
                {format(dateFromDayAndMinutes(days[drag.liveDayIdx] ?? days[0], drag.liveStartMin), 'HH:mm')}–
                {format(dateFromDayAndMinutes(days[drag.liveDayIdx] ?? days[0], drag.liveEndMin), 'HH:mm')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Agenda view — chronological list grouped by day
// ---------------------------------------------------------------------
function AgendaView({ events, onDelete }: { events: CalendarEvent[]; onDelete: (id: string) => void }) {
  const upcoming = events
    .filter((e) => !isBefore(parseISO(e.start_at), startOfDay(new Date())))
    .sort((a, b) => a.start_at.localeCompare(b.start_at))

  const groups: { date: Date; events: CalendarEvent[] }[] = []
  const indexByKey = new Map<string, number>()
  for (const e of upcoming) {
    const d = parseISO(e.start_at)
    const key = format(d, 'yyyy-MM-dd')
    if (!indexByKey.has(key)) {
      indexByKey.set(key, groups.length)
      groups.push({ date: d, events: [] })
    }
    groups[indexByKey.get(key)!].events.push(e)
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>No upcoming events</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {groups.map((group, gi) => (
        <motion.div
          key={group.date.toISOString()}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: gi * 0.03, duration: 0.2 }}
        >
          <h3 className="text-sm font-semibold text-foreground mb-2 sticky top-0 bg-background/95 backdrop-blur-sm py-1 z-10">
            {format(group.date, 'EEEE, MMMM d')}
            {isToday(group.date) && <span className="ml-2 text-primary text-xs font-medium">Today</span>}
          </h3>
          <div className="space-y-2">
            {group.events.map((event) => (
              <div key={event.id} className={cn(cardVariants({ padding: 'sm', hover: true }), 'flex items-start gap-3 group')}>
                <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: event.color }} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{event.title}</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {format(parseISO(event.start_at), 'HH:mm')}–{format(parseISO(event.end_at), 'HH:mm')}
                    </span>
                    {event.location && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {event.location}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onDelete(event.id)}
                  className="opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------
export function CalendarClient({ events: initialEvents, userId }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [miniMonth, setMiniMonth] = useState(new Date())
  const [view, setView] = useState<ViewMode>('month')
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dragChipId, setDragChipId] = useState<string | null>(null)
  const [dragOverDay, setDragOverDay] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    setMiniMonth(currentDate)
  }, [currentDate.getMonth(), currentDate.getFullYear()])

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

  const eventsForDay = (day: Date) => events.filter((e) => isSameDay(parseISO(e.start_at), day))
  const eventDates = new Set(events.map((e) => format(parseISO(e.start_at), 'yyyy-MM-dd')))

  const goToPrevious = () => {
    if (view === 'month') setCurrentDate((d) => subMonths(d, 1))
    else if (view === 'week') setCurrentDate((d) => subDays(d, 7))
    else if (view === 'day') setCurrentDate((d) => subDays(d, 1))
  }
  const goToNext = () => {
    if (view === 'month') setCurrentDate((d) => addMonths(d, 1))
    else if (view === 'week') setCurrentDate((d) => addDays(d, 7))
    else if (view === 'day') setCurrentDate((d) => addDays(d, 1))
  }

  const openNewEvent = (day?: Date, minutes?: number) => {
    const base = day ?? new Date()
    const d = minutes !== undefined ? dateFromDayAndMinutes(base, minutes) : base
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

  // Opened via the command palette's quick-create shortcut (?new=1)
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openNewEvent()
      router.replace(window.location.pathname)
    }
  }, [searchParams, router])

  // Keyboard shortcuts: arrows navigate, T = today, M/W/D/A switch views, N = new event
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showModal) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      switch (e.key) {
        case 'ArrowLeft': goToPrevious(); break
        case 'ArrowRight': goToNext(); break
        case 't': case 'T': setCurrentDate(new Date()); break
        case 'm': case 'M': setView('month'); break
        case 'w': case 'W': setView('week'); break
        case 'd': case 'D': setView('day'); break
        case 'a': case 'A': setView('agenda'); break
        case 'n': case 'N': openNewEvent(); break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, showModal])

  const saveEvent = async () => {
    if (!form.title.trim()) return
    setLoading(true)
    const { data } = await supabase
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

  const updateEventTiming = async (id: string, newStart: Date, newEnd: Date) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, start_at: newStart.toISOString(), end_at: newEnd.toISOString() } : e))
    )
    await supabase
      .from('events')
      .update({ start_at: newStart.toISOString(), end_at: newEnd.toISOString() })
      .eq('id', id)
  }

  const resizeEvent = (id: string, newEnd: Date) => {
    const ev = events.find((e) => e.id === id)
    if (!ev) return
    updateEventTiming(id, parseISO(ev.start_at), newEnd)
  }

  const moveEventToDay = (id: string, newDay: Date) => {
    const ev = events.find((e) => e.id === id)
    if (!ev) return
    const oldStart = parseISO(ev.start_at)
    const oldEnd = parseISO(ev.end_at)
    const dur = oldEnd.getTime() - oldStart.getTime()
    const newStart = dateFromDayAndMinutes(newDay, minutesFromMidnight(oldStart))
    updateEventTiming(id, newStart, new Date(newStart.getTime() + dur))
  }

  const viewLabel = () => {
    if (view === 'month') return format(currentDate, 'MMMM yyyy')
    if (view === 'week') return `${format(weekStart, 'MMM d')} – ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`
    if (view === 'day') return format(currentDate, 'EEEE, MMMM d')
    return 'Agenda'
  }

  return (
    <div className="flex h-full">
      {/* Mini sidebar */}
      <div className="hidden lg:flex w-64 shrink-0 border-r border-border flex-col bg-card/40">
        <MiniCalendar
          month={miniMonth}
          onMonthChange={setMiniMonth}
          selected={currentDate}
          onSelect={(d) => {
            setCurrentDate(d)
            if (view === 'month') setView('day')
          }}
          eventDates={eventDates}
        />
        <div className="mt-auto p-4 border-t border-border text-xs text-muted-foreground space-y-1.5">
          <p className="font-medium text-foreground mb-2">Shortcuts</p>
          {[
            ['←  →', 'Previous / next'],
            ['T', 'Jump to today'],
            ['M W D A', 'Switch view'],
            ['N', 'New event'],
          ].map(([keys, label]) => (
            <div key={label} className="flex items-center justify-between">
              <span>{label}</span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded-md bg-card border border-border">{keys}</kbd>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-serif font-bold text-foreground">Calendar</h1>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" onClick={goToPrevious} disabled={view === 'agenda'}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1 text-sm font-medium rounded-lg hover:bg-muted text-foreground transition-smooth min-w-[10rem] text-center"
              >
                {viewLabel()}
              </button>
              <Button variant="ghost" size="icon-sm" onClick={goToNext} disabled={view === 'agenda'}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-muted rounded-xl p-1 gap-1">
              {(['month', 'week', 'day', 'agenda'] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-lg capitalize transition-smooth',
                    view === v ? 'bg-card text-foreground shadow-kin' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <Button onClick={() => openNewEvent()} size="sm" className="gap-1.5 transition-smooth hover:scale-[1.02]">
              <Plus className="w-4 h-4" />
              New event
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-4">
          <AnimatePresence mode="wait">
            {view === 'month' && (
              <motion.div
                key="month"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              >
                <div className="grid grid-cols-7 mb-2">
                  {DAYS_OF_WEEK.map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 border-l border-t border-border rounded-xl overflow-hidden">
                  {calDays.map((day, di) => {
                    const dayEvents = eventsForDay(day)
                    const isCurrentMonth = isSameMonth(day, currentDate)
                    const isSelected = selectedDay && isSameDay(day, selectedDay)
                    const dayKey = format(day, 'yyyy-MM-dd')
                    const isDragOver = dragOverDay === dayKey
                    return (
                      <div
                        key={day.toISOString()}
                        onClick={() => {
                          setSelectedDay(day)
                          openNewEvent(day)
                        }}
                        onDragOver={(e) => {
                          e.preventDefault()
                          setDragOverDay(dayKey)
                        }}
                        onDragLeave={() => setDragOverDay((prev) => (prev === dayKey ? null : prev))}
                        onDrop={(e) => {
                          e.preventDefault()
                          if (dragChipId) moveEventToDay(dragChipId, day)
                          setDragChipId(null)
                          setDragOverDay(null)
                        }}
                        className={cn(
                          'min-h-[100px] border-r border-b border-border p-1.5 cursor-pointer transition-smooth group',
                          !isCurrentMonth && 'bg-muted/20',
                          isSelected && 'bg-primary/5',
                          isDragOver && 'bg-primary/10 ring-1 ring-inset ring-primary/40',
                          isCurrentMonth && !isDragOver && 'hover:bg-muted/30'
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
                          {dayEvents.slice(0, 3).map((event, ei) => (
                            <motion.div
                              key={event.id}
                              layout
                              initial={{ opacity: 0 }}
                              animate={{ opacity: dragChipId === event.id ? 0.4 : 1 }}
                              transition={{ delay: di < 14 ? ei * 0.02 : 0, duration: 0.15 }}
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation()
                                setDragChipId(event.id)
                              }}
                              onDragEnd={() => {
                                setDragChipId(null)
                                setDragOverDay(null)
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="group/chip relative flex items-center gap-1 text-xs pl-1.5 pr-4 py-0.5 rounded-md truncate font-medium text-white cursor-grab active:cursor-grabbing hover:opacity-90 transition-smooth"
                              style={{ backgroundColor: event.color ?? 'var(--kt-sage)' }}
                              title={event.title}
                            >
                              <span className="truncate">{event.title}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteEvent(event.id)
                                }}
                                className="absolute right-0.5 opacity-0 group-hover/chip:opacity-100 transition-smooth hover:bg-black/20 rounded p-0.5"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </motion.div>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-xs text-muted-foreground px-1">+{dayEvents.length - 3} more</div>
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
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              >
                <TimeGrid
                  days={weekDays}
                  events={events}
                  onSlotClick={(day, minutes) => openNewEvent(day, minutes)}
                  onEventMove={updateEventTiming}
                  onEventResize={resizeEvent}
                  onDeleteEvent={deleteEvent}
                />
              </motion.div>
            )}

            {view === 'day' && (
              <motion.div
                key="day"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="max-w-xl mx-auto"
              >
                <TimeGrid
                  days={[currentDate]}
                  events={events}
                  onSlotClick={(day, minutes) => openNewEvent(day, minutes)}
                  onEventMove={updateEventTiming}
                  onEventResize={resizeEvent}
                  onDeleteEvent={deleteEvent}
                />
                {eventsForDay(currentDate).length === 0 && (
                  <div className="text-center py-10 text-muted-foreground">
                    <p className="text-sm">No events today &middot; click a time slot to add one</p>
                  </div>
                )}
              </motion.div>
            )}

            {view === 'agenda' && (
              <motion.div
                key="agenda"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              >
                <AgendaView events={events} onDelete={deleteEvent} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Event creation modal */}
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
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="glass border border-border rounded-3xl p-6 w-full max-w-md shadow-kin-hover"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-serif font-bold text-foreground">New Event</h2>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowModal(false)}>
                  <X className="w-4 h-4" />
                </Button>
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
                  <Button variant="outline" className="flex-1 transition-smooth" onClick={() => setShowModal(false)}>
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
