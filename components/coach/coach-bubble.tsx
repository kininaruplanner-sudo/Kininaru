'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  X,
  ArrowRight,
  Target,
  Trophy,
  TrendingUp,
  Flame,
  CheckSquare,
  BookOpen,
  CalendarDays,
  Mic2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { useCoachPrefs, loadCoachPrefs } from '@/lib/coach/preferences'
import {
  canCoachIntervene,
  recordCoachIntervention,
  wasRuleSeenToday,
  markRuleSeenToday,
} from '@/lib/coach/frequency'
import {
  isMorningBriefDue,
  isEveningBriefDue,
  isWeeklyBriefDue,
  markBriefFired,
} from '@/lib/coach/briefs'
import { browserNotify } from '@/lib/notifications'

/**
 * Floating Kininaru Coach — ÉTAPE 14 §1-6, 12, 21-22, 30-32.
 *
 * - Bottom-right bubble on every authenticated page (raised on /ai so it
 *   never covers the chat composer).
 * - The window shows the MOST relevant deterministic observation for the
 *   current page + the smart next action (§30) + quick routes + a wellbeing
 *   check-in (§22, strictly non-medical).
 * - Frequency control (§7) gates the notification side; the window itself is
 *   user-initiated and never pops up uninvited.
 */

interface CoachObservation {
  id: string
  tone: 'wow' | 'celebration' | 'progress' | 'nudge' | 'neutral'
  message: string
  action: { label: string; href: string } | null
}

interface ObserveResponse {
  observation: CoachObservation | null
  context: Record<string, number> | null
  nextAction: { title: string; taskId: string } | null
  notificationId: string | null
}

const PAGE_FROM_PATH: Record<string, string> = {
  dashboard: 'dashboard',
  tasks: 'tasks',
  habits: 'habits',
  calendar: 'calendar',
  journal: 'journal',
  focus: 'focus',
  family: 'family',
  analytics: 'analytics',
  achievements: 'achievements',
  settings: 'settings',
  ai: 'ai',
}

function pageFromPath(pathname: string): string {
  const key = pathname.split('/')[1] ?? ''
  return PAGE_FROM_PATH[key] ?? 'other'
}

const TONE_ICON: Record<string, React.ElementType> = {
  wow: Flame,
  celebration: Trophy,
  progress: TrendingUp,
  nudge: Target,
  neutral: Sparkles,
}

const TONE_COLOR: Record<string, string> = {
  wow: 'bg-kin-coral/15 text-kin-coral',
  celebration: 'bg-kin-sage/15 text-kin-sage',
  progress: 'bg-kin-blue/15 text-kin-blue',
  nudge: 'bg-kin-yellow/20 text-kin-coral',
  neutral: 'bg-primary/10 text-primary',
}

const WELLBEING_OPTIONS = [
  {
    mood: 'ok',
    emoji: '🙂',
    reply: "Heureux de l'entendre ! Continuons à avancer, une étape à la fois.",
  },
  {
    mood: 'meh',
    emoji: '😐',
    reply:
      'Merci de le dire. Une petite pause ou un peu d’organisation peut t’aider à te sentir mieux.',
  },
  {
    mood: 'hard',
    emoji: '😟',
    reply:
      'Merci de le partager. Respire un instant. Je peux t’aider à organiser ce qui te pèse — et si ça devient trop lourd, parle-en à un professionnel.',
  },
] as const

type WellbeingMood = (typeof WELLBEING_OPTIONS)[number]['mood']

