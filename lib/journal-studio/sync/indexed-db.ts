// =====================================================================
// Kininaru — Journal Studio IndexedDB Layer
// =====================================================================
// Provides offline persistence for journal operations.
// All mutations go through IndexedDB first, then sync to Supabase.

const DB_NAME = 'kininaru-journal';
const DB_VERSION = 1;
const STORES = {
  queue: 'sync-queue',
  pages: 'pages-cache',
  elements: 'elements-cache',
} as const;

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';
export type SyncResource = 'journal' | 'page' | 'element' | 'cover';

export interface SyncQueueItem {
  id: string;
  resource: SyncResource;
  operation: SyncOperation;
  resourceId: string;
  parentId?: string; // journal_id for pages, page_id for elements
  payload: Record<string, unknown>;
  timestamp: number;
  retries: number;
  synced: boolean;
}

export interface PageCache {
  pageId: string;
  journalId: string;
  elements: Record<string, unknown>[];
  pageNumber: number;
  paperStyle: string;
  updatedAt: number;
}

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.queue)) {
        const queueStore = db.createObjectStore(STORES.queue, { keyPath: 'id' });
        queueStore.createIndex('synced', 'synced', { unique: false });
        queueStore.createIndex('resource', 'resource', { unique: false });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.pages)) {
        const pagesStore = db.createObjectStore(STORES.pages, { keyPath: 'pageId' });
        pagesStore.createIndex('journalId', 'journalId', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.elements)) {
        const elementsStore = db.createObjectStore(STORES.elements, { keyPath: 'id' });
        elementsStore.createIndex('pageId', 'pageId', { unique: false });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };
  });
}

function transaction(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
  if (!dbInstance) throw new Error('IndexedDB not initialized');
  const tx = dbInstance.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------
// Sync Queue Operations
// ---------------------------------------------------------------------

export async function addToQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries' | 'synced'>): Promise<SyncQueueItem> {
  await openDB();
  const store = transaction(STORES.queue, 'readwrite');

  const entry: SyncQueueItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    retries: 0,
    synced: false,
  };

  await promisifyRequest(store.put(entry));
  return entry;
}

export async function getPendingItems(): Promise<SyncQueueItem[]> {
  await openDB();
  const store = transaction(STORES.queue);
  const all = await promisifyRequest(store.getAll());
  return all.filter((item) => !item.synced);
}

export async function getPendingItemsForResource(resource: SyncResource, resourceId: string): Promise<SyncQueueItem[]> {
  const items = await getPendingItems();
  return items.filter((item) => item.resource === resource && item.resourceId === resourceId);
}

export async function markSynced(id: string): Promise<void> {
  await openDB();
  const store = transaction(STORES.queue, 'readwrite');
  const item = await promisifyRequest(store.get(id));
  if (item) {
    item.synced = true;
    await promisifyRequest(store.put(item));
  }
}

export async function removeSyncedItems(): Promise<void> {
  await openDB();
  const store = transaction(STORES.queue, 'readwrite');
  const all = await promisifyRequest(store.getAll());
  const syncedItems = all.filter((item) => item.synced);

  for (const item of syncedItems) {
    await promisifyRequest(store.delete(item.id));
  }
}

export async function incrementRetry(id: string): Promise<void> {
  await openDB();
  const store = transaction(STORES.queue, 'readwrite');
  const item = await promisifyRequest(store.get(id));
  if (item) {
    item.retries += 1;
    await promisifyRequest(store.put(item));
  }
}

export async function clearQueue(): Promise<void> {
  await openDB();
  const store = transaction(STORES.queue, 'readwrite');
  await promisifyRequest(store.clear());
}

// ---------------------------------------------------------------------
// Page Cache Operations
// ---------------------------------------------------------------------

export async function cachePage(page: PageCache): Promise<void> {
  await openDB();
  const store = transaction(STORES.pages, 'readwrite');
  await promisifyRequest(store.put(page));
}

export async function getCachedPage(pageId: string): Promise<PageCache | null> {
  await openDB();
  const store = transaction(STORES.pages);
  const result = await promisifyRequest(store.get(pageId));
  return result || null;
}

export async function getCachedPagesForJournal(journalId: string): Promise<PageCache[]> {
  await openDB();
  const store = transaction(STORES.pages);
  const index = store.index('journalId');
  return promisifyRequest(index.getAll(journalId));
}

export async function removeCachedPage(pageId: string): Promise<void> {
  await openDB();
  const store = transaction(STORES.pages, 'readwrite');
  await promisifyRequest(store.delete(pageId));
}

// ---------------------------------------------------------------------
// Elements Cache Operations
// ---------------------------------------------------------------------

export async function cacheElements(pageId: string, elements: Record<string, unknown>[]): Promise<void> {
  await openDB();
  const store = transaction(STORES.elements, 'readwrite');

  // First remove old elements for this page
  const index = store.index('pageId');
  const existing = await promisifyRequest(index.getAll(pageId));
  for (const el of existing) {
    await promisifyRequest(store.delete(el.id));
  }

  // Then add new ones
  for (const el of elements) {
    await promisifyRequest(store.put({ ...el, pageId }));
  }
}

export async function getCachedElements(pageId: string): Promise<Record<string, unknown>[]> {
  await openDB();
  const store = transaction(STORES.elements);
  const index = store.index('pageId');
  return promisifyRequest(index.getAll(pageId));
}

export async function clearAllCache(): Promise<void> {
  await openDB();
  if (!dbInstance) throw new Error('IndexedDB not initialized');
  const tx = dbInstance.transaction([STORES.pages, STORES.elements], 'readwrite');
  await Promise.all([
    promisifyRequest(tx.objectStore(STORES.pages).clear()),
    promisifyRequest(tx.objectStore(STORES.elements).clear()),
  ]);
}

// ---------------------------------------------------------------------
// Initialize
// ---------------------------------------------------------------------

export async function initIndexedDB(): Promise<void> {
  await openDB();
}

// ---------------------------------------------------------------------
// DEV logging
// ---------------------------------------------------------------------

const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';

export function devLog(category: string, message: string, data?: unknown) {
  if (isDev) {
    console.log(`[JOURNAL_${category}] ${message}`, data ?? '');
  }
}
