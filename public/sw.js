/* =====================================================================
   Kininaru — service worker

   Strategy (deliberately conservative — no aggressive caching):
   - Navigations  -> network-only. Pages are always fetched fresh and are
                     NEVER written to the cache, so no snapshot of private
                     data (dashboard, family, journal, ...) can ever be
                     served from cache. Offline = an honest "you need
                     internet" page.
   - Static build assets (/_next/static/*, icons, manifest, fonts)
     -> stale-while-revalidate: instant repeat visits, updated in the
        background. Asset filenames are content-hashed by Next.js, so a
        deploy can never serve a stale version.
   - Private / dynamic endpoints (Supabase auth & data, /api/chat) are
     NEVER cached — they always hit the network. No tokens, sessions,
     personal data or AI responses ever touch the cache.

   Bump CACHE_VERSION when deploying a release whose cached resources
   must be invalidated immediately (old caches are purged on activate).
   ===================================================================== */

const CACHE_VERSION = 'v1'
const ASSET_CACHE = `kininaru-assets-${CACHE_VERSION}`
const CACHE_WHITELIST = [ASSET_CACHE]

// Same-origin paths that must always hit the network and never be cached.
const NEVER_CACHE = [
  /^\/api\//, // all API routes (AI coach included)
  /\/auth\/v1\//, // Supabase auth (belt-and-suspenders: cross-origin is already bypassed)
]

// Honest offline fallback — we do not fake an offline app.
const OFFLINE_PAGE = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Kininaru — Hors ligne</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#F7F9FC; color:#22283B; font-family: system-ui, -apple-system, sans-serif; }
  .box { text-align:center; padding:24px; }
  h1 { font-size:20px; margin:0 0 8px; }
  p { color:#6B7280; font-size:14px; margin:0 0 16px; }
  button { background:#2F3F63; color:#fff; border:0; border-radius:12px; padding:10px 18px; font-size:14px; cursor:pointer; }
</style>
</head>
<body>
  <div class="box">
    <h1>Kininaru</h1>
    <p>Connexion Internet nécessaire pour cette fonctionnalité.</p>
    <button onclick="location.reload()">Réessayer</button>
  </div>
</body>
</html>`

/* ----------------------------- lifecycle ---------------------------- */

self.addEventListener('install', () => {
  // Activate the new SW as soon as it is installed.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !CACHE_WHITELIST.includes(key)).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

/* ------------------------------- push --------------------------------
   Real Web Push (ÉTAPE 15.5 §9, §21): the server encrypts the payload to
   this subscription; the SW shows the notification and handles clicks.
   -------------------------------------------------------------------- */

self.addEventListener('push', (event) => {
  let data = { title: 'Kininaru', body: '', link: '/', tag: 'kininaru' }
  try {
    if (event.data) {
      const parsed = event.data.json()
      data = {
        title: typeof parsed.title === 'string' ? parsed.title : 'Kininaru',
        body: typeof parsed.body === 'string' ? parsed.body : '',
        link: typeof parsed.link === 'string' && parsed.link.startsWith('/') ? parsed.link : '/',
        tag: typeof parsed.tag === 'string' ? parsed.tag : 'kininaru',
      }
    }
  } catch {
    // Payload not JSON — fall back to defaults (still show a notification).
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: data.tag,
      data: { link: data.link },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = event.notification.data && event.notification.data.link
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus()
            if (link && 'navigate' in client) {
              client.navigate(link)
            }
            return
          }
        }
        return self.clients.openWindow(link || '/')
      })
  )
})

self.addEventListener('notificationclose', () => {
  // Nothing to clean up — kept for future analytics hooks.
})

/* ------------------------------ helpers ----------------------------- */

function isCacheable(response) {
  return response && response.status === 200 && response.type === 'basic'
}

function staleWhileRevalidate(request) {
  return caches.open(ASSET_CACHE).then((cache) =>
    cache.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (isCacheable(response)) {
            cache.put(request, response.clone())
          }
          return response
        })
        .catch(() => cached)
      return cached || network
    })
  )
}

/* ------------------------------ fetch ------------------------------- */

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return // never intercept writes/auth POSTs

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // Supabase, Groq, fonts... network only
  if (NEVER_CACHE.some((re) => re.test(url.pathname))) return // private/dynamic: network only

  // Navigations: network-only (fresh page every time), honest offline page
  // when there is no connection. Page responses are never cached.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(OFFLINE_PAGE, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
      )
    )
    return
  }

  // Static resources only — stale-while-revalidate.
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icon-') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/sw.js' ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(staleWhileRevalidate(request))
  }
})
