/**
 * Kininaru Assistant — Planning Module
 *
 * Barrel export for contextual intelligence and smart planning.
 */

export { buildTemporalContext, calculateAvailableSlots, calculateDailyLoad } from './temporal-context'
export type { TemporalContext, TimeSlot, TimePeriod } from './temporal-context'
export { selectNextAction } from './next-action-engine'
export type { NextAction, NextActionCandidate, NextActionScore } from './next-action-engine'
