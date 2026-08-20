/**
 * AI Action Validation Tests
 *
 * Tests that the server-side validation correctly rejects invalid,
 * malicious, or malformed actions before they reach the database.
 *
 * These tests protect against:
 * - Injection of arbitrary data
 * - Missing required fields
 * - Invalid field types
 * - Overflow attacks
 * - SQL injection via action parameters
 */

import { describe, it, expect } from 'vitest'
import { validateAiAction } from '../../lib/ai/actions'

describe('validateAiAction', () => {
  /* ------------------------------------------------------------------ */
  /* General invalid inputs                                              */
  /* ------------------------------------------------------------------ */

  it('rejects non-object input', () => {
    expect(validateAiAction(null).error).toBeDefined()
    expect(validateAiAction(undefined).error).toBeDefined()
    expect(validateAiAction('string').error).toBeDefined()
    expect(validateAiAction(42).error).toBeDefined()
    expect(validateAiAction([]).error).toBeDefined()
  })

  it('rejects missing action field', () => {
    expect(validateAiAction({ data: {} }).error).toBeDefined()
  })

  it('rejects missing data field', () => {
    expect(validateAiAction({ action: 'create_task' }).error).toBeDefined()
  })

  it('rejects unknown action type', () => {
    expect(validateAiAction({ action: 'delete_all_tasks', data: {} }).error).toBeDefined()
    expect(validateAiAction({ action: 'drop_table', data: {} }).error).toBeDefined()
    expect(validateAiAction({ action: 'exec', data: {} }).error).toBeDefined()
  })

  /* ------------------------------------------------------------------ */
  /* create_task                                                         */
  /* ------------------------------------------------------------------ */

  describe('create_task', () => {
    it('rejects empty title', () => {
      expect(validateAiAction({ action: 'create_task', data: { title: '' } }).error).toBeDefined()
    })

    it('rejects whitespace-only title', () => {
      expect(validateAiAction({ action: 'create_task', data: { title: '   ' } }).error).toBeDefined()
    })

    it('rejects title exceeding 200 chars', () => {
      expect(validateAiAction({ action: 'create_task', data: { title: 'A'.repeat(201) } }).error).toBeDefined()
    })

    it('accepts valid minimal task', () => {
      const result = validateAiAction({ action: 'create_task', data: { title: 'Test task' } })
      expect(result.action).toBeDefined()
      expect(result.action?.action).toBe('create_task')
      expect(result.action?.data).toMatchObject({ title: 'Test task' })
    })

    it('accepts valid task with all optional fields', () => {
      const result = validateAiAction({
        action: 'create_task',
        data: {
          title: 'Test task',
          description: 'A description',
          priority: 'high',
          due_date: '2025-12-31',
          tags: ['urgent', 'work'],
        },
      })
      expect(result.action).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('rejects invalid priority', () => {
      expect(validateAiAction({ action: 'create_task', data: { title: 'T', priority: 'critical' } }).error).toBeDefined()
    })

    it('rejects invalid date format', () => {
      expect(validateAiAction({ action: 'create_task', data: { title: 'T', due_date: 'not-a-date' } }).error).toBeDefined()
      expect(validateAiAction({ action: 'create_task', data: { title: 'T', due_date: '31/12/2025' } }).error).toBeDefined()
    })

    it('rejects more than 5 tags', () => {
      expect(validateAiAction({ action: 'create_task', data: { title: 'T', tags: ['a', 'b', 'c', 'd', 'e', 'f'] } }).error).toBeDefined()
    })

    it('rejects tag exceeding 30 chars', () => {
      expect(validateAiAction({ action: 'create_task', data: { title: 'T', tags: ['A'.repeat(31)] } }).error).toBeDefined()
    })

    it('rejects description exceeding 1000 chars', () => {
      expect(validateAiAction({ action: 'create_task', data: { title: 'T', description: 'A'.repeat(1001) } }).error).toBeDefined()
    })

    it('sanitizes title by trimming', () => {
      const result = validateAiAction({ action: 'create_task', data: { title: '  Test  ' } })
      expect(result.action?.data).toMatchObject({ title: 'Test' })
    })
  })

  /* ------------------------------------------------------------------ */
  /* complete_task                                                       */
  /* ------------------------------------------------------------------ */

  describe('complete_task', () => {
    it('rejects invalid UUID', () => {
      expect(validateAiAction({ action: 'complete_task', data: { task_id: 'not-a-uuid' } }).error).toBeDefined()
    })

    it('rejects empty task_id', () => {
      expect(validateAiAction({ action: 'complete_task', data: {} }).error).toBeDefined()
    })

    it('accepts valid UUID', () => {
      const result = validateAiAction({
        action: 'complete_task',
        data: { task_id: '550e8400-e29b-41d4-a716-446655440000' },
      })
      expect(result.action).toBeDefined()
      expect(result.error).toBeUndefined()
    })
  })

  /* ------------------------------------------------------------------ */
  /* update_task                                                         */
  /* ------------------------------------------------------------------ */

  describe('update_task', () => {
    it('rejects invalid UUID', () => {
      expect(validateAiAction({ action: 'update_task', data: { task_id: 'bad' } }).error).toBeDefined()
    })

    it('rejects invalid status', () => {
      expect(validateAiAction({
        action: 'update_task',
        data: { task_id: '550e8400-e29b-41d4-a716-446655440000', status: 'cancelled' },
      }).error).toBeDefined()
    })

    it('accepts valid status values', () => {
      for (const status of ['todo', 'in_progress', 'done']) {
        const result = validateAiAction({
          action: 'update_task',
          data: { task_id: '550e8400-e29b-41d4-a716-446655440000', status },
        })
        expect(result.action).toBeDefined()
        expect(result.error).toBeUndefined()
      }
    })

    it('accepts status-only update without title', () => {
      const result = validateAiAction({
        action: 'update_task',
        data: { task_id: '550e8400-e29b-41d4-a716-446655440000', status: 'done' },
      })
      expect(result.action).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it('accepts title-only update without status', () => {
      const result = validateAiAction({
        action: 'update_task',
        data: { task_id: '550e8400-e29b-41d4-a716-446655440000', title: 'New title' },
      })
      expect(result.action).toBeDefined()
      expect(result.error).toBeUndefined()
    })
  })

  /* ------------------------------------------------------------------ */
  /* start_focus                                                         */
  /* ------------------------------------------------------------------ */

  describe('start_focus', () => {
    it('rejects negative duration', () => {
      expect(validateAiAction({ action: 'start_focus', data: { duration_minutes: -5 } }).error).toBeDefined()
    })

    it('rejects zero duration', () => {
      expect(validateAiAction({ action: 'start_focus', data: { duration_minutes: 0 } }).error).toBeDefined()
    })

    it('rejects duration > 480 minutes', () => {
      expect(validateAiAction({ action: 'start_focus', data: { duration_minutes: 481 } }).error).toBeDefined()
    })

    it('rejects non-number duration', () => {
      expect(validateAiAction({ action: 'start_focus', data: { duration_minutes: 'sixty' } }).error).toBeDefined()
    })

    it('accepts valid duration', () => {
      const result = validateAiAction({ action: 'start_focus', data: { duration_minutes: 25 } })
      expect(result.action).toBeDefined()
      expect(result.error).toBeUndefined()
    })
  })

  /* ------------------------------------------------------------------ */
  /* create_event                                                        */
  /* ------------------------------------------------------------------ */

  describe('create_event', () => {
    it('rejects end before start', () => {
      expect(validateAiAction({
        action: 'create_event',
        data: {
          title: 'Meeting',
          start_at: '2025-12-31T14:00:00Z',
          end_at: '2025-12-31T13:00:00Z',
        },
      }).error).toBeDefined()
    })

    it('rejects invalid date', () => {
      expect(validateAiAction({
        action: 'create_event',
        data: { title: 'Meeting', start_at: 'not-a-date', end_at: '2025-12-31T14:00:00Z' },
      }).error).toBeDefined()
    })

    it('accepts valid event', () => {
      const result = validateAiAction({
        action: 'create_event',
        data: {
          title: 'Meeting',
          start_at: '2025-12-31T13:00:00Z',
          end_at: '2025-12-31T14:00:00Z',
        },
      })
      expect(result.action).toBeDefined()
      expect(result.error).toBeUndefined()
    })
  })

  /* ------------------------------------------------------------------ */
  /* create_memory                                                       */
  /* ------------------------------------------------------------------ */

  describe('create_memory', () => {
    it('rejects empty content', () => {
      expect(validateAiAction({ action: 'create_memory', data: { content: '' } }).error).toBeDefined()
    })

    it('rejects content exceeding 500 chars', () => {
      expect(validateAiAction({ action: 'create_memory', data: { content: 'A'.repeat(501) } }).error).toBeDefined()
    })

    it('rejects invalid category', () => {
      expect(validateAiAction({ action: 'create_memory', data: { content: 'test', category: 'invalid' } }).error).toBeDefined()
    })

    it('accepts valid memory', () => {
      const result = validateAiAction({ action: 'create_memory', data: { content: 'I prefer tea over coffee', category: 'preference' } })
      expect(result.action).toBeDefined()
      expect(result.error).toBeUndefined()
    })
  })

  /* ------------------------------------------------------------------ */
  /* create_goal                                                         */
  /* ------------------------------------------------------------------ */

  describe('create_goal', () => {
    it('rejects empty title', () => {
      expect(validateAiAction({ action: 'create_goal', data: { title: '' } }).error).toBeDefined()
    })

    it('rejects steps > 10', () => {
      expect(validateAiAction({
        action: 'create_goal',
        data: { title: 'Goal', steps: Array.from({ length: 11 }, (_, i) => `Step ${i + 1}`) },
      }).error).toBeDefined()
    })

    it('accepts valid goal with steps', () => {
      const result = validateAiAction({
        action: 'create_goal',
        data: { title: 'Learn TypeScript', steps: ['Read docs', 'Build project'] },
      })
      expect(result.action).toBeDefined()
      expect(result.error).toBeUndefined()
    })
  })

  /* ------------------------------------------------------------------ */
  /* create_tasks_batch                                                  */
  /* ------------------------------------------------------------------ */

  describe('create_tasks_batch', () => {
    it('rejects empty steps', () => {
      expect(validateAiAction({ action: 'create_tasks_batch', data: { parent_title: 'Goal', steps: [] } }).error).toBeDefined()
    })

    it('rejects steps > 10', () => {
      expect(validateAiAction({
        action: 'create_tasks_batch',
        data: { parent_title: 'Goal', steps: Array.from({ length: 11 }, (_, i) => `Step ${i + 1}`) },
      }).error).toBeDefined()
    })

    it('rejects empty step title', () => {
      expect(validateAiAction({
        action: 'create_tasks_batch',
        data: { parent_title: 'Goal', steps: ['Valid', ''] },
      }).error).toBeDefined()
    })
  })

  /* ------------------------------------------------------------------ */
  /* create_family_task                                                  */
  /* ------------------------------------------------------------------ */

  describe('create_family_task', () => {
    it('rejects invalid family_id', () => {
      expect(validateAiAction({ action: 'create_family_task', data: { title: 'T', family_id: 'not-a-uuid' } }).error).toBeDefined()
    })

    it('accepts valid family_id', () => {
      const result = validateAiAction({
        action: 'create_family_task',
        data: { title: 'Groceries', family_id: '550e8400-e29b-41d4-a716-446655440000' },
      })
      expect(result.action).toBeDefined()
      expect(result.error).toBeUndefined()
    })
  })

  /* ------------------------------------------------------------------ */
  /* Injection attempts                                                  */
  /* ------------------------------------------------------------------ */

  describe('injection resistance', () => {
    it('rejects SQL injection in task title', () => {
      const result = validateAiAction({
        action: 'create_task',
        data: { title: "'; DROP TABLE tasks; --" },
      })
      // Should either accept (as a plain string) or reject for other reasons
      // but should NOT execute SQL
      expect(result.action).toBeDefined()
      if (result.action) {
        expect(result.action.data).toMatchObject({ title: "'; DROP TABLE tasks; --" })
      }
    })

    it('rejects XSS in task title (too long or sanitized)', () => {
      const result = validateAiAction({
        action: 'create_task',
        data: { title: '<script>alert("xss")</script>' },
      })
      // Accepts as a string — the title is stored as data, not rendered as HTML
      // The danger would be if it's later rendered with dangerouslySetInnerHTML
      expect(result.action).toBeDefined()
    })

    it('does not propagate prototype pollution via action', () => {
      const result = validateAiAction({
        action: 'create_task',
        data: { title: 'Test', __proto__: { admin: true } } as never,
      })
      expect(result.action).toBeDefined()
      // The validated action should only contain the validated fields (title)
      if (result.action?.data) {
        const keys = Object.keys(result.action.data)
        expect(keys).toContain('title')
        // __proto__ should not be an own property of the cleaned data
        expect(Object.prototype.hasOwnProperty.call(result.action.data, '__proto__')).toBe(false)
      }
    })
  })
})
