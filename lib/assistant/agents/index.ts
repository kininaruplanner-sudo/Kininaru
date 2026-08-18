/**
 * Kininaru Assistant — Agent Orchestration
 *
 * Barrel export for the agent orchestration system.
 * Provides intent routing, specialized capabilities, and multi-step planning.
 */

// Types
export type {
  Intent,
  IntentCategory,
  CapabilityName,
  AgentCapability,
  PlanStep,
  PlanStepAction,
  StructuredPlan,
  ExecutionBudget,
  BudgetCheck,
  AgentStepResult,
  AgentExecutionResult,
  AgentStepStatus,
  RouterConfig,
} from './types'

export { DEFAULT_ROUTER_CONFIG } from './types'

// Intent Router
export { routeIntent, validatePlanStep } from './router'

// Specialized Capabilities
export {
  CAPABILITIES,
  getCapability,
  getAllCapabilities,
  getCapabilityNames,
  resolveCapabilities,
  canPerformAction,
} from './capabilities'

// Orchestrator
export {
  buildPlan,
  createBudget,
  checkBudget,
  validatePlan,
  executePlan,
  formatPlanForUI,
  formatExecutionForUI,
} from './orchestrator'
