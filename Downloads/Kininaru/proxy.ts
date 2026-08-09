import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    // - sw.js / manifest.webmanifest / sitemap.xml / robots.txt (PWA and
    //   SEO resources must stay public so the browser, crawlers and the
    //   service worker can reach them even when the user is signed out)
    // - legal (public legal pages: conditions, confidentialite, ...)
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|sitemap\\.xml|robots\\.txt|legal|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
