/**
 * Kininaru Assistant — Tool Definitions
 *
 * Each tool is a structured capability the AI can invoke. Tools are split
 * into two categories:
 * - READ: safe, read-only queries executed directly (no confirmation needed)
 * - WRITE: data-mutating actions that require user confirmation before execution
 *
 * Security model:
 * - Every tool receives the authenticated Supabase client + userId
 * - RLS ensures the user can only access their own data
 * - Validation happens server-side; the model never touches raw SQL
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ToolCategory = 'read' | 'write' | 'external' | 'sensitive'

export interface ToolParam {
  name: string
  type: 'string' | 'number' | 'boolean' | 'string[]'
  required: boolean
  description: string
  /** Allowed values for enum-like params */
  enum?: string[]
}

export interface ToolDefinition {
  name: string
  description: string
  category: ToolCategory
  /** Whether this tool requires user confirmation before execution */
  requiresConfirmation: boolean
  params: ToolParam[]
  /** Human-readable label for the confirmation UI */
  confirmationLabel?: string
  /** Whether this tool can be undone */
  canUndo?: boolean
}

export interface ToolContext {
  supabase: SupabaseClient
  userId: string
}

export interface ToolResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
  /** Human-readable summary for the AI to incorporate in its response */
  summary: string
}

/* ------------------------------------------------------------------ */
/* Tool Registry                                                      */
/* ------------------------------------------------------------------ */

const toolRegistry = new Map<string, ToolDefinition & { execute: (ctx: ToolContext, params: Record<string, unknown>) => Promise<ToolResult> }>()

export function registerTool(
  definition: ToolDefinition,
  execute: (ctx: ToolContext, params: Record<string, unknown>) => Promise<ToolResult>
) {
  toolRegistry.set(definition.name, { ...definition, execute })
}

export function getTool(name: string) {
  return toolRegistry.get(name)
}

export function getAllTools(): ToolDefinition[] {
  return Array.from(toolRegistry.values()).map(({ execute: _, ...def }) => def)
}

export function getToolNames(): string[] {
  return Array.from(toolRegistry.keys())
}

export function isReadTool(name: string): boolean {
  const tool = toolRegistry.get(name)
  return tool?.category === 'read'
}

export function isWriteTool(name: string): boolean {
  const tool = toolRegistry.get(name)
  return tool?.category === 'write'
}

/* ------------------------------------------------------------------ */
/* Validation helpers                                                 */
/* ------------------------------------------------------------------ */

export function validateParams(
  definition: ToolDefinition,
  raw: Record<string, unknown>
): { valid: Record<string, unknown>; error?: string } {
  const result: Record<string, unknown> = {}

  for (const param of definition.params) {
    const value = raw[param.name]

    if (value === undefined || value === null) {
      if (param.required) {
        return { valid: result, error: `Paramètre manquant : ${param.name}` }
      }
      continue
    }

    // Type validation
    switch (param.type) {
      case 'string':
        if (typeof value !== 'string' || value.trim().length === 0) {
          return { valid: result, error: `Paramètre ${param.name} doit être une chaîne non vide` }
        }
        if (param.enum && !param.enum.includes(value)) {
          return { valid: result, error: `Paramètre ${param.name} doit être parmi : ${param.enum.join(', ')}` }
        }
        result[param.name] = value.trim()
        break
      case 'number':
        if (typeof value !== 'number' || Number.isNaN(value)) {
          return { valid: result, error: `Paramètre ${param.name} doit être un nombre` }
        }
        result[param.name] = value
        break
      case 'boolean':
        if (typeof value !== 'boolean') {
          return { valid: result, error: `Paramètre ${param.name} doit être un booléen` }
        }
        result[param.name] = value
        break
      case 'string[]':
        if (!Array.isArray(value) || !value.every(v => typeof v === 'string')) {
          return { valid: result, error: `Paramètre ${param.name} doit être un tableau de chaînes` }
        }
        result[param.name] = value.map(v => v.trim()).filter(v => v.length > 0)
        break
    }
  }

  return { valid: result }
}
