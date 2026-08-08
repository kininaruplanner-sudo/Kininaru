'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  open: boolean
  onClose: () => void
}

export function CreateFamilyModal({ open, onClose }: Props) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Le nom de la famille est requis.')
      return
    }
    setError('')
    setLoading(true)

    const { error: rpcError } = await supabase.rpc('create_family', { p_name: name.trim() })

    setLoading(false)

    if (rpcError) {
      setError(rpcError.message || 'Impossible de créer la famille. Réessayez.')
      return
    }

    setName('')
    onClose()
    router.refresh()
  }

  return (
    <Modal open={open} onClose={onClose} title="Créer une famille">
      <div className="space-y-4">
        <div>
          <Label htmlFor="family-name">Nom de la famille</Label>
          <Input
            id="family-name"
            placeholder="Ex : Famille Dubois"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 transition-smooth"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleCreate()
            }}
          />
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
            {error}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Vous serez le premier membre, avec le rôle Parent. Un code d'invitation sera généré
          automatiquement pour inviter le reste de la famille.
        </p>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1 transition-smooth" onClick={onClose}>
            Annuler
          </Button>
          <Button
            className="flex-1 transition-smooth hover:scale-[1.02]"
            onClick={handleCreate}
            disabled={loading || !name.trim()}
          >
            {loading ? 'Création...' : 'Créer la famille'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
