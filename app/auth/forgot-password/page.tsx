'use client'

import { useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import AuthConfigRequired from '@/components/auth-config-required'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, CheckCircle2, ArrowLeft } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { getAuthErrorMessage } from '@/lib/auth-errors'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const { t } = useI18n()

  if (!isSupabaseConfigured()) {
    return <AuthConfigRequired />
  }

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      })
      if (resetError) throw resetError
      setSent(true)
    } catch (err) {
      setError(getAuthErrorMessage(err, t('auth.sendReset')))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-2xl shadow-kin-hover p-8 text-center transition-smooth">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-kin-sage/10 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-kin-sage" />
              </div>
            </div>
            <h1 className="text-2xl font-serif font-bold text-foreground mb-3">{t('auth.checkEmail')}</h1>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              {t('auth.resetSent', { email })}
            </p>
            <Button
              render={<Link href="/auth/login">{t('auth.backToLogin')}</Link>}
              className="w-full transition-smooth"
            />
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
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-foreground mb-2">{t('auth.forgotTitle')}</h1>
            <p className="text-muted-foreground">
              {t('auth.forgotSubtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                {t('auth.email')}
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
              {loading ? t('auth.sending') : t('auth.sendReset')}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1 text-primary font-medium hover:underline transition-smooth"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t('auth.backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
