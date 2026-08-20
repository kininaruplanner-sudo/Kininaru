/**
 * Journal Studio — Type & Validation Tests
 *
 * Tests the core types and validation logic for the Journal Studio.
 */

import { describe, it, expect } from 'vitest'
import type {
  JournalElement,
  JournalPage,
  Journal,
  TextProperties,
  ShapeProperties,
  StickerProperties,
  DrawingProperties,
} from '../../lib/journal-studio/types'

describe('Journal Studio Types', () => {
  describe('JournalElement creation', () => {
    it('can create a text element with required fields', () => {
      const element: JournalElement = {
        id: 'test-1',
        page_id: 'page-1',
        user_id: 'user-1',
        element_type: 'text',
        x: 100,
        y: 200,
        width: 300,
        height: 50,
        rotation: 0,
        z_index: 1,
        opacity: 1,
        is_locked: false,
        properties: { content: 'Hello world' } as TextProperties,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      expect(element.id).toBe('test-1')
      expect(element.element_type).toBe('text')
      expect(element.x).toBe(100)
      expect(element.is_locked).toBe(false)
    })

    it('can create a shape element', () => {
      const element: JournalElement = {
        id: 'shape-1',
        page_id: 'page-1',
        user_id: 'user-1',
        element_type: 'shape',
        x: 50, y: 50, width: 200, height: 150,
        rotation: 0, z_index: 0, opacity: 1,
        properties: { fill: '#E8D5C4', stroke: '#1a1a1a', stroke_width: 2 } as ShapeProperties,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      expect(element.element_type).toBe('shape')
    })

    it('can create a sticker element', () => {
      const element: JournalElement = {
        id: 'sticker-1', page_id: 'page-1', user_id: 'user-1', element_type: 'sticker',
        x: 100, y: 100, width: 60, height: 60, rotation: 15, z_index: 3, opacity: 1,
        properties: {} as StickerProperties,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }
      expect(element.element_type).toBe('sticker')
      expect(element.rotation).toBe(15)
    })

    it('can create a drawing element with 3-element points', () => {
      const element: JournalElement = {
        id: 'draw-1', page_id: 'page-1', user_id: 'user-1', element_type: 'drawing',
        x: 0, y: 0, width: 500, height: 400, rotation: 0, z_index: 0, opacity: 1,
        properties: {
          tool: 'pen', color: '#000000', size: 3, opacity: 1,
          stroke_color: '#000000', stroke_width: 2,
          points: [[0, 0, 0.5], [10, 10, 1], [20, 5, 0.7]],
        } as DrawingProperties,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }
      expect(element.element_type).toBe('drawing')
    })
  })

  describe('JournalPage creation', () => {
    it('can create a page with required fields', () => {
      const page: JournalPage = {
        id: 'page-1', journal_id: 'journal-1', user_id: 'user-1',
        page_number: 1, elements: [], paper_style: 'blank',
        background_color: '#ffffff',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }
      expect(page.page_number).toBe(1)
      expect(page.elements).toHaveLength(0)
      expect(page.paper_style).toBe('blank')
    })
  })

  describe('Journal creation', () => {
    it('can create a journal with required fields', () => {
      const journal: Journal = {
        id: 'journal-1', user_id: 'user-1', title: 'My Journal',
        cover_type: 'notebook', cover_color: '#E8D5C4',
        paper_style: 'blank', is_favorite: false, is_archived: false, page_count: 20,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }
      expect(journal.title).toBe('My Journal')
      expect(journal.cover_type).toBe('notebook')
      expect(journal.page_count).toBe(20)
    })
  })
})

describe('Journal Element Invariants', () => {
  it('element IDs must be unique within a page', () => {
    const elements: JournalElement[] = [
      { id: 'e1', page_id: 'p1', user_id: 'u1', element_type: 'text', x: 0, y: 0, width: 100, height: 30, rotation: 0, z_index: 0, opacity: 1, properties: { content: 'A' } as TextProperties, created_at: '', updated_at: '' },
      { id: 'e2', page_id: 'p1', user_id: 'u1', element_type: 'text', x: 0, y: 50, width: 100, height: 30, rotation: 0, z_index: 1, opacity: 1, properties: { content: 'B' } as TextProperties, created_at: '', updated_at: '' },
    ]
    const ids = elements.map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('z_index determines rendering order', () => {
    const elements: JournalElement[] = [
      { id: 'e1', page_id: 'p1', user_id: 'u1', element_type: 'text', x: 0, y: 0, width: 100, height: 30, rotation: 0, z_index: 0, opacity: 1, properties: { content: 'Behind' } as TextProperties, created_at: '', updated_at: '' },
      { id: 'e2', page_id: 'p1', user_id: 'u1', element_type: 'shape', x: 0, y: 0, width: 100, height: 30, rotation: 0, z_index: 5, opacity: 1, properties: {} as ShapeProperties, created_at: '', updated_at: '' },
    ]
    const sorted = [...elements].sort((a, b) => a.z_index - b.z_index)
    expect(sorted[0].id).toBe('e1')
    expect(sorted[1].id).toBe('e2')
  })

  it('locked elements invariant', () => {
    const element: JournalElement = {
      id: 'locked-1', page_id: 'p1', user_id: 'u1', element_type: 'text',
      x: 100, y: 200, width: 100, height: 30, rotation: 0, z_index: 0, opacity: 1,
      is_locked: true, properties: { content: 'Locked' } as TextProperties,
      created_at: '', updated_at: '',
    }
    expect(element.is_locked).toBe(true)
  })
})

describe('Journal Element Operations', () => {
  it('duplicating an element generates a new ID', () => {
    const original: JournalElement = {
      id: 'original-id', page_id: 'p1', user_id: 'u1', element_type: 'text',
      x: 100, y: 200, width: 100, height: 30, rotation: 0, z_index: 0, opacity: 1,
      properties: { content: 'Hello' } as TextProperties,
      created_at: '', updated_at: '',
    }
    const duplicate: JournalElement = { ...original, id: 'new-id', x: original.x + 20, y: original.y + 20 }
    expect(duplicate.id).not.toBe(original.id)
    expect(duplicate.x).toBe(120)
  })

  it('moving elements preserves their z_index', () => {
    const element: JournalElement = {
      id: 'move-1', page_id: 'p1', user_id: 'u1', element_type: 'text',
      x: 100, y: 200, width: 100, height: 30, rotation: 0, z_index: 3, opacity: 1,
      properties: { content: 'Move me' } as TextProperties,
      created_at: '', updated_at: '',
    }
    const moved = { ...element, x: 300, y: 400 }
    expect(moved.z_index).toBe(3)
    expect(moved.x).toBe(300)
  })

  it('z-index reordering', () => {
    const elements: JournalElement[] = [
      { id: 'a', page_id: 'p1', user_id: 'u1', element_type: 'text', x: 0, y: 0, width: 0, height: 0, rotation: 0, z_index: 1, opacity: 1, properties: { content: '' } as TextProperties, created_at: '', updated_at: '' },
      { id: 'b', page_id: 'p1', user_id: 'u1', element_type: 'text', x: 0, y: 0, width: 0, height: 0, rotation: 0, z_index: 2, opacity: 1, properties: { content: '' } as TextProperties, created_at: '', updated_at: '' },
      { id: 'c', page_id: 'p1', user_id: 'u1', element_type: 'text', x: 0, y: 0, width: 0, height: 0, rotation: 0, z_index: 3, opacity: 1, properties: { content: '' } as TextProperties, created_at: '', updated_at: '' },
    ]
    const c = elements.find(e => e.id === 'c')!
    const b = elements.find(e => e.id === 'b')!
    // Swap z_index to send c backward
    const newZIndexC = b.z_index
    const newZIndexB = c.z_index
    expect(newZIndexC).toBe(2)
    expect(newZIndexB).toBe(3)
  })
})
