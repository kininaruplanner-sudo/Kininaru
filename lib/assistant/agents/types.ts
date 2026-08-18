/**
 * Kininaru Assistant — Agent Orchestration Types
 *
 * Defines the structure for intent routing, agent capabilities,
 * structured plans, and execution budgets.
 */

/* ------------------------------------------------------------------ */
/* Intent                                                              */
/* ------------------------------------------------------------------ */

export type IntentCategory =
  | 'task'           // Task management (create, complete, update)
  | 'calendar'       // Calendar events (create, update, delete)
  | 'focus'          // Focus sessions
  | 'habit'          // Habits
  | 'goal'           // Goals/objectives
  | 'memory'         // Memory management
  | 'planning'       // Multi-step planning
  | 'journal'        // Journal entries
  | 'analytics'      // Statistics/insights
  | 'general';       // General conversation

export interface Intent {
  /** Primary intent category */
  category: IntentCategory
  /** Secondary intents (for multi-capability requests) */
  secondaryIntents: IntentCategory[]
  /** Extracted parameters from the user message */
  extractedParams: Record<string, unknown>
  /** Confidence score 0-1 */
  confidence: number
  /** Whether the intent requires planning */
  requiresPlanning: boolean
}

/* ------------------------------------------------------------------ */
/* Agent Capabilities                                                  */
/* ------------------------------------------------------------------ */

export type CapabilityName =
  | 'task'
  | 'calendar'
  | 'focus'
  | 'habit'
  | 'goal'
  | 'memory'
  | 'planning'
  | 'journal'
  | 'analytics';

export interface AgentCapability {
  name: CapabilityName
  description: string
  /** Priority level for fallback handling */
  priority: 'critical' | 'important' | 'optional'
  /** Tools this capability can use */
  tools: string[]
  /** Actions this capability can perform */
  actions: string[]
}

/* ------------------------------------------------------------------ */
/* Structured Plan                                                     */
/* ------------------------------------------------------------------ */

export type PlanStepAction =
  | 'read'
  | 'create'
  | 'update'
  | 'complete'
  | 'delete'
  | 'generate';

export interface PlanStep {
  /** Which capability to use */
  capability: CapabilityName
  /** What action to perform */
  action: PlanStepAction
  /** Human-readable description */
  description: string
  /** Parameters for the action */
  params: Record<string, unknown>
  /** Whether this step requires confirmation */
  requiresConfirmation: boolean
  /** Tool to call (if applicable) */
  tool?: string
}

export interface StructuredPlan {
  /** Unique plan identifier */
  id: string
  /** User's original intent */
  intent: Intent
  /** Ordered list of steps */
  steps: PlanStep[]
  /** Human-readable summary */
  summary: string
  /** Whether the plan requires confirmation before execution */
  requiresConfirmation: boolean
  /** Estimated total steps */
  estimatedSteps: number
}

/* ------------------------------------------------------------------ */
/* Execution Budget                                                    */
/* ------------------------------------------------------------------ */

export interface ExecutionBudget {
  /** Maximum number of agent steps */
  maxSteps: number
  /** Maximum number of tool calls */
  maxToolCalls: number
  /** Maximum execution time in ms */
  maxDurationMs: number
  /** Current step count */
  currentSteps: number
  /** Current tool call count */
  currentToolCalls: number
  /** Start time */
  startedAt: number
}

export interface BudgetCheck {
  allowed: boolean
  reason?: string
}

/* ------------------------------------------------------------------ */
/* Agent Execution                                                     */
/* ------------------------------------------------------------------ */

export type AgentStepStatus =
  | 'pending'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'awaiting_confirmation';

export interface AgentStepResult {
  step: PlanStep
  status: AgentStepStatus
  result?: unknown
  error?: string
  durationMs: number
}

export interface AgentExecutionResult {
  planId: string
  steps: AgentStepResult[]
  /** Overall success */
  success: boolean
  /** Summary for the user */
  summary: string
  /** Errors that occurred */
  errors: string[]
  /** Total execution time */
  totalDurationMs: number
}

/* ------------------------------------------------------------------ */
/* Router Configuration                                                */
/* ------------------------------------------------------------------ */

export interface RouterConfig {
  /** Maximum plan depth */
  maxPlanDepth: number
  /** Execution budget defaults */
  budget: Omit<ExecutionBudget, 'currentSteps' | 'currentToolCalls' | 'startedAt'>
  /** Whether to show plan preview before execution */
  showPlanPreview: boolean
}

export const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  maxPlanDepth: 3,
  budget: {
    maxSteps: 8,
    maxToolCalls: 15,
    maxDurationMs: 30_000,
  },
  showPlanPreview: true,
};
