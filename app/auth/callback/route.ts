import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

function getFriendlyAuthError(error: string | null, description: string | null) {
  const normalized = (description || error || '').toLowerCase()

  if (normalized.includes('redirect_uri_mismatch')) {
    return {
      error: 'Configuration OAuth incomplète',
      error_description:
        'L’URL de redirection Google ne correspond pas à la configuration Supabase. Vérifiez l’URL de callback dans Google Cloud et Supabase.',
    }
  }

  if (normalized.includes('access_denied')) {
    return {
      error: 'Connexion Google refusée',
      error_description: 'L’accès au compte Google a été refusé. Réessayez et confirmez l’autorisation.',
    }
  }

  if (normalized.includes('invalid_request') || normalized.includes('invalid_client')) {
    return {
      error: 'Configuration OAuth invalide',
      error_description:
        'Le provider Google ou la configuration Supabase n’est pas valide. Vérifiez le Client ID / Client Secret et l’URL de callback.',
    }
  }

  return {
    error: error || 'Authentication error',
    error_description: description || 'Une erreur s’est produite lors de la connexion Google.',
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  const providerError = searchParams.get('error')
  const providerErrorDescription = searchParams.get('error_description')

  if (providerError) {
    const { error, error_description } = getFriendlyAuthError(providerError, providerErrorDescription)
    const url = new URL('/auth/error', origin)
    url.searchParams.set('error', error)
    if (error_description) {
      url.searchParams.set('error_description', error_description)
    }
    return NextResponse.redirect(url)
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const redirectUrl = new URL(next.startsWith('/') ? next : '/dashboard', origin)
      return NextResponse.redirect(redirectUrl)
    }

    const url = new URL('/auth/error', origin)
    url.searchParams.set('error', 'Échec de la connexion')
    url.searchParams.set('error_description', error.message)
    return NextResponse.redirect(url)
  }

  return NextResponse.redirect(new URL('/auth/error', origin))
}
