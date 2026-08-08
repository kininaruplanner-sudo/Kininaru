'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { User, Palette, Bell, Shield, Save, AlertTriangle, Trash2, X, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resetAnalytics } from '@/lib/analytics'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { THEMES, useTheme } from '@/components/theme-provider'
import { cardVariants } from '@/components/ui/card'

interface NotificationPrefs {
  task_reminders: boolean
  habit_reminders: boolean
  focus_session_end: boolean
}

interface Props {
  profile: {
    id: string
    display_name?: string | null
    notification_prefs?: NotificationPrefs | null
  } | null
  user: { email: string }
}

const DEFAULT_PREFS: NotificationPrefs = {
  task_reminders: true,
  habit_reminders: true,
  focus_session_end: true,
}

const NOTIFICATION_ITEMS: { key: keyof NotificationPrefs; label: string; description: string }[] = [
  { key: 'task_reminders', label: 'Rappels de tâches', description: "Être notifié des échéances à venir" },
  { key: 'habit_reminders', label: "Rappels d'habitudes", description: 'Relances quotidiennes pour vos habitudes' },
  { key: 'focus_session_end', label: 'Fin de session Focus', description: "Alerte quand une session Pomodoro se termine" },
]

export function SettingsClient({ profile, user }: Props) {
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [profileError, setProfileError] = useState('')

  const [prefs, setPrefs] = useState<NotificationPrefs>(profile?.notification_prefs ?? DEFAULT_PREFS)
  const [prefsError, setPrefsError] = useState('')
  const [savingPrefKey, setSavingPrefKey] = useState<string | null>(null)

  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [passwordError, setPasswordError] = useState('')

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const { theme, setTheme } = useTheme()
  const supabase = createClient()
  const router = useRouter()

  const save = async () => {
    setSaving(true)
    setProfileError('')
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', profile?.id)
    setSaving(false)
    if (error) {
      setProfileError("Impossible d'enregistrer le nom pour le moment. Réessayez dans un instant.")
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const toggleNotification = async (key: keyof NotificationPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setPrefsError('')
    setSavingPrefKey(key)
    const { error } = await supabase
      .from('profiles')
      .update({ notification_prefs: next })
      .eq('id', profile?.id)
    setSavingPrefKey(null)
    if (error) {
      // Revert on failure so the toggle reflects what's actually saved.
      setPrefs(prefs)
      setPrefsError("La préférence n'a pas pu être enregistrée. Réessayez.")
    }
  }

  const requestPasswordReset = async () => {
    setPasswordStatus('sending')
    setPasswordError('')
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    if (error) {
      setPasswordStatus('error')
      setPasswordError("Impossible d'envoyer l'e-mail de réinitialisation. Réessayez plus tard.")
      return
    }
    setPasswordStatus('sent')
  }

  const deleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'SUPPRIMER') return
    setDeleting(true)
    setDeleteError('')
    const { error } = await supabase.rpc('delete_user_account')
    if (error) {
      setDeleting(false)
      setDeleteError(
        "La suppression a échoué. Si le problème persiste, contactez le support ou consultez la page de suppression de compte."
      )
      return
    }
    await supabase.auth.signOut()
    resetAnalytics()
    router.push('/')
    router.refresh()
  }

  const sections = [
    {
      icon: User,
      title: 'Profil',
      content: (
        <div className="space-y-4">
          <div>
            <Label>Nom affiché</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1"
              placeholder="Votre nom"
            />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input value={user.email} disabled className="mt-1 opacity-60" />
          </div>
          {profileError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-destructive/10 text-destructive text-sm" role="alert">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{profileError}</p>
            </div>
          )}
          <Button
            onClick={save}
            disabled={saving}
            className={cn('gap-2', saved && 'bg-kin-sage hover:bg-kin-sage')}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Enregistrement...' : saved ? 'Enregistré !' : 'Enregistrer'}
          </Button>
        </div>
      ),
    },
    {
      icon: Palette,
      title: 'Apparence',
      content: (
        <div className="space-y-4">
          <div>
            <Label className="mb-3 block">Thème</Label>
            <div className="flex flex-wrap gap-3">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTheme(t.value)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-smooth',
                    theme === t.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary'
                  )}
                >
                  <div className="flex gap-1">
                    {t.swatches.map((c, i) => (
                      <div key={i} className="w-5 h-5 rounded-full" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{t.label}</span>
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
          {prefsError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-destructive/10 text-destructive text-sm" role="alert">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{prefsError}</p>
            </div>
          )}
          {NOTIFICATION_ITEMS.map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <button
                onClick={() => toggleNotification(item.key)}
                disabled={savingPrefKey === item.key}
                aria-pressed={prefs[item.key]}
                aria-label={item.label}
                className={cn(
                  'relative w-10 h-5 rounded-full transition-smooth disabled:opacity-60',
                  prefs[item.key] ? 'bg-primary' : 'bg-muted'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-kin transition-smooth',
                    prefs[item.key] ? 'right-0.5' : 'left-0.5'
                  )}
                />
              </button>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: Shield,
      title: 'Sécurité',
      content: (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Votre compte est protégé par Supabase Auth. Pour changer de mot de passe, un e-mail de
              réinitialisation vous sera envoyé à {user.email}.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={requestPasswordReset}
              disabled={passwordStatus === 'sending' || passwordStatus === 'sent'}
              className="gap-2"
            >
              <Mail className="w-4 h-4" />
              {passwordStatus === 'sending' && 'Envoi...'}
              {passwordStatus === 'sent' && 'E-mail envoyé !'}
              {(passwordStatus === 'idle' || passwordStatus === 'error') && 'Changer le mot de passe'}
            </Button>
            {passwordStatus === 'error' && (
              <p className="text-xs text-destructive mt-2">{passwordError}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      icon: AlertTriangle,
      title: 'Zone de danger',
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Supprimer votre compte efface définitivement votre profil, vos tâches, événements, habitudes,
            entrées de journal et sessions de concentration. Cette action est irréversible.{' '}
            <Link href="/legal/suppression-compte" className="text-primary hover:underline">
              En savoir plus
            </Link>
            .
          </p>
          {!showDeleteConfirm ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer mon compte
            </Button>
          ) : (
            <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-foreground">
                  Tapez <span className="font-semibold">SUPPRIMER</span> pour confirmer la suppression
                  définitive de votre compte.
                </p>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setDeleteConfirmText('')
                    setDeleteError('')
                  }}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="SUPPRIMER"
                className="max-w-xs"
              />
              {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteAccount}
                disabled={deleteConfirmText.trim().toUpperCase() !== 'SUPPRIMER' || deleting}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Suppression...' : 'Confirmer la suppression définitive'}
              </Button>
            </div>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div>
          <h1 className="text-xl font-serif font-bold text-foreground">Paramètres</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Gérez votre compte et vos préférences</p>
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
              className={cn(
                cardVariants({ padding: 'md' }),
                section.title === 'Zone de danger' && 'border-destructive/30'
              )}
            >
              <div className="flex items-center gap-2 mb-4">
                <section.icon className={cn('w-4 h-4', section.title === 'Zone de danger' ? 'text-destructive' : 'text-primary')} />
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
