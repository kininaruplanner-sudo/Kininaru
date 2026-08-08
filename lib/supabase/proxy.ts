import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Mode maintenance : coupe-circuit global, avant toute autre logique.
  // Activé via la variable d'env MAINTENANCE_MODE=true (à retirer pour
  // rouvrir l'app). La page /maintenance elle-même, et les assets Next,
  // restent joignables pour éviter une boucle de redirection.
  if (process.env.MAINTENANCE_MODE === 'true' && request.nextUrl.pathname !== '/maintenance') {
    const url = request.nextUrl.clone()
    url.pathname = '/maintenance'
    return NextResponse.rewrite(url)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // Env vars not yet available (e.g. during cold start before env reload).
    // Pass the request through without auth checking rather than crashing.
    return supabaseResponse
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Routes accessible sans compte : l'accueil, l'auth, et les pages légales
  // (politique de confidentialité, CGU, suppression de compte) — ces
  // dernières doivent rester publiques : c'est une exigence de Google
  // OAuth verification et des politiques Play Store / App Store sur la
  // suppression de compte.
  const PUBLIC_PATHS = ['/auth', '/legal']
  const isPublicPath =
    request.nextUrl.pathname === '/' ||
    PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p))

  if (!user && !isPublicPath) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}