export function CoachBubble() {
  const pathname = usePathname()
  const { t } = useI18n()
  const { prefs, pauseFor } = useCoachPrefs()

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [observation, setObservation] = useState<CoachObservation | null>(null)
  const [nextAction, setNextAction] = useState<ObserveResponse['nextAction']>(null)
  const [wellbeing, setWellbeing] = useState<WellbeingMood | null>(null)
  const [pausedMsg, setPausedMsg] = useState(false)

  const page = pageFromPath(pathname)
  const isAi = pathname === '/ai'

  // Daily / weekly briefs (§12-14): fired once per app session when the user
  // opens the app at the right time of day. Bell + system notification, at
  // most once per day (morning / evening) and once per week. Best-effort.
  const briefsFiredRef = useRef(false)
  useEffect(() => {
    if (briefsFiredRef.current) return
    briefsFiredRef.current = true
    void (async () => {
      const prefs = loadCoachPrefs()
      if (!prefs.enabled || !prefs.notifications) return
      try {
        // Cheap deterministic counts — this endpoint never calls Groq.
        const res = await fetch('/api/coach/observe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page: 'dashboard', style: prefs.style, notify: false }),
        })
        const data = res.ok ? ((await res.json()) as ObserveResponse) : null
        const c = data?.context

        const pushBrief = async (title: string, body: string, link: string) => {
          await fetch('/api/coach/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, body, link }),
          })
          browserNotify(title, body, link)
        }

        if (c && isMorningBriefDue(prefs)) {
          const bits: string[] = []
          if (c.priorityTasksRemaining > 0)
            bits.push(`${c.priorityTasksRemaining} priorité${c.priorityTasksRemaining > 1 ? 's' : ''}`)
          if (c.eventsToday > 0)
            bits.push(`${c.eventsToday} événement${c.eventsToday > 1 ? 's' : ''}`)
          if (c.habitsTotal > 0)
            bits.push(`${c.habitsTotal} habitude${c.habitsTotal > 1 ? 's' : ''}`)
          const body =
            bits.length > 0
              ? bits.join(', ')
              : 'Rien de prévu aujourd’hui. Une belle page blanche.'
          await pushBrief('Bonjour !', `Aujourd’hui : ${body}`, '/dashboard')
          markBriefFired('morning')
        }

        if (c && isEveningBriefDue(prefs)) {
          const bits: string[] = []
          if (c.tasksCompleted > 0)
            bits.push(`${c.tasksCompleted} tâche${c.tasksCompleted > 1 ? 's' : ''} terminée${c.tasksCompleted > 1 ? 's' : ''}`)
          if (c.focusMinutesToday > 0)
            bits.push(`${c.focusMinutesToday} min de Focus`)
          if (c.habitsDoneToday > 0)
            bits.push(`${c.habitsDoneToday} habitude${c.habitsDoneToday > 1 ? 's' : ''} cochée${c.habitsDoneToday > 1 ? 's' : ''}`)
          const body = bits.length > 0 ? bits.join(', ') : 'Une journée douce.'
          await pushBrief('Bilan de ta journée', body, '/journal')
          markBriefFired('evening')
        }

        if (isWeeklyBriefDue(prefs)) {
          await pushBrief('Ta semaine', 'Planifie ta semaine avec le coach et garde le cap.', '/ai')
          markBriefFired('weekly')
        }
      } catch {
        // Briefs are best-effort — never break the app.
      }
    })()
  }, [])

  const fetchObservation = useCallback(async () => {
    if (!prefs.enabled) return
    setLoading(true)
    setError(false)
    const frequency = canCoachIntervene({
      enabled: prefs.enabled,
      proactive: prefs.proactive,
      pausedUntil: prefs.pausedUntil,
    })
    const wantNotify = prefs.notifications && frequency.allowed

    try {
      const res = await fetch('/api/coach/observe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page, style: prefs.style, notify: wantNotify }),
      })
      if (!res.ok) {
        setError(true)
        return
      }
      const data = (await res.json()) as ObserveResponse
      setObservation(data.observation)
      setNextAction(data.nextAction)

      // Frequency-guarded notification (bell + system) — dedupe per rule/day.
      if (data.notificationId && data.observation) {
        recordCoachIntervention()
        if (!wasRuleSeenToday(data.observation.id)) {
          markRuleSeenToday(data.observation.id)
          browserNotify(
            'Kininaru Coach',
            data.observation.message,
            data.observation.action?.href
          )
        }
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [page, prefs.enabled, prefs.proactive, prefs.notifications, prefs.pausedUntil, prefs.style])

  const openCoach = () => {
    setOpen(true)
    void fetchObservation()
  }

  const pause = () => {
    pauseFor(24)
    setPausedMsg(true)
    window.setTimeout(() => setPausedMsg(false), 3500)
  }

  if (!prefs.enabled) return null

  const ToneIcon = observation ? TONE_ICON[observation.tone] ?? Sparkles : Sparkles

  return (
    <>
      {/* Floating bubble — raised on /ai so it never covers the composer */}
      <motion.button
        type="button"
        onClick={openCoach}
        aria-label="Ouvrir le coach Kininaru"
        title="Kininaru Coach"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        className={cn(
          'fixed z-40 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-kin transition-smooth',
          'w-12 h-12',
          isAi ? 'bottom-32 right-4 md:bottom-32 md:right-6' : 'bottom-5 right-4 md:bottom-6 md:right-6'
        )}
      >
        <Sparkles className="w-5 h-5" />
        <span
          aria-hidden="true"
          className="absolute -inset-1 rounded-full ring-1 ring-primary/25 pointer-events-none motion-reduce:ring-0"
        />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            role="dialog"
            aria-label="Fenêtre du coach Kininaru"
            className={cn(
              'fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-kin-hover',
              'w-[min(92vw,360px)] max-h-[min(70vh,540px)]',
              isAi ? 'bottom-44 right-4 md:right-6' : 'bottom-24 right-4 md:bottom-28 md:right-6'
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border shrink-0 bg-background/60">
              <span className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-kin">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight">Kininaru Coach</p>
                <p className="text-[11px] text-muted-foreground">Votre compagnon quotidien</p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Fermer le coach">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
              {/* Observation */}
              {loading ? (
                <div className="rounded-xl bg-primary/5 border border-primary/15 p-3.5 flex items-center gap-2.5">
                  <span className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin motion-reduce:hidden" />
                  <p className="text-[13px] text-muted-foreground">
                    Le coach prépare un point sur ta journée…
                  </p>
                </div>
              ) : error ? (
                <div className="rounded-xl bg-muted/60 border border-border p-3.5">
                  <p className="text-[13px] text-muted-foreground">
                    Je n’arrive pas à lire ta journée pour l’instant. Réessaie dans un instant.
                  </p>
                </div>
              ) : observation ? (
                <div className="rounded-xl bg-primary/5 border border-primary/15 p-3.5">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                        TONE_COLOR[observation.tone]
                      )}
                    >
                      <ToneIcon className="w-3.5 h-3.5" />
                    </span>
                    <p className="text-[13px] leading-relaxed text-foreground">{observation.message}</p>
                  </div>
                  {observation.action && (
                    <Link
                      href={observation.action.href}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline transition-smooth"
                    >
                      {observation.action.label}
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              ) : null}

              {/* Smart next action (§30) */}
              {nextAction && (
                <div className="rounded-xl border border-border bg-background/50 p-3.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
                    🎯 Que faire maintenant ?
                  </p>
                  <p className="text-sm font-medium text-foreground leading-snug">{nextAction.title}</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <Link
                      href={`/focus?taskId=${nextAction.taskId}&task=${encodeURIComponent(
                        nextAction.title
                      )}`}
                    >
                      <Button size="sm">Commencer</Button>
                    </Link>
                    <Link href="/tasks">
                      <Button variant="outline" size="sm">
                        Voir mes tâches
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {/* Quick actions */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { href: '/ai', icon: Mic2, label: 'AI Coach' },
                  { href: '/tasks', icon: CheckSquare, label: 'Tâches' },
                  { href: '/journal', icon: BookOpen, label: 'Journal' },
                  { href: '/calendar', icon: CalendarDays, label: 'Calendrier' },
                ].map((qa) => (
                  <Link
                    key={qa.href}
                    href={qa.href}
                    className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] text-foreground hover:border-primary/40 hover:bg-primary/5 transition-smooth"
                  >
                    <qa.icon className="w-3.5 h-3.5 text-primary shrink-0" />
                    {qa.label}
                  </Link>
                ))}
              </div>

              {/* Wellbeing check-in (§21-22) — supportive, never medical */}
              <div className="rounded-xl border border-border bg-background/50 p-3.5">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Comment vas-tu aujourd’hui ?
                </p>
                {!wellbeing ? (
                  <div className="flex gap-2">
                    {WELLBEING_OPTIONS.map((opt) => (
                      <button
                        key={opt.mood}
                        type="button"
                        onClick={() => setWellbeing(opt.mood)}
                        className="flex-1 min-h-11 rounded-xl border border-border bg-card text-xl hover:border-primary/50 hover:bg-primary/5 transition-smooth"
                        aria-label={`Humeur : ${opt.mood}`}
                      >
                        {opt.emoji}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div>
                    <p className="text-[13px] leading-relaxed text-foreground">
                      {WELLBEING_OPTIONS.find((o) => o.mood === wellbeing)?.reply}
                    </p>
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <Link href="/journal">
                        <Button variant="outline" size="sm" className="w-full">
                          Écrire dans mon journal
                        </Button>
                      </Link>
                      <Link href="/focus">
                        <Button variant="outline" size="sm" className="w-full">
                          Faire une pause
                        </Button>
                      </Link>
                      <Link href="/tasks">
                        <Button variant="outline" size="sm" className="w-full">
                          Organiser ma journée
                        </Button>
                      </Link>
                      <Link href="/ai">
                        <Button variant="outline" size="sm" className="w-full">
                          Parler au coach
                        </Button>
                      </Link>
                    </div>
                    <p className="text-[10px] text-muted-foreground/80 mt-2 leading-relaxed">
                      Soutien bienveillant — ce n’est ni un avis médical ni une thérapie.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-border flex items-center justify-between gap-2 bg-background/60 shrink-0">
              <p className="text-[10px] text-muted-foreground/80 leading-snug">
                Le coach voit un résumé de ta journée — jamais tes secrets.
              </p>
              <div className="flex items-center gap-1 shrink-0">
                <Link href="/settings">
                  <Button variant="ghost" size="xs">
                    {t('common.settings')}
                  </Button>
                </Link>
                <Button variant="ghost" size="xs" onClick={pause}>
                  {pausedMsg ? 'En pause ✓' : 'Pause 24 h'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
