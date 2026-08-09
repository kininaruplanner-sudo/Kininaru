'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

function AuthErrorInner() {
  const { t } = useI18n()
  // Next.js 16 makes page-level searchParams async; this client component
  // reads the query string through the router hook instead (Suspense-wrapped).
  const searchParams = useSearchParams()
  const error = searchParams.get('error') || t('auth.authError')
  const description = searchParams.get('error_description') || t('auth.authErrorDesc')

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl shadow-kin-hover p-8 text-center transition-smooth">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
          </div>

          <h1 className="text-3xl font-serif font-bold text-foreground mb-3">{error}</h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">{description}</p>

          <div className="flex gap-3">
            <Button
              render={<Link href="/auth/login">{t('auth.backToLogin')}</Link>}
              variant="outline"
              className="flex-1 transition-smooth"
            />
            <Button
              render={<Link href="/auth/sign-up">{t('auth.signUp')}</Link>}
              className="flex-1 transition-smooth hover:scale-[1.02]"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={null}>
      <AuthErrorInner />
    </Suspense>
  )
}
