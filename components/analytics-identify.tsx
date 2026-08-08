'use client'

import { useEffect } from 'react'
import { identifyUser } from '@/lib/analytics'

interface Props {
  userId: string
  email?: string | null
}

export function AnalyticsIdentify({ userId, email }: Props) {
  useEffect(() => {
    identifyUser(userId, email ? { email } : undefined)
  }, [userId, email])

  return null
}
