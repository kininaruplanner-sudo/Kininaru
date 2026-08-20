/**
 * useSignedUrl — React hook that transparently refreshes expired
 * Supabase Storage signed URLs.
 *
 * Usage:
 *   const { src, onError } = useSignedUrl(originalUrl)
 *   <img src={src} onError={onError} />
 *
 * When the image 403s (expired token), the hook fetches a fresh URL
 * and triggers a re-render once. After that, the fresh URL is cached
 * for the component's lifetime.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { refreshSignedUrl } from '../supabase'

export function useSignedUrl(url: string | null | undefined) {
  const [currentUrl, setCurrentUrl] = useState(url ?? '')
  const refreshedRef = useRef(false)

  // Reset when the source URL changes (e.g. different image)
  useEffect(() => {
    setCurrentUrl(url ?? '')
    refreshedRef.current = false
  }, [url])

  const handleError = useCallback(async () => {
    if (refreshedRef.current || !url || !url.includes('token=')) return
    refreshedRef.current = true

    try {
      const fresh = await refreshSignedUrl(url)
      if (fresh !== url) {
        setCurrentUrl(fresh)
      }
    } catch {
      // If refresh fails, keep the original URL
    }
  }, [url])

  return { src: currentUrl, onError: handleError }
}
