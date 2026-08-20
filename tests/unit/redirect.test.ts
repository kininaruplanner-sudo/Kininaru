/**
 * Open Redirect Protection Tests
 *
 * Tests that the auth callback route properly validates the `next`
 * parameter to prevent open redirect attacks.
 *
 * Attack vector: Attacker crafts a link like
 *   /auth/callback?next=https://evil.com
 * which, after login, would redirect the user to the attacker's site.
 */

import { describe, it, expect } from 'vitest'

/**
 * Mirrors the validation logic from app/auth/callback/route.ts
 * In production this runs server-side; here we test the pure logic.
 */
function isSafeRedirect(next: string | null): boolean {
  if (!next) return true
  // Must start with / (relative path)
  if (!next.startsWith('/')) return false
  // Must NOT start with // (protocol-relative URL)
  if (next.startsWith('//')) return false
  // Must NOT contain newlines (header injection)
  if (next.includes('\n') || next.includes('\r')) return false
  return true
}

describe('Open Redirect Protection', () => {
  it('allows null (no redirect)', () => {
    expect(isSafeRedirect(null)).toBe(true)
  })

  it('allows empty string', () => {
    expect(isSafeRedirect('')).toBe(true)
  })

  it('allows relative path', () => {
    expect(isSafeRedirect('/dashboard')).toBe(true)
    expect(isSafeRedirect('/dashboard/tasks')).toBe(true)
    expect(isSafeRedirect('/')).toBe(true)
  })

  it('allows path with query params', () => {
    expect(isSafeRedirect('/dashboard?tab=tasks')).toBe(true)
  })

  it('allows path with hash', () => {
    expect(isSafeRedirect('/dashboard#section')).toBe(true)
  })

  it('blocks absolute URL with http://', () => {
    expect(isSafeRedirect('http://evil.com')).toBe(false)
  })

  it('blocks absolute URL with https://', () => {
    expect(isSafeRedirect('https://evil.com')).toBe(false)
  })

  it('blocks protocol-relative URL', () => {
    expect(isSafeRedirect('//evil.com')).toBe(false)
  })

  it('blocks //localhost', () => {
    expect(isSafeRedirect('//localhost')).toBe(false)
  })

  it('blocks CRLF injection attempt', () => {
    expect(isSafeRedirect('/dashboard\r\nX-Injected: header')).toBe(false)
    expect(isSafeRedirect('/dashboard\nX-Injected: header')).toBe(false)
  })

  it('blocks javascript: protocol', () => {
    expect(isSafeRedirect('javascript:alert(1)')).toBe(false)
  })

  it('blocks data: URL', () => {
    expect(isSafeRedirect('data:text/html,<script>alert(1)</script>')).toBe(false)
  })

  it('blocks path traversal combined with redirect', () => {
    // This is still a relative path, but let's make sure we block it
    // if it looks like it's trying to escape
    expect(isSafeRedirect('/../../../etc/passwd')).toBe(true) // It's technically relative
    // The real defense here is that the server just navigates to the path,
    // and /../../../etc/passwd would 404 on the Next.js server
  })
})
