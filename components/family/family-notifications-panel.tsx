'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { formatDistanceToNow } from '@/lib/date-fr'
import { fr } from 'date-fns/locale'
import { Bell, UserPlus, CheckSquare, CalendarDays, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { FamilyNotification } from './types'

const TYPE_ICONS: Record<string, React.ElementType> = {
  member_joined: UserPlus,
  task_assigned: CheckSquare,
  task_completed: CheckSquare,
  event_created: CalendarDays,
  goal_completed: Target,
}

interface Props {
  notifications: FamilyNotification[]
}

export function FamilyNotificationsPanel({ notifications: initial }: Props) {
  const [notifications, setNotifications] = useState(initial)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    const { error: updateError } = await supabase
      .from('family_notifications')
      .update({ read: true })
      .eq('id', id)
    if (updateError) {
      setError('Impossible de mettre à jour la notification.')
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)))
    }
  }

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (unreadIds.length === 0) return
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    const { error: updateError } = await supabase
      .from('family_notifications')
      .update({ read: true })
      .in('id', unreadIds)
    if (updateError) {
      setError('Impossible de tout marquer comme lu.')
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center size-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-destructive text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-card border border-border rounded-2xl shadow-kin-hover z-50"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm font-semibold text-foreground">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Tout marquer comme lu
                  </button>
                )}
              </div>

              {error && (
                <div className="mx-3 mt-3 bg-destructive/10 text-destructive text-xs p-2.5 rounded-lg border border-destructive/20">
                  {error}
                </div>
              )}

              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Aucune notification pour le moment.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {notifications.map((n) => {
                    const Icon = TYPE_ICONS[n.type] ?? Bell
                    return (
                      <li key={n.id}>
                        <button
                          onClick={() => !n.read && markAsRead(n.id)}
                          className={cn(
                            'w-full flex items-start gap-3 px-4 py-3 text-left transition-smooth hover:bg-muted',
                            !n.read && 'bg-primary/5'
                          )}
                        >
                          <span
                            className={cn(
                              'flex items-center justify-center size-7 rounded-lg shrink-0 mt-0.5',
                              n.read ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary'
                            )}
                          >
                            <Icon className="size-3.5" />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span
                              className={cn(
                                'block text-xs leading-relaxed',
                                n.read ? 'text-muted-foreground' : 'text-foreground font-medium'
                              )}
                            >
                              {n.message}
                            </span>
                            <span className="block text-[10px] text-muted-foreground mt-0.5">
                              {formatDistanceToNow(new Date(n.created_at), {
                                addSuffix: true,
                                locale: fr,
                              })}
                            </span>
                          </span>
                          {!n.read && (
                            <span className="size-2 rounded-full bg-primary shrink-0 mt-1.5" />
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
