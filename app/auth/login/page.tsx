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

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError

      // Support an optional ?next= redirect (e.g. coming from the public
      // account-deletion page) without requiring useSearchParams() at the
      // page level, which would force this route into a Suspense boundary.
      const next = new URLSearchParams(window.location.search).get('next')
      router.push(next && next.startsWith('/') ? next : '/dashboard')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Échec de la connexion')
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
              Bon retour
            </h1>
            <p className="text-muted-foreground">
              Connectez-vous pour continuer sur Kininaru
            </p>
          </div>

          <GoogleAuthButton onError={setError} />

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

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">
                  Mot de passe
                </Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-primary hover:underline transition-smooth"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 transition-smooth"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 text-base font-medium transition-smooth hover:scale-[1.02]"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {"Pas encore de compte ? "}
            <Link
              href="/auth/sign-up"
              className="text-primary font-medium hover:underline transition-smooth"
            >
              Créer un compte
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
