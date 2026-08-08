'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogoMark } from '@/components/landing/logo-mark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoogleAuthButton } from '@/components/auth/google-auth-button'

export default function SignUpPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
            `${window.location.origin}/auth/callback`,
          data: {
            display_name: displayName,
          },
        },
      })

      if (signUpError) throw signUpError

      router.push('/auth/sign-up-success')
    } catch (err: any) {
      setError(err.message || "Échec de l'inscription")
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
          <div className="text-center mb-8">
            <h1 className="text-3xl font-serif font-bold text-foreground mb-2">
              Créer votre compte
            </h1>
            <p className="text-muted-foreground">
              Commencez votre aventure avec Kininaru
            </p>
          </div>

          <GoogleAuthButton
            label="S'inscrire avec Google"
            onError={setError}
          />

          {error && (
            <div className="mt-4 bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
              {error}
            </div>
          )}

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted-foreground">
              ou avec votre e-mail
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSignUp} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-sm font-medium">
                Nom affiché
              </Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Votre nom"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="h-11 transition-smooth"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 transition-smooth"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Mot de passe
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
              <p className="text-xs text-muted-foreground">
                Au moins 6 caractères
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 text-base font-medium transition-smooth hover:scale-[1.02]"
            >
              {loading ? 'Création du compte...' : 'Créer le compte'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {'Déjà un compte ? '}
            <Link
              href="/auth/login"
              className="text-primary font-medium hover:underline transition-smooth"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
