/**
 * Rate Limiter Tests
 *
 * Tests the distributed rate limiter used to protect AI endpoints
 * from abuse (token consumption, brute force, etc.)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { isRateLimited } from '../../lib/ai/rate-limit'

describe('isRateLimited', () => {
  beforeEach(async () => {
    // The rate limiter should reset between test groups
    // Each test uses a unique key to avoid interference
  })

  it('allows first request', async () => {
    const result = await isRateLimited('test', 'user-first-req', 10)
    expect(result).toBe(false)
  })

  it('blocks after exceeding limit', async () => {
    const key = 'user-limit-test'
    // Make requests up to the limit
    for (let i = 0; i < 5; i++) {
      const result = await isRateLimited('test', key, 5)
      expect(result).toBe(false)
    }
    // Next request should be blocked
    const result = await isRateLimited('test', key, 5)
    expect(result).toBe(true)
  })

  it('different namespaces are independent', async () => {
    const key = 'user-namespace-test'
    // Exhaust 'chat' namespace
    for (let i = 0; i < 3; i++) {
      await isRateLimited('chat', key, 3)
    }
    // 'actions' namespace should still be available
    const result = await isRateLimited('actions', key, 3)
    expect(result).toBe(false)
  })

  it('different user keys are independent', async () => {
    // User A
    for (let i = 0; i < 3; i++) {
      await isRateLimited('test', 'user-A', 3)
    }
    // User B should still be fine
    const result = await isRateLimited('test', 'user-B', 3)
    expect(result).toBe(false)
  })
})
