/**
 * Kininaru Assistant — Specialized Agent Capabilities
 *
 * Each capability represents a domain the assistant can act on.
 * They reuse the existing tool registry (Phase 1) and permission system (Phase 7).
 */

import type { AgentCapability, CapabilityName } from './types'

/* ------------------------------------------------------------------ */
/* Capability Definitions                                              */
/* ------------------------------------------------------------------ */

export const CAPABILITIES: Record<CapabilityName, AgentCapability> = {
  task: {
    name: 'task',
    description: 'Gestion des tâches (lecture, création, modification, complétion)',
    priority: 'important',
    tools: ['get_today_tasks', 'create_task', 'create_tasks_batch', 'complete_task', 'update_task'],
    actions: ['read', 'create', 'update', 'complete'],
  },
  calendar: {
    name: 'calendar',
    description: 'Événements calendrier (lecture, création, modification, suppression)',
    priority: 'important',
    tools: ['get_calendar_events', 'create_calendar_event', 'update_calendar_event', 'delete_calendar_event'],
    actions: ['read', 'create', 'update', 'delete'],
  },
  focus: {
    name: 'focus',
    description: 'Sessions de focus et concentration',
    priority: 'important',
    tools: ['start_focus', 'get_focus_sessions'],
    actions: ['read', 'create'],
  },
  habit: {
    name: 'habit',
    description: 'Suivi des habitudes quotidiennes',
    priority: 'important',
    tools: ['create_habit', 'get_habits'],
    actions: ['read', 'create', 'update'],
  },
  goal: {
    name: 'goal',
    description: 'Objectifs et planification à long terme',
    priority: 'important',
    tools: ['create_goal', 'get_goals'],
    actions: ['read', 'create', 'update'],
  },
  memory: {
    name: 'memory',
    description: 'Mémoire et préférences utilisateur',
    priority: 'optional',
    tools: ['create_memory', 'get_memories', 'delete_memory'],
    actions: ['read', 'create', 'delete'],
  },
  planning: {
    name: 'planning',
    description: 'Planification multi-étapes et organisation',
    priority: 'important',
    tools: ['get_today_tasks', 'get_calendar_events', 'get_focus_sessions', 'get_goals'],
    actions: ['read', 'generate'],
  },
  journal: {
    name: 'journal',
    description: 'Journal personnel et introspection',
    priority: 'optional',
    tools: ['create_journal_entry', 'get_journal_entries'],
    actions: ['read', 'create'],
  },
  analytics: {
    name: 'analytics',
    description: 'Statistiques et analyse de progression',
    priority: 'optional',
    tools: ['get_analytics', 'get_stats'],
    actions: ['read'],
  },
}

/* ------------------------------------------------------------------ */
/* Capability Helpers                                                  */
/* ------------------------------------------------------------------ */

export function getCapability(name: CapabilityName): AgentCapability {
  return CAPABILITIES[name]
}

export function getAllCapabilities(): AgentCapability[] {
  return Object.values(CAPABILITIES)
}

export function getCapabilityNames(): CapabilityName[] {
  return Object.keys(CAPABILITIES) as CapabilityName[]
}

/**
 * Determines which capabilities are needed for a given intent.
 */
export function resolveCapabilities(
  primaryCategory: string,
  secondaryCategories: string[]
): CapabilityName[] {
  const capabilities: CapabilityName[] = []

  // Map intent categories to capabilities
  const categoryToCapability: Record<string, CapabilityName> = {
    task: 'task',
    calendar: 'calendar',
    focus: 'focus',
    habit: 'habit',
    goal: 'goal',
    memory: 'memory',
    planning: 'planning',
    journal: 'journal',
    analytics: 'analytics',
    general: 'task', // fallback
  }

  // Add primary capability
  const primary = categoryToCapability[primaryCategory] ?? 'task'
  capabilities.push(primary)

  // Add secondary capabilities
  for (const cat of secondaryCategories) {
    const cap = categoryToCapability[cat]
    if (cap && !capabilities.includes(cap)) {
      capabilities.push(cap)
    }
  }

  return capabilities
}

/**
 * Checks if a capability supports a given action.
 */
export function canPerformAction(
  capabilityName: CapabilityName,
  action: string
): boolean {
  const cap = CAPABILITIES[capabilityName]
  return cap?.actions.includes(action) ?? false
}
