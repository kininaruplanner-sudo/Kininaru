// =====================================================================
// Kininaru — Journal Studio History Commands
// =====================================================================

import type { JournalElement } from '../types';
import { devLog } from '../sync/indexed-db';

export interface JournalCommand {
  id: string;
  type: string;
  pageId: string;
  execute: () => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  timestamp: number;
}

// Helper to create element from DB
async function insertElementToDB(payload: Record<string, unknown>): Promise<void> {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const { error } = await supabase.from('journal_elements').insert(payload);
  if (error) throw error;
}

async function deleteElementFromDB(id: string): Promise<void> {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const { error } = await supabase.from('journal_elements').delete().eq('id', id);
  if (error) throw error;
}

async function updateElementInDB(id: string, updates: Record<string, unknown>): Promise<void> {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const { error } = await supabase.from('journal_elements').update(updates).eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Add Element Command
// ---------------------------------------------------------------------
export function createElementCommand(
  element: JournalElement,
  onAdd: (el: JournalElement) => void,
  onRemove: (id: string) => void
): JournalCommand {
  return {
    id: crypto.randomUUID(),
    type: 'CREATE_ELEMENT',
    pageId: element.page_id,
    timestamp: Date.now(),
    execute: async () => {
      await insertElementToDB({
        id: element.id,
        page_id: element.page_id,
        user_id: element.user_id,
        element_type: element.element_type,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        rotation: element.rotation,
        z_index: element.z_index,
        opacity: element.opacity,
        properties: element.properties as unknown as Record<string, unknown>,
      });
      onAdd(element);
      devLog('HISTORY', `Execute CREATE_ELEMENT:${element.id}`);
    },
    undo: async () => {
      await deleteElementFromDB(element.id);
      onRemove(element.id);
      devLog('HISTORY', `Undo CREATE_ELEMENT:${element.id}`);
    },
    redo: async () => {
      await insertElementToDB({
        id: element.id,
        page_id: element.page_id,
        user_id: element.user_id,
        element_type: element.element_type,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        rotation: element.rotation,
        z_index: element.z_index,
        opacity: element.opacity,
        properties: element.properties as unknown as Record<string, unknown>,
      });
      onAdd(element);
      devLog('HISTORY', `Redo CREATE_ELEMENT:${element.id}`);
    },
  };
}

// ---------------------------------------------------------------------
// Delete Element Command
// ---------------------------------------------------------------------
export function deleteElementCommand(
  element: JournalElement,
  onAdd: (el: JournalElement) => void,
  onRemove: (id: string) => void
): JournalCommand {
  return {
    id: crypto.randomUUID(),
    type: 'DELETE_ELEMENT',
    pageId: element.page_id,
    timestamp: Date.now(),
    execute: async () => {
      await deleteElementFromDB(element.id);
      onRemove(element.id);
      devLog('HISTORY', `Execute DELETE_ELEMENT:${element.id}`);
    },
    undo: async () => {
      await insertElementToDB({
        id: element.id,
        page_id: element.page_id,
        user_id: element.user_id,
        element_type: element.element_type,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        rotation: element.rotation,
        z_index: element.z_index,
        opacity: element.opacity,
        properties: element.properties as unknown as Record<string, unknown>,
      });
      onAdd(element);
      devLog('HISTORY', `Undo DELETE_ELEMENT:${element.id}`);
    },
    redo: async () => {
      await deleteElementFromDB(element.id);
      onRemove(element.id);
      devLog('HISTORY', `Redo DELETE_ELEMENT:${element.id}`);
    },
  };
}

// ---------------------------------------------------------------------
// Update Element Command (properties or position)
// ---------------------------------------------------------------------
export function updateElementCommand(
  pageId: string,
  elementId: string,
  previousProperties: Record<string, unknown>,
  newProperties: Record<string, unknown>,
  previousPosition: { x: number; y: number; width: number; height: number; rotation: number; z_index: number; opacity: number },
  newPosition: { x: number; y: number; width: number; height: number; rotation: number; z_index: number; opacity: number },
  onApply: (id: string, updates: Partial<JournalElement>) => void
): JournalCommand {
  return {
    id: crypto.randomUUID(),
    type: 'UPDATE_ELEMENT',
    pageId,
    timestamp: Date.now(),
    execute: async () => {
      await updateElementInDB(elementId, {
        x: newPosition.x,
        y: newPosition.y,
        width: newPosition.width,
        height: newPosition.height,
        rotation: newPosition.rotation,
        z_index: newPosition.z_index,
        opacity: newPosition.opacity,
        properties: newProperties,
      });
      onApply(elementId, { ...newPosition, properties: newProperties as unknown as JournalElement['properties'] });
      devLog('HISTORY', `Execute UPDATE_ELEMENT:${elementId}`);
    },
    undo: async () => {
      await updateElementInDB(elementId, {
        x: previousPosition.x,
        y: previousPosition.y,
        width: previousPosition.width,
        height: previousPosition.height,
        rotation: previousPosition.rotation,
        z_index: previousPosition.z_index,
        opacity: previousPosition.opacity,
        properties: previousProperties,
      });
      onApply(elementId, { ...previousPosition, properties: previousProperties as unknown as JournalElement['properties'] });
      devLog('HISTORY', `Undo UPDATE_ELEMENT:${elementId}`);
    },
    redo: async () => {
      await updateElementInDB(elementId, {
        x: newPosition.x,
        y: newPosition.y,
        width: newPosition.width,
        height: newPosition.height,
        rotation: newPosition.rotation,
        z_index: newPosition.z_index,
        opacity: newPosition.opacity,
        properties: newProperties,
      });
      onApply(elementId, { ...newPosition, properties: newProperties as unknown as JournalElement['properties'] });
      devLog('HISTORY', `Redo UPDATE_ELEMENT:${elementId}`);
    },
  };
}

// ===================================================================
// COMPOUND COMMAND — groups multiple commands as one undo step
// ===================================================================
export function compoundCommand(
  commands: JournalCommand[],
  label?: string
): JournalCommand {
  return {
    id: crypto.randomUUID(),
    type: 'UPDATE_ELEMENT' as JournalCommand['type'],
    pageId: commands[0]?.pageId ?? '',
    timestamp: Date.now(),
    execute: async () => {
      for (const cmd of commands) await cmd.execute();
      devLog('HISTORY', `Execute COMPOUND (${commands.length} ops)`);
    },
    undo: async () => {
      for (const cmd of [...commands].reverse()) await cmd.undo();
      devLog('HISTORY', `Undo COMPOUND (${commands.length} ops)`);
    },
    redo: async () => {
      for (const cmd of commands) await cmd.redo();
      devLog('HISTORY', `Redo COMPOUND (${commands.length} ops)`);
    },
  };
}
