import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  // Default destination after OAuth: the signed-in dashboard (never loop back
  // to the public landing page).
  const next = searchParams.get('next') ?? '/dashboard'

  // Security: only allow internal relative paths (starting with /).
  // Never follow absolute URLs (https://evil.com) to prevent open redirect.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // After a password-recovery email the session is already established;
      // send the user straight to the reset-password form.
      if (safeNext === '/auth/reset-password') {
        return NextResponse.redirect(`${origin}/auth/reset-password`)
      }
      return NextResponse.redirect(`${origin}${safeNext}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
