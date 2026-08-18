/**
 * Kininaru Assistant — Barrel export
 *
 * Import this module to register all tools and access the assistant API.
 */

// Register all tools (side-effect imports)
import './read-tools'
import './write-tools'

// Re-export public API
export { getAllTools, getTool, getToolNames, isReadTool, isWriteTool } from './tools'
export type { ToolDefinition, ToolCategory, ToolParam } from './tools'
export { executeTool, executeConfirmedTool } from './tool-executor'
export type { ToolExecutionResult } from './tool-executor'
export { buildEnrichedContext } from './context-builder'
export type { EnrichedContext, ContextData, NextAction } from './context-builder'
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
