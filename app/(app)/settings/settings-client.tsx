'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  User,
  Bell,
  Shield,
  Save,
  CheckCircle2,
  Languages,
  Sparkles,
  Trash2,
  SlidersHorizontal,
  Settings,
  Bookmark,
  Loader2,
  Bug,
  Lightbulb,
  CalendarDays,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { useI18n, type Locale } from '@/lib/i18n'
import { PageHeader } from '@/components/page-header'
import { VoiceSettingsPanel } from '@/components/voice-settings-panel'
import { CoachSettingsPanel } from '@/components/coach/coach-settings-panel'
import { PushSettingsPanel } from '@/components/push-settings-panel'
import { CalendarConnections } from '@/components/calendar-connections'
import { InstallAppButton } from '@/components/install-app-button'
import { useAppInstall } from '@/lib/use-app-install'
import { useVoicePrefs } from '@/lib/voice-preferences'
import { isMemoryEnabled, setMemoryEnabled } from '@/lib/memory'
import { KEYBOARD_SHORTCUTS } from '@/lib/shortcuts'
import { FeedbackDialog } from '@/components/feedback/feedback-dialog'
import { BetaBadge } from '@/components/beta-badge'
import { KinLogoMark } from '@/components/kin-logo'
import { APP_VERSION_LABEL } from '@/lib/version'
import type { FeedbackKind } from '@/lib/feedback'

interface Memory {
  id: string
  content: string
  category: string
  created_at: string
}

interface Props {
  profile: { id: string; display_name?: string | null } | null
  user: { email: string }
  userId: string
  memories: Memory[]
  /** Rendered inside the floating Settings window: no page header. */
  embedded?: boolean
}

interface Category {
  id: string
  icon: React.ElementType
  title: string
  desc?: string
  content: React.ReactNode
}

