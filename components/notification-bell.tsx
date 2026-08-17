'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { fr as frLocale, enUS } from 'date-fns/locale'
import { Bell, Users, CheckSquare, Repeat2, Trophy, Info, CheckCheck, Inbox } from 'lucide-react'
import { CoachMascot } from '@/components/coach-mascot'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n'

interface Notification {
  id: string
  type: 'info' | 'family' | 'task' | 'habit' | 'achievement'
  title: string
  body: string | null
  link: string | null
  read: boolean
  created_at: string
}

const TYPE_ICONS = {
  info: Info,
  family: Users,
  task: CheckSquare,
  habit: Repeat2,
  achievement: Trophy,
} as const

const TYPE_COLORS: Record<Notification['type'], string> = {
  info: 'bg-primary/10 text-primary',
  family: 'bg-kin-violet/15 text-kin-violet',
  task: 'bg-kin-blue/15 text-kin-blue',
  habit: 'bg-kin-rose/20 text-kin-rose-dark',
  achievement: 'bg-kin-yellow/20 text-kin-coral',
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()
  const { locale, t } = useI18n()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(25)
    if (data) setNotifications(data as Notification[])
    setLoading(false)
  }, [supabase])

  // Initial fetch + light polling so new notifications (e.g. family joins)
  // appear without a full page reload.
  useEffect(() => {
    load()
    timerRef.current = setInterval(load, 30_000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [load])

  const unread = notifications.filter((n) => !n.read).length
  const timeLocale = locale === 'fr' ? frLocale : enUS

  const openNotification = async (n: Notification) => {
    if (!n.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id)
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
    }
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  const markAllRead = async () => {
    await supabase.from('notifications').update({ read: true }).eq('read', false)
    setNotifications((prev) => prev.map((x) => ({ ...x, read: true })))
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative flex items-center justify-center w-full rounded-xl p-2.5 min-h-11 text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth',
          open && 'bg-muted text-foreground'
        )}
        aria-label={t('notif.title')}
        title={t('notif.title')}
      >
        <Bell className="w-4 h-4 shrink-0" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-kin-rose-dark text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-0 mb-2 w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card shadow-kin-hover z-50 overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm font-semibold text-foreground">{t('notif.title')}</span>
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-xs text-primary font-medium hover:underline transition-smooth"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    {t('notif.markAll')}
                  </button>
                )}
              </div>

              <div className="max-h-[340px] overflow-y-auto">
                {loading ? (
                  <p className="text-sm text-muted-foreground text-center py-8">{t('notif.loading')}</p>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-10">
                    <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">{t('notif.empty')}</p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const Icon = TYPE_ICONS[n.type] ?? Info
                    // Les notifications du coach (type 'info', insérées par
                    // /api/coach/notify) portent le visage du coach.
                    const isCoach = n.type === 'info'
                    return (
                      <button
                        key={n.id}
                        onClick={() => openNotification(n)}
                        className={cn(
                          'w-full text-left flex gap-3 px-4 py-3 hover:bg-muted/60 transition-smooth border-b border-border/40 last:border-0',
                          !n.read && 'bg-primary/[0.04]'
                        )}
                      >
                        <div
                          className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                            TYPE_COLORS[n.type] ?? 'bg-primary/10 text-primary'
                          )}
                        >
                          {isCoach ? (
                            <CoachMascot mood="notify" className="w-4.5 h-4.5" />
                          ) : (
                            <Icon className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {!n.read && <span className="inline-block w-1.5 h-1.5 rounded-full bg-kin-rose-dark mr-1.5 align-middle" />}
                            {n.title}
                          </p>
                          {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                          <p className="text-[10px] text-muted-foreground/70 mt-1">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: timeLocale })}
                          </p>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
