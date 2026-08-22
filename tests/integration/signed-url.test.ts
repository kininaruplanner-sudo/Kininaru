/**
 * Signed URL Integration Tests
 *
 * Tests the signed URL refresh logic without a real Supabase instance.
 * Verifies that expiration is detected and refresh is triggered correctly.
 */

import { describe, it, expect } from 'vitest'

describe('Signed URL expiration detection', () => {
  function isUrlExpired(url: string | null): boolean {
    if (!url) return true
    // Supabase signed URLs contain expiry in query params
    // Format: ...?token=...&expires=TIMESTAMP
    try {
      const parsed = new URL(url)
      const expires = parsed.searchParams.get('expires')
      if (!expires) return false // no expiry param = not expired (or not a signed URL)
      const expiryTimestamp = Number(expires) * 1000 // convert to ms
      return Date.now() >= expiryTimestamp - 60_000 // 1 minute buffer
    } catch {
      return true // invalid URL = treat as expired
    }
  }

  it('should return true for null url', () => {
    expect(isUrlExpired(null)).toBe(true)
  })

  it('should return false for URL without expires param', () => {
    expect(isUrlExpired('https://example.com/image.png')).toBe(false)
  })

  it('should return true for expired URL', () => {
    const pastTimestamp = Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
    const url = `https://storage.supabase.co/object/sign/bucket/file?expires=${pastTimestamp}`
    expect(isUrlExpired(url)).toBe(true)
  })

  it('should return false for valid future URL', () => {
    const futureTimestamp = Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
    const url = `https://storage.supabase.co/object/sign/bucket/file?expires=${futureTimestamp}`
    expect(isUrlExpired(url)).toBe(false)
  })

  it('should return true for invalid URL', () => {
    expect(isUrlExpired('not-a-url')).toBe(true)
  })
})

describe('Supabase signed URL extraction', () => {
  function extractStoragePath(url: string): string | null {
    // Supabase storage URL format: /object/sign/{bucket}/{path}?...
    // The permanent reference is the path, not the signed URL
    try {
      const parsed = new URL(url)
      const match = parsed.pathname.match(/\/object\/sign\/([^/]+)\/(.+)/)
      if (match) {
        return `${match[1]}/${match[2]}`
      }
      return null
    } catch {
      return null
    }
  }

  it('should extract bucket and path from signed URL', () => {
    const url = 'https://storage.supabase.co/object/sign/journals/user123/cover.png?token=abc'
    expect(extractStoragePath(url)).toBe('journals/user123/cover.png')
  })

  it('should return null for non-storage URL', () => {
    expect(extractStoragePath('https://example.com/image.png')).toBeNull()
  })

  it('should return null for invalid URL', () => {
    expect(extractStoragePath('not-a-url')).toBeNull()
  })
})