export function SettingsClient({ profile, user, userId, memories: initialMemories, embedded }: Props) {
  const [memories, setMemories] = useState<Memory[]>(initialMemories)
  const [deletingMemory, setDeletingMemory] = useState<string | null>(null)
  const [memoryEnabled, setMemoryEnabledState] = useState(isMemoryEnabled())
  const [clearingMemory, setClearingMemory] = useState(false)
  const [newMemory, setNewMemory] = useState('')
  const [memoryCategory, setMemoryCategory] = useState('fact')
  const [savingMemory, setSavingMemory] = useState(false)
  const [memoryError, setMemoryError] = useState<string | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackKind, setFeedbackKind] = useState<FeedbackKind>('bug')
  const [feedbackCount, setFeedbackCount] = useState(0)
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const { t, locale, setLocale } = useI18n()
  const supabase = createClient()

  // Drill-in navigation: Paramètres → catégorie → (← retour).
  const [category, setCategory] = useState<string | null>(null)

  const voicePrefs = useVoicePrefs()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const { canInstall, installed: appInstalled } = useAppInstall()

  const openFeedback = (kind: FeedbackKind) => {
    setFeedbackKind(kind)
    setFeedbackCount((c) => c + 1)
    setFeedbackOpen(true)
  }

  const deleteMemory = async (id: string) => {
    setDeletingMemory(id)
    try {
      const { error } = await supabase.from('ai_memories').delete().eq('id', id)
      if (!error) setMemories((prev) => prev.filter((m) => m.id !== id))
    } finally {
      setDeletingMemory(null)
    }
  }

  const toggleMemory = (next: boolean) => {
    setMemoryEnabledState(next)
    setMemoryEnabled(next)
  }

  const addMemory = async () => {
    const content = newMemory.trim()
    if (!content) return
    if (content.length > 500) {
      setMemoryError('Maximum 500 caractères.')
      return
    }
    setSavingMemory(true)
    setMemoryError(null)
    try {
      const { data, error } = await supabase
        .from('ai_memories')
        .insert({ user_id: userId, content, category: memoryCategory })
        .select('id, content, category, created_at')
        .single()
      if (error) {
        setMemoryError('Impossible d’enregistrer ce souvenir. Réessaie dans un instant.')
        return
      }
      setMemories((prev) => [data as Memory, ...prev])
      setNewMemory('')
    } finally {
      setSavingMemory(false)
    }
  }

  const clearAllMemories = async () => {
    if (memories.length === 0) return
    if (!window.confirm('Effacer toute la mémoire de l’assistant ? Cette action est définitive.')) return
    setClearingMemory(true)
    try {
      const { error } = await supabase.from('ai_memories').delete().eq('user_id', userId)
      if (!error) setMemories([])
    } finally {
      setClearingMemory(false)
    }
  }

  const changePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setPwMessage({ type: 'error', text: t('settings.pwTooShort') })
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: 'error', text: t('settings.pwMismatch') })
      return
    }
    setPwSaving(true)
    setPwMessage(null)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setPwMessage({ type: 'error', text: error.message })
      } else {
        setNewPassword('')
        setConfirmPassword('')
        setPwMessage({ type: 'success', text: t('settings.pwUpdated') })
      }
    } catch {
      setPwMessage({ type: 'error', text: t('settings.pwError') })
    } finally {
      setPwSaving(false)
    }
  }

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

  const switchLocale = (next: Locale) => setLocale(next)

  // Échap dans la fenêtre Paramètres : retourne d'abord à la liste des
  // catégories, ne ferme la fenêtre que si on est déjà sur la racine.
  useEffect(() => {
    const onEscape = (e: Event) => {
      if (category) {
        e.preventDefault()
        setCategory(null)
      }
    }
    window.addEventListener('kininaru:settings-escape', onEscape)
    return () => window.removeEventListener('kininaru:settings-escape', onEscape)
  }, [category])

  const categories: Category[] = [
    {
      id: 'compte',
      icon: User,
      title: t('settings.profile'),
      desc: t('settings.profileDesc'),
      content: (
        <div className="space-y-5">
          <div className="space-y-4">
            <div>
              <Label>{t('settings.displayName')}</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1"
                placeholder={t('settings.displayNamePlaceholder')}
              />
            </div>
            <div>
              <Label>{t('settings.email')}</Label>
              <Input value={user.email} disabled className="mt-1 opacity-60" />
            </div>
            <Button
              onClick={save}
              disabled={saving}
              className={cn('gap-2', saved && 'bg-kin-sage hover:bg-kin-sage')}
            >
              <Save className="w-4 h-4" />
              {saving ? t('settings.saving') : saved ? t('settings.saved') : t('settings.save')}
            </Button>
          </div>

          <div className="border-t border-border pt-5">
            <Label className="mb-3 block">{t('settings.newPassword')}</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('settings.newPassword')}
                />
              </div>
              <div>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('settings.confirmPassword')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') changePassword()
                  }}
                />
              </div>
            </div>
            {pwMessage && (
              <p className={cn('text-sm mt-2', pwMessage.type === 'success' ? 'text-kin-sage' : 'text-destructive')}>
                {pwMessage.text}
              </p>
            )}
            <Button variant="outline" size="sm" onClick={changePassword} disabled={pwSaving} className="mt-3">
              {pwSaving ? t('settings.saving') : t('settings.changePassword')}
            </Button>
          </div>
        </div>
      ),
    },
    {
      id: 'notifications',
      icon: Bell,
      title: t('settings.notifications'),
      desc: 'Vraies notifications Web Push — même quand l’application est fermée.',
      content: <PushSettingsPanel />,
    },
    {
      id: 'assistant',
      icon: Sparkles,
      title: t('settings.coach'),
      desc: t('settings.coachDesc'),
      content: (
        <div className="space-y-5">
          <CoachSettingsPanel />
          <div className="border-t border-border pt-5">
            <VoiceSettingsPanel
              prefs={voicePrefs.prefs}
              onChange={voicePrefs.setPrefs}
              voices={voicePrefs.voices}
              voicesLoaded={voicePrefs.voicesLoaded}
            />
          </div>
        </div>
      ),
    },
    {
      id: 'memoire',
      icon: Bookmark,
      title: t('settings.memory'),
      desc: t('settings.memoryDesc'),
      content: (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 py-1">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Mémoire : {memoryEnabled ? 'ON' : 'OFF'}</p>
              <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                {memoryEnabled
                  ? 'L’assistant peut utiliser tes souvenirs enregistrés pour personnaliser ses réponses.'
                  : 'L’assistant n’utilise plus tes souvenirs. Ils restent enregistrés jusqu’à ce que tu les supprimes.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={memoryEnabled}
              onClick={() => toggleMemory(!memoryEnabled)}
              className={cn(
                'relative w-10 h-6 rounded-full transition-smooth shrink-0 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
                memoryEnabled ? 'bg-primary' : 'bg-muted'
              )}
              aria-label="Activer ou désactiver la mémoire de l’assistant"
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
                  memoryEnabled && 'translate-x-4'
                )}
              />
            </button>
          </div>

          <div className="rounded-xl border border-border bg-background/60 p-3">
            <p className="text-sm font-medium text-foreground mb-1">Que doit savoir le Coach sur moi ?</p>
            <p className="text-xs text-muted-foreground leading-snug mb-2.5">
              Un fait durable qui t’aide à avancer (ex. « Je prépare le CAP cuisine en juin »,
              « Je travaille mieux le matin »). Rien n’est partagé — utilisé uniquement comme
              contexte dans tes conversations, et supprimable à tout moment.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={newMemory}
                onChange={(e) => setNewMemory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) void addMemory()
                }}
                placeholder="Ex. : Je prépare le CAP cuisine en juin…"
                maxLength={500}
                className="flex-1"
                aria-label="Ajouter un souvenir"
              />
              <select
                value={memoryCategory}
                onChange={(e) => setMemoryCategory(e.target.value)}
                className="h-9 px-2.5 text-sm bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring transition-smooth"
                aria-label="Catégorie du souvenir"
              >
                {['fact', 'goal', 'preference', 'habit', 'other'].map((c) => (
                  <option key={c} value={c}>
                    {c === 'fact'
                      ? 'Fait'
                      : c === 'goal'
                        ? 'Objectif'
                        : c === 'preference'
                          ? 'Préférence'
                          : c === 'habit'
                            ? 'Habitude'
                            : 'Autre'}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                onClick={() => void addMemory()}
                disabled={savingMemory || newMemory.trim().length === 0}
                className="gap-1.5 shrink-0"
              >
                {savingMemory ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Bookmark className="w-3.5 h-3.5" />
                )}
                Mémoriser
              </Button>
            </div>
            {memoryError && <p className="text-xs text-destructive mt-2">{memoryError}</p>}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Voir mes souvenirs</p>
            {memories.length > 0 && (
              <button
                onClick={() => void clearAllMemories()}
                disabled={clearingMemory}
                className="flex items-center gap-1.5 text-xs font-medium text-destructive hover:underline transition-smooth disabled:opacity-50"
              >
                {clearingMemory ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
                Effacer toute la mémoire
              </button>
            )}
          </div>

          {memories.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('settings.memoryEmpty')}</p>
          ) : (
            <ul className="space-y-2">
              {memories.map((m) => (
                <li
                  key={m.id}
                  className="flex items-start gap-3 rounded-xl border border-border bg-background/60 p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-relaxed break-words">{m.content}</p>
                    <p className="text-[11px] text-muted-foreground/80 mt-1">
                      {m.category} ·{' '}
                      {new Date(m.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteMemory(m.id)}
                    disabled={deletingMemory === m.id}
                    className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-smooth disabled:opacity-50"
                    aria-label={t('settings.memoryDelete')}
                    title={t('settings.memoryDelete')}
                  >
                    {deletingMemory === m.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ),
    },
    {
      id: 'calendrier',
      icon: CalendarDays,
      title: 'Calendriers',
      desc: 'Vos calendriers externes (Google, Outlook, iCloud) dans Kininaru.',
      content: <CalendarConnections />,
    },
    {
      id: 'langue',
      icon: Languages,
      title: t('settings.language'),
      desc: t('settings.languageDesc'),
      content: (
        <div className="flex flex-col gap-2">
          {(['fr', 'en'] as Locale[]).map((l) => (
            <button
              key={l}
              onClick={() => switchLocale(l)}
              className={cn(
                'flex items-center justify-between px-4 py-3 rounded-xl border-2 text-sm font-medium transition-smooth',
                locale === l
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
              )}
            >
              <span>{l === 'fr' ? 'Français' : 'English'}</span>
              {locale === l && <CheckCircle2 className="w-4 h-4 text-primary" />}
            </button>
          ))}
        </div>
      ),
    },
    {
      id: 'application',
      icon: SlidersHorizontal,
      title: 'Application',
      desc: 'Installation, raccourcis, version et retours.',
      content: (
        <div className="space-y-6">
          <div>
            {appInstalled ? (
              <div className="flex items-center gap-2 text-sm text-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                {t('install.installedOn')}
              </div>
            ) : (
              <>
                <InstallAppButton variant="card" />
                {!canInstall && (
                  <p className="text-xs text-muted-foreground/80 mt-2">{t('settings.installIos')}</p>
                )}
              </>
            )}
          </div>

          <div className="border-t border-border pt-5">
            <Label className="mb-3 block">Raccourcis clavier</Label>
            <ul className="space-y-2">
              {KEYBOARD_SHORTCUTS.map((s) => (
                <li
                  key={s.keys.join('-')}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/60 px-3.5 py-2.5"
                >
                  <span className="text-sm text-foreground/90">{s.label}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    {s.keys.map((k) => (
                      <kbd
                        key={k}
                        className="inline-flex items-center justify-center min-w-7 h-7 px-1.5 rounded-lg bg-muted text-xs font-medium text-foreground border border-border"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-border pt-5">
            <Label className="mb-3 block">Aider à améliorer Kininaru</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => openFeedback('bug')}
                className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-4 py-3.5 text-left hover:border-destructive/40 hover:bg-destructive/5 transition-smooth group"
              >
                <span className="w-9 h-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Bug className="w-4 h-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">Signaler un bug</span>
                  <span className="block text-xs text-muted-foreground">Un problème à corriger</span>
                </span>
              </button>
              <button
                onClick={() => openFeedback('suggestion')}
                className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-4 py-3.5 text-left hover:border-primary/40 hover:bg-primary/5 transition-smooth group"
              >
                <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Lightbulb className="w-4 h-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">Envoyer une suggestion</span>
                  <span className="block text-xs text-muted-foreground">Une idée pour améliorer Kininaru</span>
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <KinLogoMark />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                Kininaru
                <BetaBadge />
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Version {APP_VERSION_LABEL}</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'confidentialite',
      icon: Shield,
      title: t('settings.deleteAccount'),
      desc: t('settings.securityDesc'),
      content: (
        <div className="space-y-5">
          <div className="rounded-xl bg-destructive/5 border border-destructive/15 p-4">
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">{t('settings.deleteAccountDesc')}</p>
            <Link
              href="/legal/suppression-compte"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive hover:underline transition-smooth"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t('settings.deleteAccountLink')}
            </Link>
          </div>
        </div>
      ),
    },
  ]

  const active = categories.find((c) => c.id === category) ?? null

  return (
    <>
      <div className="flex flex-col h-full">
        {!embedded && (
          <PageHeader icon={Settings} title={t('settings.title')} subtitle={t('settings.subtitle')} />
        )}

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto">
            <AnimatePresence mode="wait" initial={false}>
              {!active ? (
                <motion.div
                  key="list"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden"
                >
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCategory(c.id)}
                      className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition-smooth hover:bg-muted/60 active:bg-muted"
                    >
                      <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <c.icon className="w-[18px] h-[18px]" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-foreground">{c.title}</span>
                        {c.desc && (
                          <span className="block text-xs text-muted-foreground truncate mt-0.5">{c.desc}</span>
                        )}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key={active.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  <button
                    onClick={() => setCategory(null)}
                    className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-smooth mb-4"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t('settings.title')}
                  </button>
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <active.icon className="w-4 h-4" />
                    </span>
                    <h2 className="kin-h3 text-foreground">{active.title}</h2>
                  </div>
                  {active.desc && <p className="text-xs text-muted-foreground mb-4">{active.desc}</p>}
                  {active.content}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <FeedbackDialog
        key={`${feedbackKind}-${feedbackCount}`}
        open={feedbackOpen}
        kind={feedbackKind}
        onOpenChange={setFeedbackOpen}
      />
    </>
  )
}
