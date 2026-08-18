/**
 * Kininaru Assistant — Proactivity Module
 *
 * Barrel export for the proactivity system.
 */

export { detectOpportunities } from './opportunities'
export type { Opportunity, OpportunityType } from './opportunities'
export { shouldShow, recordOpportunityShown, selectBestOpportunity } from './priority-engine'
export type { Decision } from './priority-engine'
export {
  getProactiveSuggestion,
  recordSuggestionShown,
  formatOpportunityForContext,
  isProactivityEnabled,
} from './engine'
