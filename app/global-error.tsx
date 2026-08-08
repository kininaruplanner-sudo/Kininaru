'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  // Deliberately plain, dependency-free markup: if the root layout itself
  // crashed, we can't rely on its fonts/theme/providers being available.
  return (
    <html lang="fr">
      <body
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F7F9FC',
          fontFamily: 'system-ui, sans-serif',
          padding: '1rem',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '24rem' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Kininaru a rencontré un problème
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '1.5rem' }}>
            L'application n'a pas pu se charger correctement. Rechargez la page pour réessayer.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: '#3E5488',
              color: 'white',
              border: 'none',
              borderRadius: '0.75rem',
              padding: '0.625rem 1.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Recharger
          </button>
        </div>
      </body>
    </html>
  )
}
