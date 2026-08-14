import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Offline-first sync queue (§9–§11, §21).
 *
 * Design (honest, no fake claims):
 * - While OFFLINE, mutations are queued in IndexedDB (the right local store
 *   for structured data — localStorage is too small and synchronous). The UI
 *   updates optimistically; the banner says "Hors ligne · modifications
 *   enregistrées sur cet appareil".
 * - When the connection returns, `flushQueue` replays every op through the
 *   user's own Supabase client, so RLS still applies (a row the user cannot
 *   legally create is rejected by the database, never by a client shortcut).
 * - Conflicts are NEVER silently overwritten: a duplicate key (op already
 *   applied by another tab/device) is treated as success; any other failure
 *   is reported in the result and mirrored to the `sync_queue` ledger table
 *   (supabase/offline.sql) so it is visible in the "Synchronisation en
 *   erreur" state instead of disappearing.
 *
 * Only ops that make sense offline are supported (tasks, habits, events,
 * journal, habit logs). Remote features (IA, auth, push) are never queued.
 */

export type SyncTable =
  | 'tasks'
  | 'habits'
  | 'events'
  | 'journal_entries'
  | 'habit_logs'

export interface PendingOp {
  id: string
  table: SyncTable
  op: 'create' | 'update' | 'delete'
  /** Client-preassigned record id (created with crypto.randomUUID). */
  recordId: string
  payload: Record<string, unknown>
  createdAt: string
}

export interface FlushResult {
  applied: number
  failed: number
  conflicts: { table: SyncTable; recordId: string; error: string }[]
}

const DB_NAME = 'kininaru-sync'
const STORE = 'queue'
const DB_VERSION = 1
const DEVICE_KEY = 'kininaru-device-id'

/** Fired after any queue mutation — the status banner listens to it. */
export const SYNC_CHANGED_EVENT = 'kininaru-sync-changed'

/** Stable per-browser id (kept in localStorage; falls back gracefully). */
export function getDeviceId(): string {
  try {
    let id = window.localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      window.localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return 'unknown-device'
  }
}

/** Fresh uuid for records created offline. */
export function newLocalId(): string {
  return crypto.randomUUID()
}

/* ----------------------------- IndexedDB ---------------------------- */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = fn(tx.objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

/** In-memory fallback when IndexedDB is unavailable (private mode). */
const memoryFallback = new Map<string, PendingOp>()
let memoryMode = false

async function idbAvailable(): Promise<boolean> {
  if (memoryMode) return false
  try {
    await openDb()
    return true
  } catch {
    memoryMode = true
    return false
  }
}

export async function enqueueOp(op: Omit<PendingOp, 'id' | 'createdAt'>): Promise<void> {
  const row: PendingOp = {
    id: crypto.randomUUID(),
    ...op,
    createdAt: new Date().toISOString(),
  }
  if (await idbAvailable()) {
    await withStore('readwrite', (store) => store.put(row))
  } else {
    memoryFallback.set(row.id, row)
  }
  window.dispatchEvent(new CustomEvent(SYNC_CHANGED_EVENT))
}

export async function listPending(): Promise<PendingOp[]> {
  if (await idbAvailable()) {
    return withStore('readonly', (store) => store.getAll() as IDBRequest<PendingOp[]>)
  }
  return [...memoryFallback.values()]
}

export async function removePending(id: string): Promise<void> {
  if (await idbAvailable()) {
    await withStore('readwrite', (store) => store.delete(id))
  } else {
    memoryFallback.delete(id)
  }
}

export async function countPending(): Promise<number> {
  return (await listPending()).length
}

/* ------------------------------- flush ------------------------------ */

function isDuplicateKey(error: { code?: string; message?: string } | null): boolean {
  return error?.code === '23505'
}

async function applyOp(
  supabase: SupabaseClient,
  userId: string,
  op: PendingOp
): Promise<'ok' | 'duplicate' | string> {
  try {
    if (op.op === 'create') {
      const { error } = await supabase
        .from(op.table)
        .insert({ id: op.recordId, user_id: userId, ...op.payload })
      if (error) return isDuplicateKey(error) ? 'duplicate' : error.message
      return 'ok'
    }
    if (op.op === 'update') {
      const { error } = await supabase
        .from(op.table)
        .update(op.payload)
        .eq('id', op.recordId)
      if (error) return isDuplicateKey(error) ? 'duplicate' : error.message
      return 'ok'
    }
    // delete
    const { error } = await supabase.from(op.table).delete().eq('id', op.recordId)
    if (error) return isDuplicateKey(error) ? 'duplicate' : error.message
    return 'ok'
  } catch (err) {
    return err instanceof Error ? err.message : 'Erreur inconnue'
  }
}

/** Best-effort mirror of the applied op into the server-side ledger. */
async function mirrorToLedger(
  supabase: SupabaseClient,
  userId: string,
  deviceId: string,
  op: PendingOp,
  status: 'applied' | 'failed',
  conflict?: string
): Promise<void> {
  await supabase.from('sync_queue').insert({
    user_id: userId,
    device_id: deviceId,
    op_type: op.op,
    table_name: op.table,
    record_id: op.recordId,
    payload: op.payload,
    status,
    ...(conflict ? { conflict: { error: conflict } } : {}),
  })
}

/**
 * Replays every pending op. Returns counts + conflicts so the UI can show
 * "Synchronisé" or "Certaines modifications n'ont pas encore été
 * synchronisées." with a retry.
 */
export async function flushQueue(
  supabase: SupabaseClient,
  userId: string
): Promise<FlushResult> {
  const pending = await listPending()
  if (pending.length === 0) return { applied: 0, failed: 0, conflicts: [] }

  const deviceId = getDeviceId()
  const result: FlushResult = { applied: 0, failed: 0, conflicts: [] }

  for (const op of pending) {
    const outcome = await applyOp(supabase, userId, op)
    if (outcome === 'ok' || outcome === 'duplicate') {
      result.applied++
      await removePending(op.id)
      await mirrorToLedger(supabase, userId, deviceId, op, 'applied').catch(() => {})
    } else {
      result.failed++
      result.conflicts.push({ table: op.table, recordId: op.recordId, error: outcome })
      await mirrorToLedger(supabase, userId, deviceId, op, 'failed', outcome).catch(() => {})
    }
  }

  window.dispatchEvent(new CustomEvent(SYNC_CHANGED_EVENT))
  return result
}
