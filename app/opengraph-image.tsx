/**
 * Image Open Graph / Twitter Card de Kininaru (1200×630).
 *
 * Générée à la volée par Next.js (route `/opengraph-image`, image PNG) avec
 * `ImageResponse` — aucune dépendance supplémentaire, aucun binaire à
 * commiter. Le logo utilisé est LE logo existant du projet
 * (`/icon-512x512.png` : lotus + wordmark, bleu de marque #5B8296), chargé
 * depuis l'URL publique du site puis embarqué en data-URI : l'image est donc
 * autonome et reste identique quelle que soit l'origine.
 *
 * Compatibilité :
 * - WhatsApp / Discord / Messenger / Facebook / Slack / Telegram : format
 *   1200×630 (ratio 1.91:1) recommandé.
 * - Lisible en miniature (logo + nom + tagline, pas de texte superflu).
 *
 * Récupérée par les crawlers à l'URL absolue fournie dans les métadonnées
 * (metadataBase = SITE_URL, cf. lib/site-url.ts) :
 *   https://kininaru-planner.vercel.app/opengraph-image
 */
import { ImageResponse } from 'next/og'
import { SITE_URL } from '@/lib/site-url'

export const runtime = 'edge'

export const alt = 'Kininaru — Organisez votre vie avec curiosité'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Logo du projet (/icon-512x512.png), chargé et embarqué en data-URI. */
async function getLogoDataUri(): Promise<string | null> {
  try {
    const res = await fetch(`${SITE_URL}/icon-512x512.png`, { cache: 'force-cache' })
    if (!res.ok) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return `data:image/png;base64,${btoa(bin)}`
  } catch {
    // Ne jamais faire échouer l'image de partage : on rend le visuel sans logo.
    return null
  }
}

export default async function Image() {
  const logo = await getLogoDataUri()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: 'linear-gradient(135deg, #8BB8CC 0%, #5B8296 55%, #3F6579 100%)',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        {/* Halos décoratifs discrets (profondeur, sans bruit) */}
        <div
          style={{
            position: 'absolute',
            top: -140,
            right: -100,
            width: 460,
            height: 460,
            borderRadius: 9999,
            background: 'rgba(255,255,255,0.08)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -180,
            left: 320,
            width: 420,
            height: 420,
            borderRadius: 9999,
            background: 'rgba(255,255,255,0.05)',
          }}
        />

        {/* Badge BÊTA (haut-droite) */}
        <div
          style={{
            position: 'absolute',
            top: 46,
            right: 56,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 22px',
            borderRadius: 9999,
            background: 'rgba(255,255,255,0.14)',
            color: '#FFFFFF',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 3,
          }}
        >
          BÊTA
        </div>

        {/* Contenu principal */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 56,
            paddingLeft: 96,
            paddingRight: 96,
          }}
        >
          {logo ? (
            <img
              src={logo}
              width={190}
              height={190}
              alt=""
              style={{ borderRadius: 42, boxShadow: '0 24px 60px rgba(15, 45, 60, 0.35)' }}
            />
          ) : (
            <div
              style={{
                width: 190,
                height: 190,
                borderRadius: 42,
                background: 'rgba(255,255,255,0.16)',
              }}
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ color: '#FFFFFF', fontSize: 104, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>
              Kininaru
            </div>
            <div
              style={{
                color: 'rgba(255,255,255,0.95)',
                fontSize: 38,
                fontWeight: 500,
                marginTop: 22,
                letterSpacing: 0.2,
              }}
            >
              Organisez votre vie avec curiosité
            </div>
            <div
              style={{
                color: 'rgba(255,255,255,0.82)',
                fontSize: 26,
                fontWeight: 500,
                marginTop: 24,
                letterSpacing: 1.6,
              }}
            >
              TÂCHES · HABITUDES · FOCUS · JOURNAL · COACH IA
            </div>
          </div>
        </div>

        {/* Pied de page */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            right: 56,
            color: 'rgba(255,255,255,0.65)',
            fontSize: 22,
            letterSpacing: 0.4,
          }}
        >
          kininaru-planner.vercel.app
        </div>
      </div>
    ),
    { ...size }
  )
}
