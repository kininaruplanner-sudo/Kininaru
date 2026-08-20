/**
 * Kininaru Assistant — Agent Orchestrator
 *
 * Coordinates multi-step requests by:
 * 1. Planning the steps needed
 * 2. Validating the plan
 * 3. Executing steps in order
 * 4. Handling failures gracefully
 *
 * The orchestrator ensures:
 * - Confirmation for write actions (Phase 7)
 * - Budget limits (max steps, tool calls, duration)
 * - Partial failure handling
 * - Idempotence (no duplicate actions)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Intent,
  StructuredPlan,
  PlanStep,
  ExecutionBudget,
  BudgetCheck,
  AgentStepResult,
  AgentExecutionResult,
  RouterConfig,
} from './types'
import { DEFAULT_ROUTER_CONFIG } from './types'
import type { CapabilityName } from './types'
import { resolveCapabilities, getCapability } from './capabilities'
import { validatePlanStep } from './router'
import { executeTool, type ToolExecutionResult } from '../tool-executor'
import { getTool, type ToolDefinition } from '../tools'

/* ------------------------------------------------------------------ */
/* Plan Builder                                                        */
/* ------------------------------------------------------------------ */

/**
 * Builds a structured plan from an intent.
 */
export function buildPlan(
  intent: Intent,
  contextData: Record<string, unknown>,
  _config: RouterConfig = DEFAULT_ROUTER_CONFIG
): StructuredPlan {
  const capabilities = resolveCapabilities(intent.category, intent.secondaryIntents)
  const steps: PlanStep[] = []

  // Build steps based on intent and capabilities
  for (const capName of capabilities) {
    const cap = getCapability(capName)
    if (!cap) continue

    // For planning capability, add a generation step
    if (capName === 'planning') {
      steps.push({
        capability: 'planning',
        action: 'generate',
        description: 'Analyser le contexte et générer un plan',
        params: { intent: intent.category, extractedParams: intent.extractedParams },
        requiresConfirmation: false,
      })
      continue
    }

    // For each capability, add relevant steps based on the intent
    const step = buildStepForCapability(capName, intent, contextData)
    if (step) {
      steps.push(step)
    }
  }

  const requiresConfirmation = steps.some(s => s.requiresConfirmation)

  return {
    id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    intent,
    steps,
    summary: buildPlanSummary(steps),
    requiresConfirmation,
    estimatedSteps: steps.length,
  }
}

/**
 * Builds a single step for a capability based on the intent.
 */
function buildStepForCapability(
  capName: CapabilityName,
  intent: Intent,
  _contextData: Record<string, unknown>
): PlanStep | null {
  const cap = getCapability(capName)
  if (!cap) return null

  // Determine action from intent params
  const action = determineAction(capName, intent)

  // Get tool for this action
  const tool = getToolForAction(capName, action)

  const requiresConfirmation =
    tool?.category === 'write' ||
    tool?.category === 'external' ||
    tool?.category === 'sensitive'

  return {
    capability: capName,
    action,
    description: buildStepDescription(capName, action, intent.extractedParams),
    params: intent.extractedParams,
    requiresConfirmation: requiresConfirmation ?? false,
    tool: tool?.name,
  }
}

/**
 * Determines the action to perform based on capability and intent.
 */
function determineAction(
  capName: CapabilityName,
  intent: Intent
): 'read' | 'create' | 'update' | 'complete' | 'delete' | 'generate' {
  const params = intent.extractedParams

  // If we have specific creation params, it's a create action
  if (params.title || params.content) {
    return 'create'
  }

  // If we have a completion request
  if (params.task_id && (intent.category === 'task')) {
    return 'complete'
  }

  // Default to read for most intents
  return 'read'
}

/**
 * Gets the tool definition for a capability+action combo.
 */
function getToolForAction(capName: CapabilityName, action: string): ToolDefinition | null {
  const cap = getCapability(capName)
  if (!cap) return null

  // Map actions to tool names
  const toolNameMap: Record<string, string> = {
    'task.read': 'get_today_tasks',
    'task.create': 'create_task',
    'task.complete': 'complete_task',
    'task.update': 'update_task',
    'calendar.read': 'get_calendar_events',
    'calendar.create': 'create_calendar_event',
    'calendar.update': 'update_calendar_event',
    'calendar.delete': 'delete_calendar_event',
    'focus.read': 'get_focus_sessions',
    'focus.create': 'start_focus',
    'habit.read': 'get_habits',
    'habit.create': 'create_habit',
    'goal.read': 'get_goals',
    'goal.create': 'create_goal',
    'memory.read': 'get_memories',
    'memory.create': 'create_memory',
    'memory.delete': 'delete_memory',
  }

  const key = `${capName}.${action}`
  const toolName = toolNameMap[key]
  if (!toolName) return null

  return getTool(toolName) ?? null
}

