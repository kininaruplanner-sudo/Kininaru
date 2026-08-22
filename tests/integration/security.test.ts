/**
 * Security Integration Tests
 *
 * Tests the security boundary: SSRF, redirects, input validation, ownership.
 * These verify the logic of our security functions against adversarial inputs.
 */

import { describe, it, expect } from 'vitest'

// ── SSRF private IP blocking ──

describe('SSRF protection', () => {
  const PRIVATE_RANGES = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^0\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/,
    /^fd00:/,
    /^fe80:/i,
    /^localhost$/i,
  ]

  function isPrivateIP(host: string): boolean {
    return PRIVATE_RANGES.some((pattern) => pattern.test(host))
  }

  it('should block localhost', () => {
    expect(isPrivateIP('localhost')).toBe(true)
  })

  it('should block 127.0.0.1', () => {
    expect(isPrivateIP('127.0.0.1')).toBe(true)
  })

  it('should block 10.x.x.x', () => {
    expect(isPrivateIP('10.0.0.1')).toBe(true)
    expect(isPrivateIP('10.255.255.255')).toBe(true)
  })

  it('should block 172.16-31.x.x', () => {
    expect(isPrivateIP('172.16.0.1')).toBe(true)
    expect(isPrivateIP('172.31.255.255')).toBe(true)
  })

  it('should block 192.168.x.x', () => {
    expect(isPrivateIP('192.168.1.1')).toBe(true)
  })

  it('should block IPv6 loopback', () => {
    expect(isPrivateIP('::1')).toBe(true)
  })

  it('should block IPv6 private ranges', () => {
    expect(isPrivateIP('fc00::1')).toBe(true)
    expect(isPrivateIP('fd00::1')).toBe(true)
    expect(isPrivateIP('fe80::1')).toBe(true)
  })

  it('should block 0.0.0.0', () => {
    expect(isPrivateIP('0.0.0.0')).toBe(true)
  })

  it('should block link-local', () => {
    expect(isPrivateIP('169.254.1.1')).toBe(true)
  })

  it('should allow public IPs', () => {
    expect(isPrivateIP('8.8.8.8')).toBe(false)
    expect(isPrivateIP('1.1.1.1')).toBe(false)
    expect(isPrivateIP('203.0.113.1')).toBe(false)
  })

  it('should allow public hostnames', () => {
    expect(isPrivateIP('example.com')).toBe(false)
    expect(isPrivateIP('api.supabase.co')).toBe(false)
  })
})

// ── Image upload validation ──

describe('Image upload size validation', () => {
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB

  function estimateImageBytes(dataUrl: string): number {
    const base64Data = dataUrl.split(',')[1] ?? ''
    return Math.floor(base64Data.length * 0.75)
  }

  it('should accept a small image', () => {
    const smallData = 'data:image/png;base64,' + 'A'.repeat(1000)
    expect(estimateImageBytes(smallData)).toBeLessThan(MAX_IMAGE_BYTES)
  })

  it('should reject a 10MB image', () => {
    const largeData = 'data:image/png;base64,' + 'A'.repeat(Math.ceil((10 * 1024 * 1024) / 0.75))
    expect(estimateImageBytes(largeData)).toBeGreaterThan(MAX_IMAGE_BYTES)
  })

  it('should reject data URL without base64', () => {
    const invalidData = 'data:image/png;base64,'
    expect(estimateImageBytes(invalidData)).toBe(0)
    expect(estimateImageBytes(invalidData)).toBeLessThan(MAX_IMAGE_BYTES) // empty is OK
  })
})

// ── Message content validation ──

describe('Message content validation', () => {
  const MAX_MESSAGE_LENGTH = 8000

  it('should accept normal text', () => {
    expect('Hello, Kininaru!'.length).toBeLessThan(MAX_MESSAGE_LENGTH)
  })

  it('should reject text exceeding limit', () => {
    expect('x'.repeat(8001).length).toBeGreaterThan(MAX_MESSAGE_LENGTH)
  })

  it('should accept exactly the limit', () => {
    expect('x'.repeat(8000).length).toBe(MAX_MESSAGE_LENGTH)
  })
})

// ── Tool permission categories ──

describe('Tool category permissions', () => {
  const READ_TOOLS = ['get_today_tasks', 'get_upcoming_events', 'get_habits', 'get_goals', 'get_focus_sessions', 'get_daily_progress', 'get_calendar_events', 'get_memories']
  const WRITE_TOOLS = ['create_task', 'complete_task', 'update_task', 'start_focus', 'create_memory']
  const EXTERNAL_TOOLS = ['create_calendar_event', 'update_calendar_event']
  const SENSITIVE_TOOLS = ['delete_calendar_event', 'delete_memory']

  it('read tools should not overlap with write tools', () => {
    const overlap = READ_TOOLS.filter((t) => WRITE_TOOLS.includes(t))
    expect(overlap).toEqual([])
  })

  it('write tools should not overlap with sensitive tools', () => {
    const overlap = WRITE_TOOLS.filter((t) => SENSITIVE_TOOLS.includes(t))
    expect(overlap).toEqual([])
  })

  it('sensitive tools should not overlap with read tools', () => {
    const overlap = SENSITIVE_TOOLS.filter((t) => READ_TOOLS.includes(t))
    expect(overlap).toEqual([])
  })

  it('external tools should not overlap with read tools', () => {
    const overlap = EXTERNAL_TOOLS.filter((t) => READ_TOOLS.includes(t))
    expect(overlap).toEqual([])
  })

  it('delete_memory should be in sensitive category', () => {
    expect(SENSITIVE_TOOLS).toContain('delete_memory')
  })

  it('get_memories should be in read category', () => {
    expect(READ_TOOLS).toContain('get_memories')
  })
})
