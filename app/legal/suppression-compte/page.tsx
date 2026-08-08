'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2, AlertTriangle, LogIn } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resetAnalytics } from '@/lib/analytics'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LegalPageShell } from '@/components/legal/legal-page-shell'

export default function AccountDeletionPage() {
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
      setChecking(false)
    })
  }, [supabase])

  const deleteAccount = async () => {
    if (confirmText.trim().toUpperCase() !== 'SUPPRIMER') return
    setDeleting(true)
    setError('')
    const { error: rpcError } = await supabase.rpc('delete_user_account')
    if (rpcError) {
      setDeleting(false)
      setError(
        "La suppression a échoué. Réessayez, ou contactez-nous à [À COMPLÉTER — e-mail de support] pour un traitement manuel."
      )
      return
    }
    await supabase.auth.signOut()
    resetAnalytics()
    router.push('/')
    router.refresh()
  }

  return (
    <LegalPageShell title="Suppression de compte" lastUpdated="[À COMPLÉTER — date de publication]">
      <section>
        <p>
          Vous pouvez supprimer votre compte Kininaru Planner et l'ensemble des données associées à tout
          moment. La suppression est <strong>immédiate et irréversible</strong> : elle efface votre profil,
          vos tâches, événements de calendrier, habitudes, entrées de journal et sessions de concentration.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">Supprimer mon compte maintenant</h2>

        {checking ? (
          <div className="h-24 rounded-xl bg-muted animate-pulse" />
        ) : email ? (
          <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-3">
            <p className="text-sm text-foreground">
              Connecté en tant que <strong>{email}</strong>.
            </p>
            {!showConfirm ? (
              <Button variant="destructive" size="sm" onClick={() => setShowConfirm(true)} className="gap-2">
                <Trash2 className="w-4 h-4" />
                Supprimer mon compte et mes données
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-foreground flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  Tapez <strong>&nbsp;SUPPRIMER&nbsp;</strong> ci-dessous pour confirmer.
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="SUPPRIMER"
                  className="max-w-xs"
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={deleteAccount}
                  disabled={confirmText.trim().toUpperCase() !== 'SUPPRIMER' || deleting}
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? 'Suppression...' : 'Confirmer la suppression définitive'}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            <p className="text-sm text-muted-foreground">
              Vous n'êtes pas connecté. Connectez-vous pour supprimer votre compte directement, ou écrivez-nous
              si vous n'y avez plus accès.
            </p>
            <Button render={<Link href="/auth/login?next=/legal/suppression-compte">Se connecter</Link>} size="sm" className="gap-2">
              <LogIn className="w-4 h-4" />
              Se connecter pour continuer
            </Button>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">Vous n'arrivez pas à vous connecter ?</h2>
        <p>
          Écrivez-nous à [À COMPLÉTER — e-mail de support] depuis l'adresse e-mail associée à votre compte.
          Nous traiterons votre demande de suppression sous [À COMPLÉTER — délai, ex. 30 jours].
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-2">Ce qui est supprimé</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Votre profil (nom affiché, préférences, thème, niveau/XP)</li>
          <li>Vos tâches et sous-tâches</li>
          <li>Vos événements de calendrier</li>
          <li>Vos habitudes et leur historique</li>
          <li>Vos entrées de journal</li>
          <li>Vos sessions de concentration enregistrées</li>
          <li>Votre compte d'authentification (e-mail, connexion Google le cas échéant)</li>
        </ul>
      </section>
    </LegalPageShell>
  )
}
