'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bug, Lightbulb, Loader2, Send, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { APP_VERSION_LABEL } from '@/lib/version'
import {
  BUG_CATEGORIES,
  SUGGESTION_CATEGORIES,
  SEVERITIES,
  submitFeedback,
  type FeedbackKind,
} from '@/lib/feedback'

/* ------------------------------------------------------------------ */
/* Formulaire bug                                                     */
/* ------------------------------------------------------------------ */

const inputClass =
  'mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:border-ring focus:ring-3 focus:ring-ring/15 transition-smooth placeholder:text-muted-foreground'

function BugForm({
  onSent,
  onError,
}: {
  onSent: () => void
  onError: (message: string) => void
}) {
  const [category, setCategory] = useState('bug')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState('')
  const [severity, setSeverity] = useState('medium')
  const [sending, setSending] = useState(false)

  const canSubmit = description.trim().length > 0 && !sending

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSending(true)
    const result = await submitFeedback({
      kind: 'bug',
      category: category as (typeof BUG_CATEGORIES)[number]['value'],
      description,
      steps_to_reproduce: steps || undefined,
      severity: severity as (typeof SEVERITIES)[number]['value'],
    })
    setSending(false)
    if (result.ok) onSent()
    else onError(result.error ?? 'Impossible d’envoyer le retour.')
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Type de problème</Label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
          {BUG_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label>Description</Label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Décris ce qui s'est passé…"
          className={cn(inputClass, 'resize-y')}
        />
      </div>

      <div>
        <Label>Étapes pour reproduire</Label>
        <textarea
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          rows={3}
          placeholder="Que faisais-tu lorsque le problème est apparu ?"
          className={cn(inputClass, 'resize-y')}
        />
      </div>

      <div>
        <Label>Gravité</Label>
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={inputClass}>
          {SEVERITIES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full gap-1.5 min-h-11 sm:min-h-9">
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Envoyer le rapport
      </Button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Formulaire suggestion                                              */
/* ------------------------------------------------------------------ */

function SuggestionForm({
  onSent,
  onError,
}: {
  onSent: () => void
  onError: (message: string) => void
}) {
  const [category, setCategory] = useState('new-feature')
  const [suggestion, setSuggestion] = useState('')
  const [sending, setSending] = useState(false)

  const canSubmit = suggestion.trim().length > 0 && !sending

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSending(true)
    const result = await submitFeedback({
      kind: 'suggestion',
      category: category as (typeof SUGGESTION_CATEGORIES)[number]['value'],
      description: suggestion,
    })
    setSending(false)
    if (result.ok) onSent()
    else onError(result.error ?? 'Impossible d’envoyer le retour.')
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Type</Label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
          {SUGGESTION_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label>Suggestion</Label>
        <textarea
          value={suggestion}
          onChange={(e) => setSuggestion(e.target.value)}
          rows={5}
          placeholder="Quelle amélioration aimerais-tu voir dans Kininaru ?"
          className={cn(inputClass, 'resize-y')}
        />
      </div>

      <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full gap-1.5 min-h-11 sm:min-h-9">
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Envoyer la suggestion
      </Button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Dialog                                                             */
/* ------------------------------------------------------------------ */

/**
 * Boîte de dialogue des retours (bug / suggestion).
 *
 * NOTE : le parent doit passer une `key` qui change à chaque ouverture
 * (ex. `${kind}-${count}`) pour que le formulaire soit fraîchement remonté
 * à chaque ouverture — aucun reset via effet, donc aucun rendu en cascade.
 */
export function FeedbackDialog({
  open,
  kind,
  onOpenChange,
}: {
  open: boolean
  kind: FeedbackKind
  onOpenChange: (open: boolean) => void
}) {
  const [phase, setPhase] = useState<'form' | 'success'>('form')
  const [error, setError] = useState<string | null>(null)

  const handleSent = () => {
    setPhase('success')
    setError(null)
  }

  const handleError = (message: string) => {
    setError(message) // le contenu du formulaire reste intact (pas de reset)
  }

  const isBug = kind === 'bug'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={isBug ? 'Signaler un bug' : 'Envoyer une suggestion'}
            className="w-full sm:max-w-md max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-border bg-card shadow-kin-hover"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border sticky top-0 bg-card z-10">
              <div
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                  isBug ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
                )}
              >
                {isBug ? <Bug className="w-4.5 h-4.5" /> : <Lightbulb className="w-4.5 h-4.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-foreground leading-tight">
                  {isBug ? 'Signaler un bug' : 'Envoyer une suggestion'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isBug
                    ? 'Aidez-nous à corriger le problème.'
                    : 'Votre idée peut améliorer Kininaru.'}
                </p>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                aria-label="Fermer"
                className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5">
              {phase === 'success' ? (
                <div className="text-center py-8">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 20 }}
                    className="w-14 h-14 rounded-full bg-kin-sage/15 text-kin-sage flex items-center justify-center mx-auto mb-4"
                  >
                    <CheckCircle2 className="w-7 h-7" />
                  </motion.div>
                  <p className="text-base font-semibold text-foreground mb-1.5">Merci pour ton retour !</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Ton message a bien été envoyé à l’équipe Kininaru.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-6 min-h-11 sm:min-h-9"
                    onClick={() => onOpenChange(false)}
                  >
                    Fermer
                  </Button>
                </div>
              ) : (
                <>
                  {error && (
                    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-xs text-destructive">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
                      <span className="flex-1 leading-relaxed">{error}</span>
                    </div>
                  )}

                  {isBug ? (
                    <BugForm onSent={handleSent} onError={handleError} />
                  ) : (
                    <SuggestionForm onSent={handleSent} onError={handleError} />
                  )}

                  <p className="mt-4 text-[11px] text-muted-foreground/80 leading-relaxed">
                    {APP_VERSION_LABEL} · Des informations techniques (page, navigateur, appareil)
                    sont envoyées automatiquement pour nous aider à reproduire le problème. Aucun
                    contenu privé (journal, conversations, mots de passe) n’est transmis.
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
