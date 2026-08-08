'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Crown, Shield, Trash2, UserPlus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { cardVariants } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { FamilyMember, FamilyRole } from './types'

interface Props {
  members: FamilyMember[]
  userId: string
  currentRole: FamilyRole
  inviteCode: string
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?'
}

export function FamilyMembersTab({ members, userId, currentRole, inviteCode }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()
  const isParent = currentRole === 'parent'

  const changeRole = async (targetUserId: string, role: FamilyRole) => {
    setError('')
    setLoadingId(targetUserId)
    const { error: rpcError } = await supabase.rpc('update_family_member_role', {
      p_user_id: targetUserId,
      p_role: role,
    })
    setLoadingId(null)

    if (rpcError) {
      setError(rpcError.message || 'Impossible de modifier ce rôle.')
      return
    }
    router.refresh()
  }

  const removeMember = async (targetUserId: string) => {
    setError('')
    setLoadingId(targetUserId)
    const { error: rpcError } = await supabase.rpc('remove_family_member', {
      p_user_id: targetUserId,
    })
    setLoadingId(null)
    setConfirmRemoveId(null)

    if (rpcError) {
      setError(rpcError.message || 'Impossible de retirer ce membre.')
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {isParent && (
        <div className={cn(cardVariants({ padding: 'md' }), 'flex items-center gap-3')}>
          <div className="flex items-center justify-center size-9 rounded-xl bg-primary/10 text-primary shrink-0">
            <UserPlus className="size-4" />
          </div>
          <p className="text-xs text-muted-foreground">
            Pour inviter un membre, partagez le code{' '}
            <span className="font-mono font-semibold text-foreground tracking-widest">
              {inviteCode}
            </span>{' '}
            affiché en haut de la page. Il pourra rejoindre la famille depuis l'onglet Famille de
            son propre compte.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {members.map((member, i) => {
          const isSelf = member.user_id === userId
          const isLoading = loadingId === member.user_id
          return (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
              className={cn(cardVariants({ padding: 'md' }), 'flex items-center gap-3')}
            >
              <span className="flex items-center justify-center size-10 rounded-full bg-primary/15 text-primary font-semibold text-sm shrink-0">
                {initials(member.display_name)}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {member.display_name}
                  {isSelf && <span className="text-muted-foreground font-normal"> (vous)</span>}
                </p>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                    member.role === 'parent'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-kin-sage/20 text-kin-sage'
                  )}
                >
                  {member.role === 'parent' ? (
                    <Crown className="size-2.5" />
                  ) : (
                    <Shield className="size-2.5" />
                  )}
                  {member.role === 'parent' ? 'Parent' : 'Enfant'}
                </span>
              </div>

              {isParent && !isSelf && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => changeRole(member.user_id, member.role === 'parent' ? 'child' : 'parent')}
                    disabled={isLoading}
                    title={member.role === 'parent' ? 'Passer en Enfant' : 'Passer en Parent'}
                    className="text-[10px] font-medium text-muted-foreground hover:text-foreground transition-smooth disabled:opacity-50 whitespace-nowrap"
                  >
                    {member.role === 'parent' ? '→ Enfant' : '→ Parent'}
                  </button>

                  {confirmRemoveId === member.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setConfirmRemoveId(null)}
                        disabled={isLoading}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon-xs"
                        onClick={() => removeMember(member.user_id)}
                        disabled={isLoading}
                        aria-label="Confirmer la suppression"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setConfirmRemoveId(member.id)}
                      disabled={isLoading}
                      aria-label="Retirer ce membre"
                      title="Retirer ce membre"
                    >
                      <Trash2 className="w-3 h-3 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
