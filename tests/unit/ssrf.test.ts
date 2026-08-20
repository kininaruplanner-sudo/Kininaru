/**
 * SSRF Protection Tests
 *
 * Tests the isPrivateIP utility that blocks access to private/internal
 * networks, preventing Server-Side Request Forgery attacks.
 *
 * These tests verify the critical security boundary: the server should
 * never be used as a proxy to access internal resources.
 */

import { describe, it, expect } from 'vitest'
import { isPrivateIP, dnsResolve } from '../../lib/ssrf'

describe('isPrivateIP', () => {
  /* ------------------------------------------------------------------ */
  /* Private / loopback IPs — should block                               */
  /* ------------------------------------------------------------------ */

  it('blocks loopback 127.0.0.1', () => {
    expect(isPrivateIP('127.0.0.1')).toBe(true)
  })

  it('blocks loopback 127.x.x.x', () => {
    expect(isPrivateIP('127.0.0.5')).toBe(true)
    expect(isPrivateIP('127.255.255.255')).toBe(true)
  })

  it('blocks private 10.0.0.0/8', () => {
    expect(isPrivateIP('10.0.0.1')).toBe(true)
    expect(isPrivateIP('10.255.255.255')).toBe(true)
  })

  it('blocks private 172.16.0.0/12', () => {
    expect(isPrivateIP('172.16.0.1')).toBe(true)
    expect(isPrivateIP('172.31.255.255')).toBe(true)
  })

  it('blocks private 192.168.0.0/16', () => {
    expect(isPrivateIP('192.168.0.1')).toBe(true)
    expect(isPrivateIP('192.168.1.100')).toBe(true)
  })

  it('blocks 0.0.0.0', () => {
    expect(isPrivateIP('0.0.0.0')).toBe(true)
  })

  it('blocks link-local 169.254.x.x', () => {
    expect(isPrivateIP('169.254.1.1')).toBe(true)
  })

  /* ------------------------------------------------------------------ */
  /* IPv6 private addresses — should block                               */
  /* ------------------------------------------------------------------ */

  it('blocks IPv6 loopback ::1', () => {
    expect(isPrivateIP('::1')).toBe(true)
  })

  it('blocks IPv6 link-local fe80::', () => {
    expect(isPrivateIP('fe80::1')).toBe(true)
  })

  it('blocks IPv6 ULA fc00::', () => {
    expect(isPrivateIP('fc00::1')).toBe(true)
  })

  it('blocks IPv6 ULA fd00::', () => {
    expect(isPrivateIP('fd00::1')).toBe(true)
  })

  /* ------------------------------------------------------------------ */
  /* Public IPs — should allow                                           */
  /* ------------------------------------------------------------------ */

  it('allows public IPs', () => {
    expect(isPrivateIP('8.8.8.8')).toBe(false)
    expect(isPrivateIP('1.1.1.1')).toBe(false)
    expect(isPrivateIP('203.0.113.1')).toBe(false)
    expect(isPrivateIP('198.51.100.1')).toBe(false)
  })

  it('allows public IPv6', () => {
    expect(isPrivateIP('2606:4700::1')).toBe(false)
    expect(isPrivateIP('2001:4860:4860::8888')).toBe(false)
  })

  /* ------------------------------------------------------------------ */
  /* Edge cases                                                          */
  /* ------------------------------------------------------------------ */

  it('handles empty string', () => {
    expect(isPrivateIP('')).toBe(true) // Block empty/invalid
  })

  it('blocks 127.x.x.x range comprehensively', () => {
    expect(isPrivateIP('127.1.2.3')).toBe(true)
    expect(isPrivateIP('127.100.200.50')).toBe(true)
  })

  it('blocks 192.168.x.x comprehensively', () => {
    expect(isPrivateIP('192.168.1.1')).toBe(true)
    expect(isPrivateIP('192.168.254.254')).toBe(true)
  })

  it('blocks metadata endpoint 169.254.169.254', () => {
    expect(isPrivateIP('169.254.169.254')).toBe(true)
  })
})

describe('dnsResolve', () => {
  it('resolves a public hostname', async () => {
    const ips = await dnsResolve('example.com')
    expect(ips).toBeDefined()
    expect(Array.isArray(ips)).toBe(true)
    expect(ips.length).toBeGreaterThan(0)
    // All resolved IPs should be public
    for (const ip of ips) {
      expect(isPrivateIP(ip)).toBe(false)
    }
  })

  it('throws for non-existent hostname', async () => {
    await expect(dnsResolve('this-hostname-definitely-does-not-exist-12345.example.invalid')).rejects.toThrow()
  })

  it('directly verifies 127.0.0.1 is private', () => {
    // On some systems localhost doesn't resolve via DNS,
    // so we test the private IP check directly
    expect(isPrivateIP('127.0.0.1')).toBe(true)
    expect(isPrivateIP('127.0.0.2')).toBe(true)
  })
})
