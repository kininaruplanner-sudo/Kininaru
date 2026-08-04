'use client'

import { motion } from 'framer-motion'
import { Users, CalendarDays, CheckSquare, Bell, Plus, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { cardVariants } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const FEATURES = [
  {
    icon: CalendarDays,
    title: 'Shared Calendar',
    description: 'View and manage events for the whole family in one place',
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    icon: CheckSquare,
    title: 'Family Tasks',
    description: 'Assign tasks to family members and track progress together',
    color: 'text-kin-sage',
    bg: 'bg-kin-sage/10',
  },
  {
    icon: Bell,
    title: 'Notifications',
    description: 'Get notified about important family events and reminders',
    color: 'text-accent',
    bg: 'bg-accent/10',
  },
  {
    icon: Shield,
    title: 'Parental Controls',
    description: 'Set permissions and validate tasks for younger family members',
    color: 'text-secondary-foreground',
    bg: 'bg-secondary/50',
  },
]

export default function FamilyPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div>
          <h1 className="text-xl font-serif font-bold text-foreground">Family</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Collaborate with your family</p>
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
            <h2 className="text-2xl font-serif font-bold text-foreground mb-2">
              Family Mode
            </h2>
            <p className="text-muted-foreground mb-6">
              Create or join a family group to share calendars, tasks, and stay connected with the people that matter most.
            </p>
            <div className="flex gap-3 justify-center">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Create Family Group
              </Button>
              <Button variant="outline">Join a Group</Button>
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
                <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
