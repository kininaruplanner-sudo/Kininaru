import { webPushConfigured, getPublicVapidKey } from '@/lib/web-push/server'

export const runtime = 'nodejs'

/**
 * GET /api/push/config — public.
 *
 * Tells the browser whether Web Push is available and, if so, gives it the
 * PUBLIC VAPID key (safe to expose by design — it is only used to encrypt
 * messages to this service). The private key never leaves the server.
 */
export async function GET() {
  const enabled = webPushConfigured()
  return Response.json({
    // `supported` here means "the server can deliver push". Whether THIS
    // browser supports push is decided client-side (PushManager check).
    supported: enabled,
    enabled,
    vapidPublicKey: enabled ? getPublicVapidKey() : null,
  })
}
