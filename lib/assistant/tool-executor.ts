/**
 * Kininaru Assistant — Tool Executor
 *
 * Executes tools on behalf of the AI. Handles:
 * - Parameter validation
 * - Read tools: execute directly
 * - Write tools: return pending action for client confirmation
 *
 * Security:
 * - user_id always comes from the authenticated session
 * - RLS is the second line of defense
 * - All parameters are validated server-side
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getTool, validateParams, type ToolContext } from './tools'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ToolExecutionResult =
  | { status: 'executed'; tool: string; result: unknown; summary: string }
  | { status: 'pending_confirmation'; tool: string; params: Record<string, unknown>; summary: string }
  | { status: 'error'; tool: string; error: string }

/* ------------------------------------------------------------------ */
/* Executor                                                            */
/* ------------------------------------------------------------------ */

/**
 * Executes a tool by name with the given parameters.
 *
 * - Read tools: executed immediately, result returned.
 * - Write tools: returns a pending confirmation object for the client.
 */
export async function executeTool(
  supabase: SupabaseClient,
  userId: string,
  toolName: string,
  params: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const tool = getTool(toolName)

  if (!tool) {
    return {
      status: 'error',
      tool: toolName,
      error: `Outil inconnu : ${toolName}`,
    }
  }

  // Validate parameters
  const { valid, error: validationError } = validateParams(tool, params)
  if (validationError) {
    return {
      status: 'error',
      tool: toolName,
      error: validationError,
    }
  }

  // Read tools: execute directly
  if (tool.category === 'read') {
    try {
      const ctx: ToolContext = { supabase, userId }
      const result = await tool.execute(ctx, valid)
      return {
        status: 'executed',
        tool: toolName,
        result: result.data,
        summary: result.summary,
      }
    } catch (err) {
      console.error(`[Kininaru] Tool ${toolName} failed:`, err)
      return {
        status: 'error',
        tool: toolName,
        error: 'Erreur lors de l\'exécution de l\'outil',
      }
    }
  }

  // Write tools: return pending confirmation
  return {
    status: 'pending_confirmation',
    tool: toolName,
    params: valid,
    summary: `Action en attente de confirmation : ${toolName}`,
  }
}

/**
 * Executes a write tool after user confirmation.
 * This is called by the actions-panel when the user confirms.
 */
export async function executeConfirmedTool(
  supabase: SupabaseClient,
  userId: string,
  toolName: string,
  params: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const tool = getTool(toolName)

  if (!tool) {
    return {
      status: 'error',
      tool: toolName,
      error: `Outil inconnu : ${toolName}`,
    }
  }

  if (tool.category !== 'write') {
    return {
      status: 'error',
      tool: toolName,
      error: 'Cet outil n\'est pas une action',
    }
  }

  try {
    const ctx: ToolContext = { supabase, userId }
    const result = await tool.execute(ctx, params)
    return {
      status: 'executed',
      tool: toolName,
      result: result.data,
      summary: result.summary,
    }
  } catch (err) {
    console.error(`[Kininaru] Confirmed tool ${toolName} failed:`, err)
    return {
      status: 'error',
      tool: toolName,
      error: 'L\'action n\'a pas pu être exécutée',
    }
  }
}
