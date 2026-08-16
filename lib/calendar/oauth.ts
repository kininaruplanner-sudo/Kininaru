/**
 * Server-side OAuth helpers (Google Calendar / Microsoft Graph).
 *
 * NEVER import this module from client code: it exchanges authorization
 * codes and refreshes tokens using the server-side client secrets. Tokens
 * are stored via the service role in calendar_connections, which the
 * client cannot read (see supabase/calendar-security.sql).
 */

export interface OAuthTokens {
  access_token: string
  refresh_token: string | null
  expires_at: Date
}

export function googleOAuthConfig(): { clientId: string; secret: string } | null {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !secret) return null
  return { clientId, secret }
}

export function microsoftOAuthConfig(): { clientId: string; secret: string } | null {
  const clientId = process.env.NEXT_PUBLIC_MICROSOFT_OAUTH_CLIENT_ID
  const secret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET
  if (!clientId || !secret) return null
  return { clientId, secret }
}

/* ------------------------------------------------------------------ */
/* Google                                                              */
/* ------------------------------------------------------------------ */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

export function googleAuthorizeUrl(origin: string, clientId: string, state: string): string {
  const url = new URL(GOOGLE_AUTH_URL)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', `${origin}/api/calendar/google/callback`)
  // calendar.readonly: display external events — never more than needed.
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.readonly')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', state)
  return url.toString()
}

export async function exchangeGoogleCode(
  code: string,
  clientId: string,
  secret: string,
  redirectUri: string
): Promise<OAuthTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: secret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  })
  if (!res.ok) {
    throw new Error(`Échange du code Google refusé (${res.status})`)
  }
  const data = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
  }
  if (!data.access_token) throw new Error('Réponse Google sans access_token')
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? null,
    expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
  }
}

export async function refreshGoogleToken(
  refreshToken: string,
  clientId: string,
  secret: string
): Promise<OAuthTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: secret,
      grant_type: 'refresh_token',
    }).toString(),
  })
  if (!res.ok) throw new Error(`Refresh Google refusé (${res.status})`)
  const data = (await res.json()) as { access_token: string; expires_in?: number }
  if (!data.access_token) throw new Error('Réponse Google sans access_token')
  return {
    access_token: data.access_token,
    refresh_token: refreshToken,
    expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
  }
}

/**
 * Stable external account id + display name.
 *
 * Identity = the PRIMARY calendar id, which is stable per Google account
 * (for Gmail accounts it IS the account email). We deliberately do NOT
 * take the first calendar returned by calendarList: with maxResults=1 the
 * ordering is not guaranteed to put the primary calendar first, which
 * would make the identity unstable and could drift from the calendar the
 * sync actually reads. The primary calendar is picked explicitly, with a
 * fallback to the first item when nothing is flagged primary.
 */
export async function googleAccountInfo(accessToken: string): Promise<{ id: string; name: string }> {
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250&minAccessRole=reader',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) throw new Error(`Profil Google inaccessible (${res.status})`)
  const data = (await res.json()) as {
    items?: { id?: string; primary?: boolean; summaryOverride?: string }[]
  }
  const primary = (data.items ?? []).find((c) => c.primary === true)
  const chosen = primary ?? data.items?.[0]
  const id = chosen?.id
  if (!id) throw new Error('Aucun calendrier trouvé sur ce compte Google')
  return { id, name: primary?.summaryOverride ?? id }
}

/* ------------------------------------------------------------------ */
/* Microsoft                                                           */
/* ------------------------------------------------------------------ */

const MS_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

export function microsoftAuthorizeUrl(origin: string, clientId: string, state: string): string {
  const url = new URL(MS_AUTH_URL)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', `${origin}/api/calendar/microsoft/callback`)
  url.searchParams.set('scope', 'offline_access Calendars.Read')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', state)
  return url.toString()
}

export async function exchangeMicrosoftCode(
  code: string,
  clientId: string,
  secret: string,
  redirectUri: string
): Promise<OAuthTokens> {
  const res = await fetch(MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: secret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  })
  if (!res.ok) throw new Error(`Échange du code Microsoft refusé (${res.status})`)
  const data = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
  }
  if (!data.access_token) throw new Error('Réponse Microsoft sans access_token')
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? null,
    expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
  }
}

export async function refreshMicrosoftToken(
  refreshToken: string,
  clientId: string,
  secret: string
): Promise<OAuthTokens> {
  const res = await fetch(MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: secret,
      grant_type: 'refresh_token',
      scope: 'offline_access Calendars.Read',
    }).toString(),
  })
  if (!res.ok) throw new Error(`Refresh Microsoft refusé (${res.status})`)
  const data = (await res.json()) as { access_token: string; expires_in?: number }
  if (!data.access_token) throw new Error('Réponse Microsoft sans access_token')
  return {
    access_token: data.access_token,
    refresh_token: refreshToken,
    expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
  }
}

/**
 * Stable external account id + display name.
 *
 * Identity = the SIGNED-IN USER, resolved via GET /me — not the default
 * calendar. The Graph /me `id` (object id) is stable across sessions and
 * calendars, whereas a calendar id identifies the calendar, not the
 * account, and varies if the default calendar changes. Display name falls
 * back to the mailbox address, then to the id. The events themselves are
 * still read from the default calendar (calendarview) in the sync route.
 */
export async function microsoftAccountInfo(
  accessToken: string
): Promise<{ id: string; name: string }> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Profil Microsoft inaccessible (${res.status})`)
  const data = (await res.json()) as { id?: string; displayName?: string; mail?: string }
  const id = data.id
  if (!id) throw new Error('Identité Microsoft introuvable')
  return { id, name: data.displayName || data.mail || id }
}
