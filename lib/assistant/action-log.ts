/**
 * Kininaru Assistant — Action Log
 *
 * Logs all tool executions for transparency, debugging, and security.
 * Uses localStorage for device-local persistence.
 *
 * Design:
 * - Each action is logged with timestamp, tool name, params, result, and user confirmation
 * - Logs are bounded (max 100 entries, oldest purged)
 * - No secrets or tokens are logged
 * - Logs are device-local (not synced to server)
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ActionStatus = 'pending' | 'confirmed' | 'executed' | 'denied' | 'error'

export interface ActionLogEntry {
  id: string
  timestamp: number
  tool: string
  category: string
  /** Brief description of what was done */
  summary: string
  /** Parameters (sanitized — no secrets) */
  params?: Record<string, unknown>
  /** Result status */
  status: ActionStatus
  /** Error message if failed */
  error?: string
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'kininaru-action-log'
const MAX_ENTRIES = 100

function readLog(): ActionLogEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function writeLog(entries: ActionLogEntry[]) {
  try {
    // Keep only the most recent entries
    const trimmed = entries.slice(-MAX_ENTRIES)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // storage unavailable
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Logs a tool execution.
 *
 * @param tool - Tool name
 * @param category - Tool category (read/write/external/sensitive)
 * @param summary - Human-readable summary
 * @param params - Tool parameters (sanitized)
 * @param status - Execution status
 * @param error - Error message if failed
 */
export function logAction(
  tool: string,
  category: string,
  summary: string,
  params?: Record<string, unknown>,
  status: ActionStatus = 'executed',
  error?: string
): void {
  const entry: ActionLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    tool,
    category,
    summary,
    params: params ? sanitizeParams(params) : undefined,
    status,
    error,
  }

  const log = readLog()
  log.push(entry)
  writeLog(log)
}

/**
 * Gets recent action log entries.
 *
 * @param limit - Maximum entries to return (default 20)
 * @returns Recent entries, newest first
 */
export function getRecentActions(limit = 20): ActionLogEntry[] {
  return readLog()
    .slice(-limit)
    .reverse()
}

/**
 * Gets action log entries for today.
 */
export function getTodayActions(): ActionLogEntry[] {
  const today = new Date().toISOString().split('T')[0]
  return readLog()
    .filter(entry => {
      const entryDate = new Date(entry.timestamp).toISOString().split('T')[0]
      return entryDate === today
    })
    .reverse()
}

/**
 * Clears all action log entries.
 */
export function clearActionLog(): void {
  writeLog([])
}

/**
 * Gets action log statistics.
 */
export function getActionStats(): {
  todayCount: number
  totalCount: number
  byCategory: Record<string, number>
} {
  const log = readLog()
  const today = new Date().toISOString().split('T')[0]

  const todayEntries = log.filter(entry => {
    const entryDate = new Date(entry.timestamp).toISOString().split('T')[0]
    return entryDate === today
  })

  const byCategory: Record<string, number> = {}
  for (const entry of log) {
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1
  }

  return {
    todayCount: todayEntries.length,
    totalCount: log.length,
    byCategory,
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Sanitizes parameters before logging.
 * Removes potentially sensitive data.
 */
function sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(params)) {
    // Skip potentially sensitive fields
    if (/token|secret|password|key|credential/i.test(key)) {
      sanitized[key] = '[REDACTED]'
      continue
    }

    // Truncate long strings
    if (typeof value === 'string' && value.length > 200) {
      sanitized[key] = value.slice(0, 200) + '...'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = '[Object]'
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}
