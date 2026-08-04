'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { User, Mail, Palette, Bell, Shield, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const THEMES = [
  { label: 'Rose Doux', value: 'rose', colors: ['#FFF9FC', '#F6B7D2', '#CDB8FF'] },
  { label: 'Lavande', value: 'lavender', colors: ['#FFF4F8', '#CDB8FF', '#BFDFFF'] },
  { label: 'Sauge', value: 'sage', colors: ['#FFF9FC', '#CDE9D2', '#FFF1B6'] },
]

interface Props {
  profile: any
  user: { email: string }
}

export function SettingsClient({ profile, user }: Props) {
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  const save = async () => {
    setSaving(true)
    await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', profile?.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const sections = [
    {
      icon: User,
      title: 'Profile',
      content: (
        <div className="space-y-4">
          <div>
            <Label>Display Name</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1"
              placeholder="Your name"
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={user.email} disabled className="mt-1 opacity-60" />
          </div>
          <Button
            onClick={save}
            disabled={saving}
            className={cn('gap-2', saved && 'bg-[#CDE9D2] hover:bg-[#CDE9D2]')}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </div>
      ),
    },
    {
      icon: Palette,
      title: 'Appearance',
      content: (
        <div className="space-y-4">
          <div>
            <Label className="mb-3 block">Theme</Label>
            <div className="flex gap-3">
              {THEMES.map((theme) => (
                <button
                  key={theme.value}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-border hover:border-primary transition-smooth"
                >
                  <div className="flex gap-1">
                    {theme.colors.map((c, i) => (
                      <div key={i} className="w-5 h-5 rounded-full" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{theme.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: Bell,
      title: 'Notifications',
      content: (
        <div className="space-y-3">
          {[
            { label: 'Task reminders', description: 'Get notified about upcoming deadlines' },
            { label: 'Habit reminders', description: 'Daily nudges for your habits' },
            { label: 'Focus session end', description: 'Alert when a Pomodoro session ends' },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <button className="relative w-10 h-5 rounded-full bg-primary transition-smooth">
                <span className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
              </button>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: Shield,
      title: 'Security',
      content: (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Your account is protected with Supabase Auth. To change your password, use the link below.
            </p>
            <Button variant="outline" size="sm">
              Change Password
            </Button>
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div>
          <h1 className="text-xl font-serif font-bold text-foreground">Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage your account and preferences</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {sections.map((section, i) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.25 }}
              className="bg-card border border-border rounded-2xl p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <section.icon className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
              </div>
              {section.content}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
