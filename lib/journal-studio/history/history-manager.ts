// =====================================================================
// Kininaru — Journal Studio History Manager
// =====================================================================
// Manages undo/redo stack with Command pattern.
// Max 60 entries. Each command has pageId for page isolation.

import type { JournalCommand } from './commands';
import { devLog } from '../sync/indexed-db';

const MAX_HISTORY = 60;

interface HistoryState {
  undoStack: JournalCommand[];
  redoStack: JournalCommand[];
}

let state: HistoryState = {
  undoStack: [],
  redoStack: [],
};

type HistoryListener = () => void;
const listeners: Set<HistoryListener> = new Set();

function notify() {
  listeners.forEach((l) => l());
}

export function onHistoryChange(listener: HistoryListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getUndoStack(): readonly JournalCommand[] {
  return state.undoStack;
}

export function getRedoStack(): readonly JournalCommand[] {
  return state.redoStack;
}

export function canUndo(): boolean {
  return state.undoStack.length > 0;
}

export function canRedo(): boolean {
  return state.redoStack.length > 0;
}

// ---------------------------------------------------------------------
// Push a new command and execute it
// ---------------------------------------------------------------------
export async function executeCommand(command: JournalCommand): Promise<void> {
  await command.execute();

  state.undoStack.push(command);
  state.redoStack = []; // Clear redo on new action

  // Trim history
  if (state.undoStack.length > MAX_HISTORY) {
    state.undoStack = state.undoStack.slice(state.undoStack.length - MAX_HISTORY);
  }

  devLog('HISTORY', `Executed ${command.type} (undo: ${state.undoStack.length}, redo: ${state.redoStack.length})`);
  notify();
}

// ---------------------------------------------------------------------
// Undo last command
// ---------------------------------------------------------------------
export async function undo(): Promise<boolean> {
  if (state.undoStack.length === 0) return false;

  const command = state.undoStack.pop()!;
  await command.undo();

  state.redoStack.push(command);

  devLog('HISTORY', `Undid ${command.type} (undo: ${state.undoStack.length}, redo: ${state.redoStack.length})`);
  notify();
  return true;
}

// ---------------------------------------------------------------------
// Redo last undone command
// ---------------------------------------------------------------------
export async function redo(): Promise<boolean> {
  if (state.redoStack.length === 0) return false;

  const command = state.redoStack.pop()!;
  await command.redo();

  state.undoStack.push(command);

  devLog('HISTORY', `Redid ${command.type} (undo: ${state.undoStack.length}, redo: ${state.redoStack.length})`);
  notify();
  return true;
}

// ---------------------------------------------------------------------
// Reset (on page switch)
// ---------------------------------------------------------------------
export function resetHistory(): void {
  state = { undoStack: [], redoStack: [] };
  notify();
}

// ---------------------------------------------------------------------
// Get state snapshot for React
// ---------------------------------------------------------------------
export function getHistorySnapshot(): { canUndo: boolean; canRedo: boolean; undoCount: number; redoCount: number } {
  return {
    canUndo: state.undoStack.length > 0,
    canRedo: state.redoStack.length > 0,
    undoCount: state.undoStack.length,
    redoCount: state.redoStack.length,
  };
}
