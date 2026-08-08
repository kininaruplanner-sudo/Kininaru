'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FamilyRole } from './types'

interface Props {
  open: boolean
  onClose: () => void
}

export function JoinFamilyModal({ open, onClose }: Props) {
  const [code, setCode] = useState('')
  const [role, setRole] = useState<FamilyRole>('child')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleJoin = async () => {
    if (!code.trim()) {
      setError('Le code d\'invitation est requis.')
      return
    }
    setError('')
    setLoading(true)

    const { error: rpcError } = await supabase.rpc('join_family_by_code', {
      p_code: code.trim(),
      p_role: role,
    })

    setLoading(false)

    if (rpcError) {
      setError(rpcError.message || 'Impossible de rejoindre cette famille. Réessayez.')
      return
    }

    setCode('')
    onClose()
    router.refresh()
  }

  return (
    <Modal open={open} onClose={onClose} title="Rejoindre une famille">
      <div className="space-y-4">
        <div>
          <Label htmlFor="family-code">Code d'invitation</Label>
          <Input
            id="family-code"
            placeholder="Ex : 7K3PZQ"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="mt-1 tracking-widest font-mono uppercase transition-smooth"
            maxLength={6}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleJoin()
            }}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Demandez ce code à un membre de la famille (visible dans l'onglet Membres).
          </p>
        </div>

        <div>
          <Label htmlFor="family-role">Votre rôle dans cette famille</Label>
          <select
            id="family-role"
            value={role}
            onChange={(e) => setRole(e.target.value as FamilyRole)}
            className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring transition-smooth"
          >
            <option value="child">Enfant</option>
            <option value="parent">Parent</option>
          </select>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1 transition-smooth" onClick={onClose}>
            Annuler
          </Button>
          <Button
            className="flex-1 transition-smooth hover:scale-[1.02]"
            onClick={handleJoin}
            disabled={loading || !code.trim()}
          >
            {loading ? 'Connexion...' : 'Rejoindre'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
