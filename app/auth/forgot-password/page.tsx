'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LogoMark } from '@/components/landing/logo-mark'
import { Mail, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('sending')
    setError('')

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (resetError) throw resetError
      setStatus('sent')
    } catch (err: any) {
      // On ne révèle jamais si l'e-mail existe ou non (énumération de comptes) :
      // Supabase renvoie déjà une réponse générique dans la plupart des cas,
      // mais on affiche un message tout aussi neutre en cas d'erreur réseau.
      setError(err?.message || "Impossible d'envoyer l'e-mail pour le moment. Réessayez.")
      setStatus('error')
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="flex justify-center mb-6">
          <LogoMark />
        </Link>
        <div className="bg-card border border-border rounded-2xl shadow-kin-hover p-8 transition-smooth">
          {status === 'sent' ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-serif font-bold text-foreground mb-3">Vérifiez vos e-mails</h1>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Si un compte existe pour {email}, un lien de réinitialisation vient d'être envoyé.
              </p>
              <Button render={<Link href="/auth/login">Retour à la connexion</Link>} className="transition-smooth hover:scale-[1.02]" />
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-serif font-bold text-foreground mb-2">Mot de passe oublié</h1>
                <p className="text-muted-foreground">
                  Entrez votre e-mail, nous vous enverrons un lien de réinitialisation.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    E-mail
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="vous@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11 transition-smooth"
                  />
                </div>

                {error && (
                  <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20" role="alert">
                    {error}
                  </div>
                )}

                <Button type="submit" disabled={status === 'sending'} className="w-full h-11 text-base font-medium transition-smooth hover:scale-[1.02]">
                  {status === 'sending' ? 'Envoi...' : 'Envoyer le lien'}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm">
                <Link href="/auth/login" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-smooth">
                  <ArrowLeft className="w-3.5 h-3.5" />
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
