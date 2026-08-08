'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { GoogleIcon } from '@/components/ui/google-icon'

interface GoogleAuthButtonProps {
  label?: string
  onError?: (message: string) => void
}

export function GoogleAuthButton({
  label = 'Continuer avec Google',
  onError,
}: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleClick = async () => {
    onError?.('')
    setLoading(true)

    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=/dashboard`

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      })

      if (error) {
        onError?.(error.message || 'Impossible de démarrer la connexion Google.')
        setLoading(false)
        return
      }

      if (data?.url) {
        window.location.assign(data.url)
        return
      }

      onError?.('La redirection Google n’a pas été initialisée.')
    } catch (err: any) {
      onError?.(err?.message || 'Impossible de se connecter avec Google.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={loading}
      className="w-full h-11 gap-2 text-base font-medium transition-smooth hover:scale-[1.02]"
    >
      <GoogleIcon className="size-4" />
      {loading ? 'Redirection vers Google…' : label}
    </Button>
  )
}