/**
 * Builds a human-readable step description.
 */
function buildStepDescription(
  capName: CapabilityName,
  action: string,
  params: Record<string, unknown>
): string {
  const actionLabels: Record<string, string> = {
    read: 'Consulter',
    create: 'Créer',
    update: 'Modifier',
    complete: 'Terminer',
    delete: 'Supprimer',
    generate: 'Générer',
  }

  const capLabels: Record<string, string> = {
    task: 'les tâches',
    calendar: 'le calendrier',
    focus: 'la session de focus',
    habit: 'les habitudes',
    goal: 'les objectifs',
    memory: 'la mémoire',
    planning: 'le planning',
    journal: 'le journal',
    analytics: 'les statistiques',
  }

  const actionLabel = actionLabels[action] ?? action
  const capLabel = capLabels[capName] ?? capName
  const title = params.title ? ` : ${params.title}` : ''

  return `${actionLabel} ${capLabel}${title}`
}

/**
 * Builds a summary of the plan.
 */
function buildPlanSummary(steps: PlanStep[]): string {
  if (steps.length === 0) return 'Aucune action requise.'
  if (steps.length === 1) return steps[0].description

  const readSteps = steps.filter(s => s.action === 'read')
  const writeSteps = steps.filter(s => s.action !== 'read')

  const parts: string[] = []
  if (readSteps.length > 0) {
    parts.push(`${readSteps.length} consultation${readSteps.length > 1 ? 's' : ''}`)
  }
  if (writeSteps.length > 0) {
    parts.push(`${writeSteps.length} action${writeSteps.length > 1 ? 's' : ''}`)
  }

  return `Plan : ${parts.join(' + ')}`
}

/* ------------------------------------------------------------------ */
/* Budget Management                                                   */
/* ------------------------------------------------------------------ */

export function createBudget(config: RouterConfig = DEFAULT_ROUTER_CONFIG): ExecutionBudget {
  return {
    ...config.budget,
    currentSteps: 0,
    currentToolCalls: 0,
    startedAt: Date.now(),
  }
}

export function checkBudget(budget: ExecutionBudget): BudgetCheck {
  if (budget.currentSteps >= budget.maxSteps) {
    return {
      allowed: false,
      reason: `Limite de ${budget.maxSteps} étapes atteinte`,
    }
  }

  if (budget.currentToolCalls >= budget.maxToolCalls) {
    return {
      allowed: false,
      reason: `Limite de ${budget.maxToolCalls} appels d'outils atteinte`,
    }
  }

  const elapsed = Date.now() - budget.startedAt
  if (elapsed >= budget.maxDurationMs) {
    return {
      allowed: false,
      reason: `Limite de ${budget.maxDurationMs / 1000}s dépassée`,
    }
  }

  return { allowed: true }
}

function incrementBudget(budget: ExecutionBudget, toolCalls: number = 0): void {
  budget.currentSteps++
  budget.currentToolCalls += toolCalls
}

/* ------------------------------------------------------------------ */
/* Plan Validation                                                     */
/* ------------------------------------------------------------------ */

