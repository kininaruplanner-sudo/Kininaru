'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogoMark } from '@/components/landing/logo-mark'
import { CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Le lien de l'e-mail crée une session "recovery" temporaire côté client
    // via le hash de l'URL ; on attend qu'elle soit disponible avant
    // d'autoriser la soumission du formulaire.
    supabase.auth.getSession().then(({ data }) => {
      setReady(!!data.session)
    })
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }
    if (password !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setDone(true)
      setTimeout(() => router.push('/dashboard'), 1500)
    } catch (err: any) {
      setError(err?.message || 'Impossible de mettre à jour le mot de passe.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="flex justify-center mb-6">
          <LogoMark />
        </Link>
        <div className="bg-card border border-border rounded-2xl shadow-kin-hover p-8 transition-smooth">
          {done ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-serif font-bold text-foreground mb-2">Mot de passe mis à jour</h1>
              <p className="text-muted-foreground">Redirection vers votre tableau de bord...</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-serif font-bold text-foreground mb-2">Nouveau mot de passe</h1>
                <p className="text-muted-foreground">Choisissez un nouveau mot de passe pour votre compte.</p>
              </div>

              {!ready && (
                <div className="mb-4 bg-secondary text-secondary-foreground text-sm p-3 rounded-lg" role="status">
                  Ouvrez cette page depuis le lien reçu par e-mail pour continuer.
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Nouveau mot de passe
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-11 transition-smooth"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirmer le mot de passe
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-11 transition-smooth"
                  />
                </div>

                {error && (
                  <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20" role="alert">
                    {error}
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full h-11 text-base font-medium transition-smooth hover:scale-[1.02]">
                  {loading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm">
                <Link href="/auth/login" className="text-muted-foreground hover:text-foreground transition-smooth">
                  Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
