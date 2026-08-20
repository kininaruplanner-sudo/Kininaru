/**
 * Tool Validation Tests
 *
 * Tests the parameter validation system used by the Tool Registry.
 * Ensures that tools reject invalid parameters before execution.
 */

import { describe, it, expect } from 'vitest'
import { validateParams } from '../../lib/assistant/tools'
import type { ToolDefinition } from '../../lib/assistant/tools'

const mockToolDef: ToolDefinition = {
  name: 'test_tool',
  description: 'A test tool',
  category: 'write',
  requiresConfirmation: true,
  params: [
    { name: 'title', type: 'string', required: true, description: 'Title' },
    { name: 'count', type: 'number', required: false, description: 'Count' },
    { name: 'enabled', type: 'boolean', required: false, description: 'Enabled' },
    { name: 'tags', type: 'string[]', required: false, description: 'Tags' },
    { name: 'color', type: 'string', required: false, description: 'Color', enum: ['red', 'blue', 'green'] },
  ],
}

describe('validateParams', () => {
  it('validates required string param', () => {
    const result = validateParams(mockToolDef, {})
    expect(result.error).toContain('title')
  })

  it('rejects empty string', () => {
    const result = validateParams(mockToolDef, { title: '' })
    expect(result.error).toBeDefined()
  })

  it('rejects whitespace-only string', () => {
    const result = validateParams(mockToolDef, { title: '   ' })
    expect(result.error).toBeDefined()
  })

  it('accepts valid string', () => {
    const result = validateParams(mockToolDef, { title: 'Test' })
    expect(result.error).toBeUndefined()
    expect(result.valid.title).toBe('Test')
  })

  it('trims string values', () => {
    const result = validateParams(mockToolDef, { title: '  Test  ' })
    expect(result.valid.title).toBe('Test')
  })

  it('validates number type', () => {
    const result = validateParams(mockToolDef, { title: 'T', count: 'not-a-number' })
    expect(result.error).toBeDefined()
  })

  it('accepts valid number', () => {
    const result = validateParams(mockToolDef, { title: 'T', count: 42 })
    expect(result.valid.count).toBe(42)
  })

  it('validates boolean type', () => {
    const result = validateParams(mockToolDef, { title: 'T', enabled: 'yes' })
    expect(result.error).toBeDefined()
  })

  it('accepts valid boolean', () => {
    const result = validateParams(mockToolDef, { title: 'T', enabled: true })
    expect(result.valid.enabled).toBe(true)
  })

  it('validates string[] type', () => {
    const result = validateParams(mockToolDef, { title: 'T', tags: 'not-an-array' })
    expect(result.error).toBeDefined()
  })

  it('accepts valid string[]', () => {
    const result = validateParams(mockToolDef, { title: 'T', tags: ['a', 'b'] })
    expect(result.valid.tags).toEqual(['a', 'b'])
  })

  it('filters empty strings from string[]', () => {
    const result = validateParams(mockToolDef, { title: 'T', tags: ['a', '', 'b'] })
    expect(result.valid.tags).toEqual(['a', 'b'])
  })

  it('validates enum values', () => {
    const result = validateParams(mockToolDef, { title: 'T', color: 'purple' })
    expect(result.error).toBeDefined()
  })

  it('accepts valid enum value', () => {
    const result = validateParams(mockToolDef, { title: 'T', color: 'red' })
    expect(result.valid.color).toBe('red')
  })

  it('ignores unknown parameters', () => {
    const result = validateParams(mockToolDef, { title: 'T', unknown: 'value' })
    expect(result.error).toBeUndefined()
    expect(result.valid.unknown).toBeUndefined()
  })

  it('skips optional params when not provided', () => {
    const result = validateParams(mockToolDef, { title: 'T' })
    expect(result.error).toBeUndefined()
    expect(result.valid.count).toBeUndefined()
  })
})
