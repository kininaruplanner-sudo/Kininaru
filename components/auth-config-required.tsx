'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Copy, Settings2 } from 'lucide-react'
import { KinLogo } from '@/components/kin-logo'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'

const ENV_SNIPPET = `NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
GROQ_API_KEY=gsk_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000`

export default function AuthConfigRequired() {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ENV_SNIPPET)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable (non-secure context) — leave the block copyable by hand
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl shadow-kin-hover p-8 transition-smooth">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-5">
              <KinLogo />
            </div>
            <div className="w-14 h-14 rounded-full bg-kin-yellow/15 flex items-center justify-center mx-auto mb-4">
              <Settings2 className="w-6 h-6 text-kin-yellow" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-foreground mb-2">
              {t('auth.configRequiredTitle')}
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t('auth.configRequiredDesc')}
            </p>
          </div>

          <div className="relative">
            <pre className="bg-muted/60 border border-border rounded-xl p-4 pr-14 text-xs leading-relaxed overflow-x-auto font-mono text-foreground/90">
              {ENV_SNIPPET}
            </pre>
            <button
              type="button"
              onClick={handleCopy}
              className="absolute top-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-smooth hover:text-foreground hover:border-foreground/30"
              aria-label={t('auth.configRequiredCopy')}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-kin-sage" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? t('auth.configRequiredCopied') : t('auth.configRequiredCopy')}
            </button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
            {t('auth.configRequiredNote')}
          </p>

          <div className="mt-6">
            <Button
              render={<Link href="/">{t('auth.configRequiredHome')}</Link>}
              variant="outline"
              className="w-full transition-smooth"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
