'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * GA4 page views with QUERY STRINGS STRIPPED.
 *
 * Privacy: the automatic page_view sent by gtag includes the full URL with
 * its query string. Kininaru's URLs carry personal data in the query
 * (taskId, task titles, journal dates) — that must never reach Analytics.
 * The layout configures gtag with send_page_view: false and this component
 * sends page_view with only the pathname, on the initial load and on every
 * SPA navigation.
 */
export function AnalyticsPageViews() {
  const pathname = usePathname()
  const lastPathRef = useRef<string | null>(null)

  useEffect(() => {
    if (lastPathRef.current === pathname) return
    lastPathRef.current = pathname
    try {
      const w = window as unknown as { gtag?: (...args: unknown[]) => void }
      w.gtag?.('event', 'page_view', {
        page_path: pathname,
        page_title: document.title,
      })
    } catch {
      // analytics never blocks the app
    }
  }, [pathname])

  return null
}
