/**
 * Kininaru Assistant — Barrel export
 *
 * Import this module to register all tools and access the assistant API.
 */

// Register all tools (side-effect imports)
import './read-tools'
import './write-tools'
import './calendar-tools'

// Re-export public API
export { getAllTools, getTool, getToolNames, isReadTool, isWriteTool } from './tools'
export type { ToolDefinition, ToolCategory, ToolParam } from './tools'
export { executeTool, executeConfirmedTool } from './tool-executor'
export type { ToolExecutionResult } from './tool-executor'
export { buildEnrichedContext } from './context-builder'
export type { EnrichedContext, ContextData } from './context-builder'
export { PERSONALITY, ACTION_PROTOCOL, INSIGHT_MODE } from './personality'
export {
  loadConversationHistory,
  loadConversationSummaries,
  loadUserMemory,
  loadAllUserMemories,
  deleteMemory,
  deleteAllMemories,
  createMemory,
  buildMemoryContext,
  generateConversationSummary,
} from './memory-manager'
export type { MemoryLayer, ConversationMessage, ConversationSummary, UserMemoryItem } from './memory-manager'
export { selectRelevantMemories, formatMemoriesForContext } from './memory-selector'
export { summarizeConversation } from './conversation-summarizer'
export type { ConversationSummaryData } from './conversation-summarizer'
export {
  getProactiveSuggestion,
  recordSuggestionShown,
  formatOpportunityForContext,
  isProactivityEnabled,
  detectOpportunities,
  shouldShow,
  recordOpportunityShown,
  selectBestOpportunity,
} from './proactivity'
export type { Opportunity, OpportunityType, Decision } from './proactivity'
export { createWebSpeechInput } from './speech/input'
export type { SpeechInput, SpeechInputState, SpeechInputResult, SpeechInputCallbacks } from './speech/input'
export { createWebSpeechOutput } from './speech/output'
export type { SpeechOutput, SpeechOutputState, SpeechOutputPrefs, SpeechOutputCallbacks } from './speech/output'
export { createWakeWordDetector } from './wake-word/detector'
export type { WakeWordDetector, WakeWordState, WakeWordCallbacks } from './wake-word/detector'
export { createVisionInput } from './vision/input'
export type { VisionInput, VisionInputState, VisionImage, VisionInputCallbacks } from './vision/input'
export {
  logAction,
  getRecentActions,
  getTodayActions,
  clearActionLog,
  getActionStats,
} from './action-log'
export type { ActionLogEntry, ActionStatus } from './action-log'
export { buildTemporalContext, calculateAvailableSlots, calculateDailyLoad } from './planning/temporal-context'
export type { TemporalContext, TimeSlot, TimePeriod } from './planning/temporal-context'
export { selectNextAction } from './planning/next-action-engine'
export type { NextAction, NextActionCandidate, NextActionScore } from './planning/next-action-engine'

// Adaptation (Phase 9: Adaptive Intelligence)
export {
  recordSignal,
  getSignalsByType,
  getRecentSignals,
  clearSignals,
} from './adaptation/signals'
export type { SignalType, Signal } from './adaptation/signals'
export {
  isAdaptationEnabled,
  setAdaptationEnabled,
  getPreference,
  getAllPreferences,
  updatePreference,
  deletePreference,
  resetAllPreferences,
  getRelevantPreferences,
} from './adaptation/preferences'
export type { LearnedPreference, PreferenceSource, AdaptationPrefs } from './adaptation/preferences'
export {
  calculateIncrease,
  calculateDecrease,
  isConfident,
  confidenceLabel,
  confidencePercent,
  MIN_CONFIDENCE,
  MAX_CONFIDENCE,
} from './adaptation/confidence'
export {
  processFeedback,
  getFeedbackStats,
} from './adaptation/feedback'
export type { FeedbackType, FeedbackContext } from './adaptation/feedback'
export {
  scorePreferenceFit,
  scoreHistoricalSuccess,
  extendScore,
  getAdaptiveExplanationFactors,
} from './adaptation/adaptive-score'

// Memory Module (Phase 10: Long-Term Memory & Context Continuity)
export {
  scoreMemoryRelevance,
  retrieveRelevantMemories,
  containsInjection,
  containsSensitiveData,
  formatRetrievedMemories,
} from './memory/retrieval'
export {
  extractMemoryCandidates,
  validateCandidate,
  formatCandidateForUI,
  isMessageWorthExtracting,
} from './memory/extraction'
export {
  checkDuplicate,
  checkContradiction,
  mergeMemories,
  supersedeMemory,
  processBatch,
} from './memory/dedup'
export type {
  Memory,
  MemoryCategory,
  MemoryImportance,
  MemorySource,
  MemoryQuery,
  MemoryRelevanceScore,
  MemoryExtractionCandidate,
  DuplicateResult,
  ContradictionResult,
  MergeResult,
  BatchResult,
} from './memory'

// Notification Center (Phase 12: Proactive Assistant + Notifications)
export {
  getBestNotification,
  createNotification,
  getNotificationStatus,
  updateNotificationConfig,
  setNotificationEnabled,
  setQuietHours,
  setDailyLimit,
  setChannelEnabled,
  resetNotificationConfig,
  shouldNotify,
  opportunityToNotification,
  evaluateOpportunities,
  suggestDeferredTime,
  createFingerprint,
  isDuplicate,
  isDailyLimitReached,
  isInCooldown,
  getTimeSinceLastNotification,
  getTodayCount,
  recordNotificationShown,
  markAsRead,
  recordFeedback,
  getNotificationStats,
  clearHistory,
  isInQuietHours,
  PRIORITY_CONFIGS,
  CHANNEL_DEFAULTS,
  DEFAULT_NOTIFICATION_CONFIG,
  TYPE_PRIORITY_MAP,
  MIN_PRIORITY_SCORE,
  getMinPriorityScore,
} from './notifications'
export type {
  KininaruNotification,
  NotificationType,
  NotificationPriority,
  NotificationChannel,
  NotificationConfig,
  PriorityConfig,
  ChannelConfig,
  InterventionDecision,
  NotificationStats,
} from './notifications'
