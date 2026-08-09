'use client'

import { useState, useEffect } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import AuthConfigRequired from '@/components/auth-config-required'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KeyRound, CheckCircle2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { t } = useI18n()

  // Verify a session exists (the email link establishes one via the callback).
  useEffect(() => {
    if (!isSupabaseConfigured()) return
    const client = createClient()
    client.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace('/auth/login')
      }
    })
  }, [router])

  if (!isSupabaseConfigured()) {
    return <AuthConfigRequired />
  }

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError(t('settings.pwTooShort'))
      return
    }
    if (password !== confirm) {
      setError(t('settings.pwMismatch'))
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setDone(true)
      setTimeout(() => router.push('/auth/login'), 2500)
    } catch (err: any) {
      setError(err.message || t('auth.updatePassword'))
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-2xl shadow-kin-hover p-8 text-center transition-smooth">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-kin-sage/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-kin-sage" />
              </div>
            </div>
            <h1 className="text-2xl font-serif font-bold text-foreground mb-3">{t('auth.passwordUpdated')}</h1>
            <p className="text-muted-foreground">
              {t('auth.redirectingToLogin')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl shadow-kin-hover p-8 transition-smooth">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-foreground mb-2">{t('auth.resetTitle')}</h1>
            <p className="text-muted-foreground">
              {t('auth.resetSubtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                {t('auth.newPassword')}
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
              <p className="text-xs text-muted-foreground">{t('auth.minChars')}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm" className="text-sm font-medium">
                {t('auth.confirmPassword')}
              </Label>
              <Input
                id="confirm"
                type="password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="h-11 transition-smooth"
              />
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 text-base font-medium transition-smooth hover:scale-[1.02]"
            >
              {loading ? t('auth.updating') : t('auth.updatePassword')}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/auth/login" className="text-primary font-medium hover:underline transition-smooth">
              {t('auth.backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
