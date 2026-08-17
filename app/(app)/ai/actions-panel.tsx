'use client'

import { useState } from 'react'
import {
  CheckSquare,
  ListChecks,
  Repeat2,
  CalendarDays,
  Users,
  Bookmark,
  Target,
  Check,
  X,
  Pencil,
  Loader2,
  Sparkles,
  AlertCircle,
} from 'lucide-react'
import type { AiAction } from '@/lib/ai/actions'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** An action proposed by the model, with a stable client-side id. */
export interface PendingAction {
  id: string
  action: AiAction
}

type CardStatus = 'pending' | 'working' | 'done' | 'error'

const META: Record<AiAction['action'], { label: string; icon: React.ElementType }> = {
  create_task: { label: 'Créer une tâche', icon: CheckSquare },
  create_tasks_batch: { label: 'Découper en étapes', icon: ListChecks },
  create_objective: { label: 'Créer un objectif + étapes', icon: Target },
  create_goal: { label: 'Créer un objectif', icon: Target },
  create_habit: { label: 'Créer une habitude', icon: Repeat2 },
  create_event: { label: 'Créer un événement', icon: CalendarDays },
  create_family_task: { label: 'Tâche familiale', icon: Users },
  create_memory: { label: 'Mémoriser', icon: Bookmark },
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  urgent: 'Urgente',
}

const CATEGORY_LABELS: Record<string, string> = {
  fact: 'Fait',
  goal: 'Objectif',
  preference: 'Préférence',
  habit: 'Habitude',
  other: 'Autre',
}

function actionSummary(a: AiAction): string[] {
  switch (a.action) {
    case 'create_task': {
      const lines = [`« ${a.data.title} »`]
      if (a.data.priority) lines.push(`Priorité : ${PRIORITY_LABELS[a.data.priority] ?? a.data.priority}`)
      if (a.data.due_date) lines.push(`Échéance : ${a.data.due_date}`)
      if (a.data.tags?.length) lines.push(`Étiquettes : ${a.data.tags.join(', ')}`)
      return lines
    }
    case 'create_tasks_batch':
    case 'create_objective':
      return [`« ${a.data.parent_title} »`, `${a.data.steps.length} étapes proposées`]
    case 'create_goal':
      return [
        `« ${a.data.title} »`,
        a.data.steps?.length ? `${a.data.steps.length} étapes reliées` : 'Objectif suivi',
      ]
    case 'create_habit':
      return [`« ${a.data.title} »`]
    case 'create_event': {
      const start = new Date(a.data.start_at)
      const day = start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
      const time = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      return [`« ${a.data.title} »`, `Le ${day} à ${time}`]
    }
    case 'create_family_task':
      return [`« ${a.data.title} »`, 'Dans votre espace famille']
    case 'create_memory':
      return [`« ${a.data.content} »`, CATEGORY_LABELS[a.data.category ?? 'fact'] ?? a.data.category]
  }
}

/** Converts a stored action into editable string fields. */
function toDraft(a: AiAction): Record<string, string> {
  switch (a.action) {
    case 'create_task':
      return {
        title: a.data.title,
        priority: a.data.priority ?? 'medium',
        due_date: a.data.due_date ?? '',
        tags: a.data.tags?.join(', ') ?? '',
      }
    case 'create_tasks_batch':
    case 'create_objective':
      return { parent_title: a.data.parent_title, steps: a.data.steps.join('\n') }
    case 'create_goal':
      return {
        title: a.data.title,
        target_date: a.data.target_date ?? '',
        steps: (a.data.steps ?? []).join('\n'),
      }
    case 'create_habit':
      return { title: a.data.title }
    case 'create_event':
      return {
        title: a.data.title,
        start_at: toLocalInput(a.data.start_at),
        end_at: toLocalInput(a.data.end_at),
      }
    case 'create_family_task':
      return { title: a.data.title }
    case 'create_memory':
      return { content: a.data.content, category: a.data.category ?? 'fact' }
  }
}

/** ISO string → <input type="datetime-local"> value (local time, no seconds). */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface Props {
  actions: PendingAction[]
  onDismiss: (ids: string[]) => void
  /** Apply an edited proposal back into the list (before confirmation). */
  onEdit: (id: string, action: AiAction) => void
}

