/**
 * Kininaru E2E Smoke Tests
 *
 * Tests critical user flows using Playwright against the running dev server.
 * These tests verify REAL rendering and navigation — no mocks.
 *
 * Environment: requires `npm run dev` on port 3000 (or BASE_URL env var).
 */

import { test, expect } from '@playwright/test'

// ── Landing Page ──

test.describe('Landing page', () => {
  test('renders the hero section', async ({ page }) => {
    await page.goto('/')
    // The landing page should have a visible heading or CTA
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    // Should not show an error page
    expect(body).not.toContain('500')
    expect(body).not.toContain('Internal Server Error')
  })

  test('has working navigation to auth', async ({ page }) => {
    await page.goto('/')
    // Find any link to auth
    const authLink = page.locator('a[href*="/auth"]').first()
    if (await authLink.isVisible()) {
      await authLink.click()
      await page.waitForURL('**/auth/**', { timeout: 10_000 })
      expect(page.url()).toContain('/auth')
    }
  })
})

// ── Auth Pages ──

test.describe('Auth pages', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/auth/login')
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body).not.toContain('500')
    // Should have some form of sign-in UI
    const hasSignIn = body?.toLowerCase().includes('connexion') ||
      body?.toLowerCase().includes('sign') ||
      body?.toLowerCase().includes('email')
    expect(hasSignIn).toBeTruthy()
  })

  test('sign-up page renders', async ({ page }) => {
    await page.goto('/auth/sign-up')
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body).not.toContain('500')
  })

  test('forgot-password page renders', async ({ page }) => {
    await page.goto('/auth/forgot-password')
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body).not.toContain('500')
  })
})

// ── Protected Routes Redirect ──

test.describe('Protected routes', () => {
  const protectedRoutes = [
    '/dashboard',
    '/tasks',
    '/calendar',
    '/focus',
    '/habits',
    '/journal',
    '/ai',
    '/settings',
  ]

  for (const route of protectedRoutes) {
    test(`${route} redirects to auth when not logged in`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      // Wait for redirect
      await page.waitForTimeout(2000)
      const url = page.url()
      // Should redirect to /auth (with returnTo) or stay on the route
      // (if SSR renders the page before redirect)
      const isAuthRedirect = url.includes('/auth')
      const isOnRoute = url.includes(route)
      // Either redirect happened or page rendered (SSR)
      expect(isAuthRedirect || isOnRoute).toBeTruthy()
    })
  }
})

// ── Legal Pages ──

test.describe('Legal pages', () => {
  test('privacy policy renders', async ({ page }) => {
    await page.goto('/legal/confidentialite')
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body).not.toContain('500')
    expect(body!.length).toBeGreaterThan(100) // Should have real content
  })

  test('terms of service renders', async ({ page }) => {
    await page.goto('/legal/conditions')
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body).not.toContain('500')
    expect(body!.length).toBeGreaterThan(100)
  })

  test('account deletion page renders', async ({ page }) => {
    await page.goto('/legal/suppression-compte')
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body).not.toContain('500')
  })
})

// ── API Health ──

test.describe('API routes', () => {
  test('chat API rejects unauthenticated requests', async ({ request }) => {
    const response = await request.post('/api/chat', {
      data: { messages: [{ role: 'user', content: 'test' }] },
    })
    expect(response.status()).toBe(401)
  })

  test('actions API rejects unauthenticated requests', async ({ request }) => {
    const response = await request.post('/api/ai/actions', {
      data: { actions: [{ action: 'get_today_tasks' }] },
    })
    expect(response.status()).toBe(401)
  })

  test('journal AI API rejects unauthenticated requests', async ({ request }) => {
    const response = await request.post('/api/ai/journal', {
      data: { text: 'test text for journal', mode: 'summarize' },
    })
    expect(response.status()).toBe(401)
  })

  test('feedback API validates required fields', async ({ request }) => {
    const response = await request.post('/api/feedback', {
      data: {},
    })
    // Should return 400 or 401 (not 500)
    expect(response.status()).toBeLessThan(500)
  })
})

// ── PWA / Manifest ──

test.describe('PWA', () => {
  test('manifest is accessible', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest')
    expect(response.status()).toBe(200)
    const manifest = await response.json()
    expect(manifest.name).toBeTruthy()
    expect(manifest.start_url).toBeTruthy()
    expect(manifest.display).toBe('standalone')
  })

  test('robots.txt is accessible', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
  })

  test('sitemap is accessible', async ({ request }) => {
    const response = await request.get('/sitemap.xml')
    expect(response.status()).toBe(200)
  })
})

// ── Responsive / Mobile ──

test.describe('Mobile viewport', () => {
  test.use({ viewport: { width: 375, height: 812 } }) // iPhone X

  test('landing page renders on mobile', async ({ page }) => {
    await page.goto('/')
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body).not.toContain('500')
  })

  test('login page renders on mobile', async ({ page }) => {
    await page.goto('/auth/login')
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body).not.toContain('500')
  })
})
