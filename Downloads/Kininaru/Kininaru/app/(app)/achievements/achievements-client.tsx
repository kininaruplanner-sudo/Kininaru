'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Star, Zap, Target, Timer, Repeat2, BookOpen, Flame, Award } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  profile: any
  tasks: any[]
  focusSessions: any[]
  habits: any[]
}

interface Badge {
  id: string
  title: string
  description: string
  icon: any
  color: string
  bg: string
  unlocked: boolean
  progress?: number
  total?: number
}

export function AchievementsClient({ profile, tasks, focusSessions, habits }: Props) {
  const completedTasks = tasks.filter((t) => t.status === 'done').length
  const totalFocusMinutes = focusSessions.reduce((a, s) => a + (s.duration_minutes ?? 0), 0)
  const bestStreak = Math.max(...habits.map((h) => h.best_streak ?? 0), 0)

  const xp = profile?.xp ?? 0
  const level = profile?.level ?? 1
  const xpForNext = level * 100
  const xpProgress = (xp % xpForNext) / xpForNext

  const badges: Badge[] = useMemo(() => [
    {
      id: 'first_task',
      title: 'First Steps',
      description: 'Complete your first task',
      icon: CheckIcon,
      color: 'text-[#CDE9D2]',
      bg: 'bg-[#CDE9D2]/10',
      unlocked: completedTasks >= 1,
      progress: Math.min(completedTasks, 1),
      total: 1,
    },
    {
      id: 'task_10',
      title: 'Getting Things Done',
      description: 'Complete 10 tasks',
      icon: Target,
      color: 'text-primary',
      bg: 'bg-primary/10',
      unlocked: completedTasks >= 10,
      progress: Math.min(completedTasks, 10),
      total: 10,
    },
    {
      id: 'task_50',
      title: 'Productivity Pro',
      description: 'Complete 50 tasks',
      icon: Star,
      color: 'text-yellow-500',
      bg: 'bg-yellow-50',
      unlocked: completedTasks >= 50,
      progress: Math.min(completedTasks, 50),
      total: 50,
    },
    {
      id: 'focus_60',
      title: 'Focus Starter',
      description: 'Accumulate 60 minutes of focus',
      icon: Timer,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
      unlocked: totalFocusMinutes >= 60,
      progress: Math.min(totalFocusMinutes, 60),
      total: 60,
    },
    {
      id: 'focus_600',
      title: 'Deep Worker',
      description: 'Accumulate 10 hours of focus',
      icon: Zap,
      color: 'text-indigo-500',
      bg: 'bg-indigo-50',
      unlocked: totalFocusMinutes >= 600,
      progress: Math.min(totalFocusMinutes, 600),
      total: 600,
    },
    {
      id: 'streak_7',
      title: 'Habit Streak',
      description: 'Maintain a 7-day habit streak',
      icon: Flame,
      color: 'text-orange-500',
      bg: 'bg-orange-50',
      unlocked: bestStreak >= 7,
      progress: Math.min(bestStreak, 7),
      total: 7,
    },
    {
      id: 'streak_30',
      title: 'Habit Master',
      description: 'Maintain a 30-day habit streak',
      icon: Award,
      color: 'text-rose-500',
      bg: 'bg-rose-50',
      unlocked: bestStreak >= 30,
      progress: Math.min(bestStreak, 30),
      total: 30,
    },
    {
      id: 'habit_5',
      title: 'Habit Builder',
      description: 'Create 5 habits',
      icon: Repeat2,
      color: 'text-accent',
      bg: 'bg-accent/10',
      unlocked: habits.length >= 5,
      progress: Math.min(habits.length, 5),
      total: 5,
    },
    {
      id: 'level_5',
      title: 'Rising Star',
      description: 'Reach level 5',
      icon: Trophy,
      color: 'text-yellow-600',
      bg: 'bg-yellow-100',
      unlocked: level >= 5,
      progress: Math.min(level, 5),
      total: 5,
    },
  ], [completedTasks, totalFocusMinutes, bestStreak, habits.length, level])

  const unlockedCount = badges.filter((b) => b.unlocked).length

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div>
          <h1 className="text-xl font-serif font-bold text-foreground">Achievements</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {unlockedCount} of {badges.length} unlocked
          </p>
        </div>
        <Trophy className="w-5 h-5 text-yellow-500" />
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Level + XP card */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
            className="bg-card border border-border rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Level</p>
                  <p className="text-2xl font-bold text-foreground">Level {level}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total XP</p>
                <p className="text-2xl font-bold text-primary">{xp}</p>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{xp % xpForNext} XP</span>
                <span>{xpForNext} XP to Level {level + 1}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${xpProgress * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  className="h-full bg-primary rounded-full"
                />
              </div>
            </div>
          </motion.div>

          {/* Badges grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {badges.map((badge, i) => (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05, duration: 0.25 }}
                className={cn(
                  'bg-card border border-border rounded-2xl p-4 transition-smooth',
                  badge.unlocked
                    ? 'hover:shadow-md hover:-translate-y-0.5'
                    : 'opacity-50 grayscale'
                )}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={cn('p-2.5 rounded-xl shrink-0', badge.bg)}>
                    <badge.icon className={cn('w-5 h-5', badge.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{badge.title}</p>
                    <p className="text-xs text-muted-foreground leading-snug">{badge.description}</p>
                  </div>
                  {badge.unlocked && (
                    <span className="text-xs bg-[#CDE9D2]/20 text-[#CDE9D2] px-2 py-0.5 rounded-full font-medium shrink-0">
                      Done
                    </span>
                  )}
                </div>
                {badge.total && (
                  <>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', badge.unlocked ? 'bg-[#CDE9D2]' : 'bg-muted-foreground/30')}
                        style={{ width: `${((badge.progress ?? 0) / badge.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{badge.progress}/{badge.total}</p>
                  </>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}
