'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, LogOut, RefreshCw, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { FamilyNotificationsPanel } from './family-notifications-panel'
import type { Family, FamilyNotification, FamilyRole } from './types'

interface Props {
  family: Family
  currentRole: FamilyRole
  memberCount: number
  notifications: FamilyNotification[]
}

export function FamilyHeader({ family, currentRole, memberCount, notifications }: Props) {
  const [code, setCode] = useState(family.invite_code)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const isParent = currentRole === 'parent'

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setError("Impossible de copier le code. Copiez-le manuellement : " + code)
    }
  }

  const regenerateCode = async () => {
    setError('')
    setRegenerating(true)
    const { data, error: rpcError } = await supabase.rpc('regenerate_family_invite_code')
    setRegenerating(false)

    if (rpcError) {
      setError(rpcError.message || "Impossible de régénérer le code.")
      return
    }
    if (data) setCode(data as string)
  }

  const handleLeave = async () => {
    setError('')
    setLeaving(true)
    const { error: rpcError } = await supabase.rpc('leave_family')
    setLeaving(false)

    if (rpcError) {
      setError(rpcError.message || "Impossible de quitter la famille.")
      setConfirmLeave(false)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3 px-6 py-4 border-b border-border bg-card">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-serif font-bold text-foreground truncate">{family.name}</h1>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <Users className="w-3 h-3" />
            {memberCount} membre{memberCount > 1 ? 's' : ''} · vous êtes{' '}
            {isParent ? 'Parent' : 'Enfant'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <FamilyNotificationsPanel notifications={notifications} />

          {confirmLeave ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground hidden sm:inline">Sûr ?</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmLeave(false)}
                disabled={leaving}
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleLeave}
                disabled={leaving}
              >
                {leaving ? 'Départ...' : 'Confirmer'}
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setConfirmLeave(true)}
              aria-label="Quitter la famille"
              title="Quitter la famille"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Code d'invitation :</span>
        <button
          onClick={copyCode}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted font-mono text-xs font-semibold tracking-widest text-foreground hover:bg-secondary transition-smooth"
          title="Copier le code"
        >
          {code}
          {copied ? (
            <Check className="w-3 h-3 text-kin-sage" />
          ) : (
            <Copy className="w-3 h-3 text-muted-foreground" />
          )}
        </button>
        {isParent && (
          <button
            onClick={regenerateCode}
            disabled={regenerating}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-smooth disabled:opacity-50"
            title="Générer un nouveau code (l'ancien ne fonctionnera plus)"
          >
            <RefreshCw className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} />
            Régénérer
          </button>
        )}
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-xs p-2.5 rounded-lg border border-destructive/20">
          {error}
        </div>
      )}
    </div>
  )
}
