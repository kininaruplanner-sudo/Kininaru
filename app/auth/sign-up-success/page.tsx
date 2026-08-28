'use client'

import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export default function SignUpSuccessPage() {
  const { t } = useI18n()

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl shadow-kin-hover p-8 text-center transition-smooth">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
          </div>

          <h1 className="text-3xl font-serif font-bold text-foreground mb-3">
            {t('auth.signUpSuccessTitle')}
          </h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            {t('auth.signUpSuccessDesc')}
          </p>

          <Link
            href="/auth/login"
            className={cn(buttonVariants({ variant: 'default' }), 'transition-smooth hover:scale-[1.02] w-full text-center')}
          >
            {t('auth.backToLogin')}
          </Link>
        </div>
      </div>
    </div>
  )
}
