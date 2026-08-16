'use client'

import { useState } from 'react'
import {
  MessageSquarePlus,
  Trash2,
  Pencil,
  Check,
  X,
  MessageSquare,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { CoachConversation } from '@/lib/coach/conversations'

/**
 * Conversation history — ÉTAPE 14 §15-16.
 * Desktop: sidebar panel with rename (✎) / delete (🗑, two-step confirm).
 * Mobile: a compact horizontal chip strip (no edit/delete to stay touchable).
 */

interface Props {
  conversations: CoachConversation[]
  activeId: string | null
  loading: boolean
  onNew: () => void
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}

/* ------------------------------------------------------------------ */
/* Desktop panel                                                       */
/* ------------------------------------------------------------------ */

export function ConversationsPanel({
  conversations,
  activeId,
  loading,
  onNew,
  onSelect,
  onRename,
  onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const startEdit = (conv: CoachConversation) => {
    setEditingId(conv.id)
    setDraft(conv.title)
    setConfirmId(null)
  }

  const commitEdit = () => {
    if (editingId && draft.trim()) onRename(editingId, draft.trim())
    setEditingId(null)
  }

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border bg-card/50">
      <div className="p-3 border-b border-border">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-1.5"
          onClick={onNew}
          aria-label="Nouvelle conversation"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
          Nouvelle conversation
        </Button>
      </div>

      <div className="flex-1 overflow-auto px-2 py-2 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground motion-reduce:hidden" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-6 text-center leading-relaxed">
            Aucune conversation.
            <br />
            Écrivez au coach pour en commencer une.
          </p>
        ) : (
          conversations.map((conv) => {
            const active = conv.id === activeId
            if (editingId === conv.id) {
              return (
                <div
                  key={conv.id}
                  className="flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/5 px-2 py-1"
                >
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    autoFocus
                    className="flex-1 min-w-0 bg-transparent text-xs text-foreground focus:outline-none"
                    aria-label="Titre de la conversation"
                  />
                  <button
                    type="button"
                    onClick={commitEdit}
                    className="w-6 h-6 flex items-center justify-center rounded text-kin-sage hover:bg-kin-sage/10 transition-smooth"
                    aria-label="Enregistrer le titre"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:bg-muted transition-smooth"
                    aria-label="Annuler"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )
            }

            return (
              <div
                key={conv.id}
                className={cn(
                  'group flex items-center gap-1 rounded-lg border px-2 py-1.5 cursor-pointer transition-smooth',
                  active
                    ? 'border-primary/30 bg-primary/10 text-foreground'
                    : 'border-transparent hover:border-border hover:bg-muted/60'
                )}
                onClick={() => {
                  setConfirmId(null)
                  onSelect(conv.id)
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(conv.id)
                  }
                }}
              >
                <MessageSquare className="w-3 h-3 text-primary shrink-0" />
                <span className="flex-1 min-w-0 truncate text-xs">{conv.title}</span>

                {confirmId === conv.id ? (
                  <span className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(conv.id)
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded bg-destructive/15 text-destructive hover:bg-destructive/25 transition-smooth"
                      aria-label="Confirmer la suppression"
                      title="Confirmer"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmId(null)
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:bg-muted transition-smooth"
                      aria-label="Annuler la suppression"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ) : (
                  <span className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        startEdit(conv)
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-smooth"
                      aria-label="Renommer"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmId(conv.id)
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-smooth"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* Mobile chip strip                                                   */
/* ------------------------------------------------------------------ */

export function ConversationsChips({
  conversations,
  activeId,
  loading,
  onNew,
  onSelect,
  embedded,
}: Omit<Props, 'onRename' | 'onDelete'> & { embedded?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 pt-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0',
        !embedded && 'md:hidden'
      )}
    >
      <Button
        variant="outline"
        size="xs"
        onClick={onNew}
        className="shrink-0 gap-1"
        aria-label="Nouvelle conversation"
      >
        <MessageSquarePlus className="w-3 h-3" />
        Nouvelle
      </Button>
      {loading ? (
        <span className="shrink-0 text-xs text-muted-foreground px-2">Chargement…</span>
      ) : (
        conversations.map((conv) => (
          <button
            key={conv.id}
            type="button"
            onClick={() => onSelect(conv.id)}
            className={cn(
              'shrink-0 max-w-44 truncate rounded-full border px-3 py-1.5 text-xs transition-smooth',
              conv.id === activeId
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
            )}
          >
            {conv.title}
          </button>
        ))
      )}
    </div>
  )
}
