/**
 * Kininaru Assistant — Proactivity Engine
 *
 * Combines opportunity detection with the priority engine to produce
 * actionable suggestions. This is the main entry point for the
 * proactivity system.
 *
 * Flow:
 * 1. Detect opportunities from user data
 * 2. Filter through priority engine (cooldowns, limits, quiet hours)
 * 3. Return the best opportunity (or null if none)
 *
 * Usage:
 *   const suggestion = await getProactiveSuggestion(supabase, userId)
 *   if (suggestion) {
 *     // Show to user
 *   }
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { detectOpportunities, type Opportunity } from './opportunities'
import { selectBestOpportunity, recordOpportunityShown } from './priority-engine'

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Gets the best proactive suggestion for the user.
 *
 * @param supabase - Authenticated Supabase client
 * @param userId - Current user ID
 * @returns The best opportunity to show, or null if none
 */
export async function getProactiveSuggestion(
  supabase: SupabaseClient,
  userId: string
): Promise<Opportunity | null> {
  try {
    const opportunities = await detectOpportunities(supabase, userId)
    return selectBestOpportunity(opportunities)
  } catch (err) {
    console.error('[Kininaru] Proactivity detection failed:', err)
    return null
  }
}

/**
 * Records that a suggestion was shown to the user.
 * Call this after displaying the suggestion.
 */
export function recordSuggestionShown(opportunity: Opportunity) {
  recordOpportunityShown(opportunity)
}

/**
 * Formats an opportunity into a context string for the AI system prompt.
 * Used when the AI generates a response about the proactive suggestion.
 */
export function formatOpportunityForContext(opportunity: Opportunity): string {
  const parts = [
    `SUGGESTION PROACTIVE (à considérer dans ta réponse) :`,
    `• Type : ${opportunity.type}`,
    `• Priorité : ${opportunity.priority}/100`,
    `• Titre : ${opportunity.title}`,
    `• Message : ${opportunity.message}`,
  ]

  if (opportunity.actionLabel) {
    parts.push(`• Action : ${opportunity.actionLabel}`)
  }
  if (opportunity.actionHref) {
    parts.push(`• Lien : ${opportunity.actionHref}`)
  }

  return parts.join('\n')
}

/**
 * Checks if the proactivity system is enabled for this user.
 * Currently always true (no global disable).
 */
export function isProactivityEnabled(): boolean {
  // Could be tied to a user preference in the future
  return true
}
