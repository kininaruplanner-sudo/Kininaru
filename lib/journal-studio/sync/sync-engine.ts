// =====================================================================
// Kininaru — Journal Studio Sync Engine
// =====================================================================
// Manages the sync queue: processes pending items, retries on failure,
// handles offline/online transitions.

import {
  getPendingItems,
  markSynced,
  incrementRetry,
  removeSyncedItems,
  type SyncQueueItem,
  devLog,
} from './indexed-db';

const MAX_RETRIES = 5;
const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000];

export type SyncStatus = 'idle' | 'pending' | 'syncing' | 'synced' | 'offline' | 'error';

type StatusListener = (status: SyncStatus) => void;

let syncInProgress = false;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let statusListeners: Set<StatusListener> = new Set();
let currentStatus: SyncStatus = 'idle';

// ---------------------------------------------------------------------
// Import Supabase operations (dynamic to avoid circular deps)
// ---------------------------------------------------------------------

async function getSupabaseClient() {
  const { createClient } = await import('@/lib/supabase/client');
  return createClient();
}

async function processItem(item: SyncQueueItem): Promise<boolean> {
  const supabase = await getSupabaseClient();

  try {
    switch (item.resource) {
      case 'page': {
        if (item.operation === 'UPDATE') {
          const { error } = await supabase
            .from('journal_pages')
            .update(item.payload)
            .eq('id', item.resourceId);
          if (error) throw error;
        } else if (item.operation === 'DELETE') {
          const { error } = await supabase
            .from('journal_pages')
            .delete()
            .eq('id', item.resourceId);
          if (error) throw error;
        } else if (item.operation === 'CREATE') {
          const { error } = await supabase
            .from('journal_pages')
            .insert(item.payload);
          if (error) throw error;
        }
        break;
      }
      case 'element': {
        if (item.operation === 'UPDATE') {
          const { error } = await supabase
            .from('journal_elements')
            .update(item.payload)
            .eq('id', item.resourceId);
          if (error) throw error;
        } else if (item.operation === 'DELETE') {
          const { error } = await supabase
            .from('journal_elements')
            .delete()
            .eq('id', item.resourceId);
          if (error) throw error;
        } else if (item.operation === 'CREATE') {
          const { error } = await supabase
            .from('journal_elements')
            .insert(item.payload);
          if (error) throw error;
        }
        break;
      }
      case 'journal': {
        if (item.operation === 'UPDATE') {
          const { error } = await supabase
            .from('journals')
            .update(item.payload)
            .eq('id', item.resourceId);
          if (error) throw error;
        }
        break;
      }
      case 'cover': {
        // Cover updates are journal updates
        const { error } = await supabase
          .from('journals')
          .update(item.payload)
          .eq('id', item.resourceId);
        if (error) throw error;
        break;
      }
    }

    devLog('SYNC', `Processed ${item.operation} ${item.resource}:${item.resourceId}`);
    return true;
  } catch (err) {
    devLog('SYNC', `Failed ${item.operation} ${item.resource}:${item.resourceId}`, err);
    return false;
  }
}

async function processQueue(): Promise<void> {
  if (syncInProgress) return;

  if (!navigator.onLine) {
    setStatus('offline');
    return;
  }

  syncInProgress = true;
  setStatus('syncing');

  try {
    const pending = await getPendingItems();
    if (pending.length === 0) {
      setStatus('idle');
      syncInProgress = false;
      return;
    }

    // Sort by timestamp
    pending.sort((a, b) => a.timestamp - b.timestamp);

    let anyFailed = false;

    for (const item of pending) {
      if (item.retries >= MAX_RETRIES) {
        devLog('SYNC', `Max retries reached for ${item.resource}:${item.resourceId}, skipping`);
        continue;
      }

      const success = await processItem(item);
      if (success) {
        await markSynced(item.id);
      } else {
        anyFailed = true;
        await incrementRetry(item.id);

        // Wait before retrying
        const delay = RETRY_DELAYS[Math.min(item.retries, RETRY_DELAYS.length - 1)];
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    // Clean up synced items
    await removeSyncedItems();

    if (anyFailed) {
      setStatus('error');
    } else {
      setStatus('synced');
      // After 3s, go back to idle
      setTimeout(() => setStatus('idle'), 3000);
    }
  } catch (err) {
    devLog('SYNC', 'Queue processing error', err);
    setStatus('error');
  } finally {
    syncInProgress = false;
  }
}

// ---------------------------------------------------------------------
// Status management
// ---------------------------------------------------------------------

function setStatus(status: SyncStatus) {
  if (currentStatus === status) return;
  currentStatus = status;
  devLog('SYNC', `Status: ${status}`);
  statusListeners.forEach((listener) => listener(status));
}

export function onSyncStatusChange(listener: StatusListener): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

export function getSyncStatus(): SyncStatus {
  return currentStatus;
}

// ---------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------

export function triggerSync(): void {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(processQueue, 100);
}

export function triggerSyncImmediate(): Promise<void> {
  return processQueue();
}

export function startSyncOnReconnect(): void {
  window.addEventListener('online', () => {
    devLog('SYNC', 'Online detected, triggering sync');
    triggerSync();
  });

  window.addEventListener('offline', () => {
    setStatus('offline');
  });

  // Initial status
  if (!navigator.onLine) {
    setStatus('offline');
  }
}

export function stopSync(): void {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  syncInProgress = false;
}
