'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  CalendarDays,
  CheckSquare,
  Target,
  Bell,
  Plus,
  Shield,
  LayoutDashboard,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cardVariants } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { CreateFamilyModal } from './create-family-modal'
import { JoinFamilyModal } from './join-family-modal'
import { FamilyHeader } from './family-header'
import { FamilyMembersTab } from './family-members-tab'
import { FamilyCalendarTab } from './family-calendar-tab'
import { FamilyTasksTab } from './family-tasks-tab'
import { FamilyGoalsTab } from './family-goals-tab'
import type {
  Family,
  FamilyEvent,
  FamilyGoal,
  FamilyMember,
  FamilyNotification,
  FamilyRole,
  FamilyTask,
} from './types'

const FEATURES = [
  {
    icon: CalendarDays,
    title: 'Calendrier partagé',
    description: "Un agenda commun pour les événements de toute la famille",
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    icon: CheckSquare,
    title: 'Tâches familiales',
    description: 'Assignez des tâches à chacun et suivez la progression ensemble',
    color: 'text-kin-sage',
    bg: 'bg-kin-sage/10',
  },
  {
    icon: Bell,
    title: 'Notifications',
    description: "Restez informé des événements et tâches importants de la famille",
    color: 'text-accent',
    bg: 'bg-accent/10',
  },
  {
    icon: Shield,
    title: 'Rôles Parent / Enfant',
    description: 'Gérez les permissions et validez les actions des plus jeunes',
    color: 'text-secondary-foreground',
    bg: 'bg-secondary/50',
  },
]

type Tab = 'apercu' | 'membres' | 'calendrier' | 'taches' | 'objectifs'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'apercu', label: 'Aperçu', icon: LayoutDashboard },
  { id: 'membres', label: 'Membres', icon: Users },
  { id: 'calendrier', label: 'Calendrier', icon: CalendarDays },
  { id: 'taches', label: 'Tâches', icon: CheckSquare },
  { id: 'objectifs', label: 'Objectifs', icon: Target },
]

interface Props {
  userId: string
  family: Family | null
  currentRole: FamilyRole | null
  members: FamilyMember[]
  events: FamilyEvent[]
  tasks: FamilyTask[]
  goals: FamilyGoal[]
  notifications: FamilyNotification[]
}

export function FamilyClient({
  userId,
  family,
  currentRole,
  members,
  events,
  tasks,
  goals,
  notifications,
}: Props) {
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [tab, setTab] = useState<Tab>('apercu')

  if (!family || !currentRole) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <div>
            <h1 className="text-xl font-serif font-bold text-foreground">Famille</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Collaborez avec votre famille</p>
          </div>
          <Users className="w-5 h-5 text-muted-foreground" />
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-center py-8 mb-8"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-serif font-bold text-foreground mb-2">Mode Famille</h2>
              <p className="text-muted-foreground mb-6">
                Créez ou rejoignez un groupe familial pour partager calendrier, tâches et
                objectifs avec les personnes qui comptent le plus.
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button className="gap-2" onClick={() => setShowCreate(true)}>
                  <Plus className="w-4 h-4" />
                  Créer une famille
                </Button>
                <Button variant="outline" onClick={() => setShowJoin(true)}>
                  Rejoindre avec un code
                </Button>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FEATURES.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.07, duration: 0.25 }}
                  className={cn(cardVariants({ padding: 'md', hover: true }), 'hover:-translate-y-0.5')}
                >
                  <div className={`inline-flex p-2.5 rounded-xl mb-3 ${feature.bg}`}>
                    <feature.icon className={`w-5 h-5 ${feature.color}`} />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <CreateFamilyModal open={showCreate} onClose={() => setShowCreate(false)} />
        <JoinFamilyModal open={showJoin} onClose={() => setShowJoin(false)} />
      </div>
    )
  }

  const isParent = currentRole === 'parent'
  const pendingTasks = tasks.filter((t) => t.status !== 'done')
  const activeGoals = goals.filter((g) => g.status !== 'completed')
  const nextEvent = events
    .filter((e) => new Date(e.end_at) >= new Date())
    .sort((a, b) => a.start_at.localeCompare(b.start_at))[0]

  return (
    <div className="flex flex-col h-full">
      <FamilyHeader
        family={family}
        currentRole={currentRole}
        memberCount={members.length}
        notifications={notifications}
      />

      <div className="flex gap-1 overflow-x-auto border-b border-border bg-card px-4 sm:px-6">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-xs font-medium border-b-2 transition-smooth -mb-px',
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="size-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          {tab === 'apercu' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className={cn(cardVariants({ padding: 'sm' }))}>
                  <Users className="size-4 text-primary" />
                  <p className="mt-2 font-serif text-lg font-bold text-foreground">
                    {members.length}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Membres</p>
                </div>
                <div className={cn(cardVariants({ padding: 'sm' }))}>
                  <CheckSquare className="size-4 text-kin-sage" />
                  <p className="mt-2 font-serif text-lg font-bold text-foreground">
                    {pendingTasks.length}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Tâches en cours</p>
                </div>
                <div className={cn(cardVariants({ padding: 'sm' }))}>
                  <Target className="size-4 text-kin-coral" />
                  <p className="mt-2 font-serif text-lg font-bold text-foreground">
                    {activeGoals.length}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Objectifs actifs</p>
                </div>
                <div className={cn(cardVariants({ padding: 'sm' }))}>
                  <CalendarDays className="size-4 text-kin-blue" />
                  <p className="mt-2 font-serif text-sm font-bold text-foreground truncate">
                    {nextEvent ? nextEvent.title : 'Aucun'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Prochain événement</p>
                </div>
              </div>

              <div className={cn(cardVariants({ padding: 'md' }))}>
                <h3 className="text-sm font-semibold text-foreground mb-3">Membres</h3>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <span
                      key={m.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs text-foreground"
                    >
                      {m.display_name}
                      <span className="text-muted-foreground">
                        · {m.role === 'parent' ? 'Parent' : 'Enfant'}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'membres' && (
            <FamilyMembersTab
              members={members}
              userId={userId}
              currentRole={currentRole}
              inviteCode={family.invite_code}
            />
          )}

          {tab === 'calendrier' && (
            <FamilyCalendarTab
              events={events}
              familyId={family.id}
              userId={userId}
              isParent={isParent}
            />
          )}

          {tab === 'taches' && (
            <FamilyTasksTab
              tasks={tasks}
              members={members}
              familyId={family.id}
              userId={userId}
              isParent={isParent}
            />
          )}

          {tab === 'objectifs' && (
            <FamilyGoalsTab
              goals={goals}
              familyId={family.id}
              userId={userId}
              isParent={isParent}
            />
          )}
        </div>
      </div>
    </div>
  )
}
