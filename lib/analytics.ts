'use client'

import posthog from 'posthog-js'

let initialized = false

/**
 * Initializes PostHog once, client-side only. Safe to call multiple times —
 * only the first call does anything. No-ops entirely if
 * NEXT_PUBLIC_POSTHOG_KEY isn't set, so analytics stays fully optional.
 */
export function initAnalytics() {
  if (initialized || typeof window === 'undefined') return

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
    capture_pageview: true,
    capture_pageleave: true,
    // Only create a PostHog "person" once we've identified a real user —
    // avoids generating a profile for every anonymous landing-page visit.
    person_profiles: 'identified_only',
  })
  initialized = true
}

/**
 * Links the current browser session to a real user. Call this once auth
 * state is known (see components/analytics-identify.tsx) — this is what
 * ties every subsequent event to Supabase's `user.id`.
 */
export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (!initialized) return
  posthog.identify(userId, traits)
}

/** Call on sign-out so the next session isn't attributed to the previous user. */
export function resetAnalytics() {
  if (!initialized) return
  posthog.reset()
}

export function trackEvent(name: string, properties?: Record<string, unknown>) {
  if (!initialized) return
  posthog.capture(name, properties)
}