export function validatePlan(
  plan: StructuredPlan,
  availableCapabilities: string[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (plan.steps.length === 0) {
    errors.push('Le plan ne contient aucune étape')
  }

  if (plan.steps.length > 8) {
    errors.push('Le plan dépasse la limite de 8 étapes')
  }

  for (const step of plan.steps) {
    const validation = validatePlanStep(
      step.capability,
      step.action,
      availableCapabilities
    )
    if (!validation.valid) {
      errors.push(validation.error ?? `Étape invalide : ${step.description}`)
    }

    if (step.tool) {
      const tool = getTool(step.tool)
      if (!tool) {
        errors.push(`Outil inconnu : ${step.tool}`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/* ------------------------------------------------------------------ */
/* Plan Execution                                                      */
/* ------------------------------------------------------------------ */

/**
 * Executes a structured plan step by step.
 * Respects confirmation requirements and budget limits.
 *
 * Returns partial results if some steps fail.
 */
export async function executePlan(
  plan: StructuredPlan,
  supabase: SupabaseClient,
  userId: string,
  _config: RouterConfig = DEFAULT_ROUTER_CONFIG
): Promise<AgentExecutionResult> {
  const budget = createBudget(_config)
  const stepResults: AgentStepResult[] = []
  const errors: string[] = []
  const startTime = Date.now()

  for (const step of plan.steps) {
    // Check budget before each step
    const budgetCheck = checkBudget(budget)
    if (!budgetCheck.allowed) {
      errors.push(budgetCheck.reason ?? 'Budget dépassé')
      stepResults.push({
        step,
        status: 'skipped',
        error: budgetCheck.reason,
        durationMs: 0,
      })
      break
    }

    // Execute the step
    const stepStart = Date.now()

    try {
      if (step.action === 'read') {
        // Read actions: execute directly
        const toolStart = Date.now()
        const result = await executeReadStep(step, supabase, userId)
        incrementBudget(budget, 1)

        stepResults.push({
          step,
          status: result.status === 'executed' ? 'completed' : 'failed',
          result: result.status === 'executed' ? result.result : undefined,
          error: result.status === 'error' ? result.error : undefined,
          durationMs: Date.now() - toolStart,
        })

        if (result.status === 'error') {
          errors.push(`${step.description} : ${result.error}`)
        }
      } else if (step.action === 'generate') {
        // Generation steps: mark as completed (planning done by LLM)
        incrementBudget(budget)
        stepResults.push({
          step,
          status: 'completed',
          result: { generated: true },
          durationMs: Date.now() - stepStart,
        })
      } else {
        // Write actions: return pending confirmation
        incrementBudget(budget)
        stepResults.push({
          step,
          status: 'awaiting_confirmation',
          durationMs: Date.now() - stepStart,
        })
      }
    } catch (err) {
      incrementBudget(budget)
      const errorMsg = err instanceof Error ? err.message : 'Erreur inconnue'
      stepResults.push({
        step,
        status: 'failed',
        error: errorMsg,
        durationMs: Date.now() - stepStart,
      })
      errors.push(`${step.description} : ${errorMsg}`)
    }
  }

  const totalDuration = Date.now() - startTime
  const allCompleted = stepResults.every(s => s.status === 'completed')
  const hasErrors = errors.length > 0

  return {
    planId: plan.id,
    steps: stepResults,
    success: allCompleted && !hasErrors,
    summary: buildExecutionSummary(stepResults, errors),
    errors,
    totalDurationMs: totalDuration,
  }
}

/**
 * Executes a read step by calling the tool directly.
 */
async function executeReadStep(
  step: PlanStep,
  supabase: SupabaseClient,
  userId: string
): Promise<ToolExecutionResult> {
  if (!step.tool) {
    return {
      status: 'error',
      tool: step.capability,
      error: 'Aucun outil associé à cette étape',
    }
  }

  return executeTool(supabase, userId, step.tool, step.params)
}

/**
 * Builds a summary of the execution results.
 */
function buildExecutionSummary(
  steps: AgentStepResult[],
  errors: string[]
): string {
  const completed = steps.filter(s => s.status === 'completed').length
  const failed = steps.filter(s => s.status === 'failed').length
  const pending = steps.filter(s => s.status === 'awaiting_confirmation').length

  const parts: string[] = []
  if (completed > 0) parts.push(`${completed} étape${completed > 1 ? 's' : ''} réussie${completed > 1 ? 's' : ''}`)
  if (failed > 0) parts.push(`${failed} étape${failed > 1 ? 's' : ''} échouée${failed > 1 ? 's' : ''}`)
  if (pending > 0) parts.push(`${pending} en attente de confirmation`)

  if (errors.length > 0) {
    parts.push(`Erreurs : ${errors.slice(0, 3).join('; ')}`)
  }

  return parts.join(' — ') || 'Plan exécuté'
}

/* ------------------------------------------------------------------ */
/* Format for UI                                                       */
/* ------------------------------------------------------------------ */

/**
 * Formats a plan for display to the user.
 */
export function formatPlanForUI(plan: StructuredPlan): string {
  const lines: string[] = [
    `📋 Plan : ${plan.summary}`,
    '',
  ]

  plan.steps.forEach((step, idx) => {
    const num = idx + 1
    const confirmation = step.requiresConfirmation ? ' ✋' : ''
    const icon = step.action === 'read' ? '📖' : step.action === 'generate' ? '💡' : '✍️'
    lines.push(`${num}. ${icon} ${step.description}${confirmation}`)
  })

  if (plan.requiresConfirmation) {
    lines.push('')
    lines.push('Certaines actions nécessitent ta confirmation.')
  }

  return lines.join('\n')
}

/**
 * Formats execution results for the user.
 */
export function formatExecutionForUI(result: AgentExecutionResult): string {
  const lines: string[] = [
    `✅ ${result.summary}`,
    '',
  ]

  result.steps.forEach((step) => {
    const icon =
      step.status === 'completed' ? '✓' :
      step.status === 'failed' ? '✗' :
      step.status === 'awaiting_confirmation' ? '⏸' : '○'
    lines.push(`${icon} ${step.step.description}`)
    if (step.error) {
      lines.push(`  → ${step.error}`)
    }
  })

  if (result.errors.length > 0) {
    lines.push('')
    lines.push('⚠️ Erreurs :')
    result.errors.forEach(e => lines.push(`  • ${e}`))
  }

  return lines.join('\n')
}