export function ActionsPanel({ actions, onDismiss, onEdit }: Props) {
  const [statuses, setStatuses] = useState<Record<string, CardStatus>>({})
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [draftError, setDraftError] = useState<string | null>(null)

  const pending = actions.filter((a) => (statuses[a.id] ?? 'pending') === 'pending')
  const allDone = actions.length > 0 && pending.length === 0

  const confirm = async (ids: string[]) => {
    const targets = actions.filter((a) => ids.includes(a.id))
    setStatuses((prev) => {
      const next = { ...prev }
      for (const t of targets) next[t.id] = 'working'
      return next
    })
    try {
      const res = await fetch('/api/ai/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions: targets.map((t) => t.action) }),
      })
      const json = (await res.json().catch(() => null)) as {
        error?: string
        results?: { ok: boolean; message: string }[]
      } | null
      if (!res.ok) {
        const err = json?.error ?? "L'action n'a pas pu être enregistrée."
        setStatuses((prev) => {
          const next = { ...prev }
          for (const t of targets) next[t.id] = 'error'
          return next
        })
        setMessages((prev) => {
          const next = { ...prev }
          for (const t of targets) next[t.id] = err
          return next
        })
        return
      }
      const results = json?.results ?? []
      setStatuses((prev) => {
        const next = { ...prev }
        results.forEach((r, i) => {
          const t = targets[i]
          if (t) next[t.id] = r.ok ? 'done' : 'error'
        })
        return next
      })
      setMessages((prev) => {
        const next = { ...prev }
        results.forEach((r, i) => {
          const t = targets[i]
          if (t) next[t.id] = r.message
        })
        return next
      })
    } catch {
      setStatuses((prev) => {
        const next = { ...prev }
        for (const t of targets) next[t.id] = 'error'
        return next
      })
      setMessages((prev) => {
        const next = { ...prev }
        for (const t of targets) next[t.id] = 'Connexion impossible. Réessayez dans un instant.'
        return next
      })
    }
  }

  const startEditing = (item: PendingAction) => {
    setDraft(toDraft(item.action))
    setDraftError(null)
    setEditingId(item.id)
  }

  /** Validates the draft and rebuilds the action. Returns null if invalid. */
  const buildEdited = (item: PendingAction): AiAction | null => {
    const a = item.action
    switch (a.action) {
      case 'create_task': {
        const title = draft.title?.trim()
        if (!title) {
          setDraftError('Le titre est obligatoire.')
          return null
        }
        const priority = ['low', 'medium', 'high', 'urgent'].includes(draft.priority ?? '')
          ? (draft.priority as 'low' | 'medium' | 'high' | 'urgent')
          : 'medium'
        const rawTags = (draft.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean)
        return {
          action: 'create_task',
          data: {
            title,
            priority: priority ?? 'medium',
            due_date: draft.due_date?.trim() || undefined,
            tags: rawTags.length > 0 ? rawTags.slice(0, 5) : undefined,
          },
        }
      }
      case 'create_tasks_batch':
      case 'create_objective': {
        const parent_title = draft.parent_title?.trim()
        const steps = (draft.steps ?? '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
        if (!parent_title) {
          setDraftError("Le titre de l'objectif est obligatoire.")
          return null
        }
        if (steps.length < 1 || steps.length > 10) {
          setDraftError('Prévoyez entre 1 et 10 étapes (une par ligne).')
          return null
        }
        return { action: a.action, data: { parent_title, steps } }
      }
      case 'create_habit': {
        const title = draft.title?.trim()
        if (!title) {
          setDraftError('Le titre est obligatoire.')
          return null
        }
        return { action: 'create_habit', data: { title } }
      }
      case 'create_goal': {
        const title = draft.title?.trim()
        if (!title) {
          setDraftError("Le titre de l'objectif est obligatoire.")
          return null
        }
        const steps = (draft.steps ?? '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
        if (steps.length > 10) {
          setDraftError('Prévoyez au maximum 10 étapes (une par ligne).')
          return null
        }
        return {
          action: 'create_goal',
          data: {
            title,
            target_date: draft.target_date?.trim() || undefined,
            steps: steps.length > 0 ? steps : undefined,
          },
        }
      }
      case 'create_event': {
        const title = draft.title?.trim()
        if (!title) {
          setDraftError('Le titre est obligatoire.')
          return null
        }
        const start = new Date(draft.start_at ?? '')
        const end = new Date(draft.end_at ?? '')
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          setDraftError('Les dates de début et de fin sont obligatoires.')
          return null
        }
        if (end <= start) {
          setDraftError('La fin doit être après le début.')
          return null
        }
        return {
          action: 'create_event',
          data: { title, start_at: start.toISOString(), end_at: end.toISOString() },
        }
      }
      case 'create_family_task': {
        const title = draft.title?.trim()
        if (!title) {
          setDraftError('Le titre est obligatoire.')
          return null
        }
        return { action: 'create_family_task', data: { title, family_id: a.data.family_id } }
      }
      case 'create_memory': {
        const content = draft.content?.trim()
        if (!content) {
          setDraftError('Le contenu est obligatoire.')
          return null
        }
        if (content.length > 500) {
          setDraftError('Le contenu ne peut pas dépasser 500 caractères.')
          return null
        }
        const category = ['fact', 'goal', 'preference', 'habit', 'other'].includes(draft.category ?? '')
          ? (draft.category as 'fact' | 'goal' | 'preference' | 'habit' | 'other')
          : undefined
        return { action: 'create_memory', data: { content, category: category ?? 'fact' } }
      }
    }
  }

  const saveEdit = (item: PendingAction) => {
    const edited = buildEdited(item)
    if (!edited) return
    onEdit(item.id, edited)
    setEditingId(null)
    setDraft({})
    setDraftError(null)
  }

  if (actions.length === 0) return null

  const inputClass =
    'mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:border-ring focus:ring-3 focus:ring-ring/15 transition-smooth placeholder:text-muted-foreground'
  const touchBtn = 'min-h-9 sm:min-h-8 w-full sm:w-auto'

  return (
    <div className="space-y-2.5">
      {actions.length > 1 && !allDone && (
        <button
          onClick={() => confirm(pending.map((p) => p.id))}
          disabled={pending.length === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 min-h-9 rounded-2xl border border-primary/30 bg-primary/10 text-sm font-semibold text-primary hover:bg-primary/15 transition-smooth disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          Tout confirmer ({pending.length})
        </button>
      )}

      {actions.map((item) => {
        const status: CardStatus = statuses[item.id] ?? 'pending'
        const meta = META[item.action.action]
        const Icon = meta.icon
        const lines = actionSummary(item.action)
        const isEditing = editingId === item.id

        return (
          <div
            key={item.id}
            className={cn(
              'rounded-2xl border p-4 transition-smooth',
              status === 'done' && 'border-kin-sage/50 bg-kin-sage/[0.07]',
              status === 'error' && 'border-destructive/40 bg-destructive/[0.06]',
              (status === 'pending' || status === 'working') && 'border-primary/25 bg-primary/[0.04]'
            )}
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                  {meta.label}
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    proposition IA
                  </span>
                </p>
                <div className="mt-1 space-y-0.5">
                  {lines.map((l, i) => (
                    <p
                      key={i}
                      className={cn('text-sm break-words', i === 0 ? 'text-foreground/90 font-medium' : 'text-muted-foreground')}
                    >
                      {l}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            {/* Inline editor — modify the proposal before confirming */}
            {isEditing && (
              <div className="mt-3 pl-0 sm:pl-11 space-y-3">
                {item.action.action === 'create_task' && (
                  <>
                    <div>
                      <Label>Titre</Label>
                      <Input
                        value={draft.title ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                        className="mt-1"
                        placeholder="Titre de la tâche"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Priorité</Label>
                        <select
                          value={draft.priority ?? 'medium'}
                          onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))}
                          className={inputClass}
                        >
                          {['low', 'medium', 'high', 'urgent'].map((p) => (
                            <option key={p} value={p}>
                              {PRIORITY_LABELS[p]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label>Échéance</Label>
                        <Input
                          type="date"
                          value={draft.due_date ?? ''}
                          onChange={(e) => setDraft((d) => ({ ...d, due_date: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Étiquettes (séparées par des virgules)</Label>
                      <Input
                        value={draft.tags ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
                        className="mt-1"
                        placeholder="école, important"
                      />
                    </div>
                  </>
                )}

                {(item.action.action === 'create_tasks_batch' ||
                  item.action.action === 'create_objective') && (
                  <>
                    <div>
                      <Label>Objectif</Label>
                      <Input
                        value={draft.parent_title ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, parent_title: e.target.value }))}
                        className="mt-1"
                        placeholder="Ex. : Apprendre Python"
                      />
                    </div>
                    <div>
                      <Label>Étapes (une par ligne)</Label>
                      <textarea
                        value={draft.steps ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, steps: e.target.value }))}
                        rows={Math.min(6, (draft.steps ?? '').split('\n').length + 1)}
                        className={cn(inputClass, 'resize-y')}
                        placeholder={'Comprendre les variables\nApprendre les conditions\n…'}
                      />
                    </div>
                  </>
                )}

                {item.action.action === 'create_habit' && (
                  <div>
                    <Label>Titre</Label>
                    <Input
                      value={draft.title ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                      className="mt-1"
                      placeholder="Ex. : Lire 20 minutes"
                    />
                  </div>
                )}

                {item.action.action === 'create_event' && (
                  <>
                    <div>
                      <Label>Titre</Label>
                      <Input
                        value={draft.title ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                        className="mt-1"
                        placeholder="Titre de l'événement"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label>Début</Label>
                        <Input
                          type="datetime-local"
                          value={draft.start_at ?? ''}
                          onChange={(e) => setDraft((d) => ({ ...d, start_at: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Fin</Label>
                        <Input
                          type="datetime-local"
                          value={draft.end_at ?? ''}
                          onChange={(e) => setDraft((d) => ({ ...d, end_at: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </>
                )}

                {item.action.action === 'create_family_task' && (
                  <div>
                    <Label>Titre de la tâche familiale</Label>
                    <Input
                      value={draft.title ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                      className="mt-1"
                      placeholder="Titre de la tâche"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">
                      La famille est conservée telle que proposée par l&apos;assistant.
                    </p>
                  </div>
                )}

                {item.action.action === 'create_memory' && (
                  <>
                    <div>
                      <Label>Fait à mémoriser</Label>
                      <textarea
                        value={draft.content ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
                        rows={3}
                        className={cn(inputClass, 'resize-y')}
                        placeholder="Ex. : Je prépare un examen de maths le 20 du mois prochain"
                      />
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Jamais de données sensibles (mots de passe, coordonnées bancaires).
                      </p>
                    </div>
                    <div>
                      <Label>Catégorie</Label>
                      <select
                        value={draft.category ?? 'fact'}
                        onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                        className={inputClass}
                      >
                        {(['fact', 'goal', 'preference', 'habit', 'other'] as const).map((c) => (
                          <option key={c} value={c}>
                            {CATEGORY_LABELS[c]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {draftError && <p className="text-xs text-destructive">{draftError}</p>}

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button size="sm" onClick={() => saveEdit(item)} className={cn('gap-1.5', touchBtn)}>
                    <Check className="w-3.5 h-3.5" /> Enregistrer
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingId(null)
                      setDraft({})
                      setDraftError(null)
                    }}
                    className={cn('gap-1.5 text-muted-foreground', touchBtn)}
                  >
                    <X className="w-3.5 h-3.5" /> Annuler l&apos;édition
                  </Button>
                </div>
              </div>
            )}

            {status === 'pending' && !isEditing && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3 pl-0 sm:pl-11">
                <Button size="sm" onClick={() => confirm([item.id])} className={cn('gap-1.5', touchBtn)}>
                  <Check className="w-3.5 h-3.5" /> Confirmer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startEditing(item)}
                  className={cn('gap-1.5', touchBtn)}
                >
                  <Pencil className="w-3.5 h-3.5" /> Modifier
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDismiss([item.id])}
                  className={cn('gap-1.5 text-muted-foreground', touchBtn)}
                >
                  <X className="w-3.5 h-3.5" /> Annuler
                </Button>
              </div>
            )}

            {status === 'working' && (
              <div className="flex items-center gap-2 mt-3 pl-0 sm:pl-11 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Enregistrement…
              </div>
            )}

            {(status === 'done' || status === 'error') && (
              <div
                className={cn(
                  'flex items-center gap-2 mt-3 pl-0 sm:pl-11 text-sm',
                  status === 'done' ? 'text-kin-rose-dark' : 'text-destructive'
                )}
              >
                {status === 'done' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{messages[item.id] ?? (status === 'done' ? 'Action enregistrée' : 'Erreur')}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
