'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Trash2, Copy, ZoomIn, ZoomOut, Maximize,
  Type, Square, Smile, Image, Pen, Undo2, Redo2,
  Check, Loader2, MoreVertical, Grid3X3, Move, Layers,
  AlertTriangle, CopyPlus, ChevronLeft, ChevronRight, Search, Star,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Paintbrush, Palette, Minus, RotateCw, CloudOff, Cloud,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getJournal, getJournalPages, getPageElements,
  batchPersistElements, createJournalPage, deleteJournalPage,
  duplicateJournalPage, reorderJournalPages, uploadJournalImage,
  updateJournalPage, createElement, deleteElement,
} from '@/lib/journal-studio/supabase';
import type {
  Journal, JournalPage, JournalElement, ElementType,
  TextProperties, ShapeProperties, ImageProperties, PaperStyle,
} from '@/lib/journal-studio/types';
import {
  DEFAULT_TEXT_PROPERTIES, DEFAULT_SHAPE_PROPERTIES, PAPER_PATTERNS,
  PAPER_BACKGROUND_COLORS, TEXT_PRESETS, FONT_FAMILIES,
} from '@/lib/journal-studio/types';
import {
  initIndexedDB, addToQueue, devLog, cacheElements, getCachedElements,
} from '@/lib/journal-studio/sync/indexed-db';
import {
  triggerSync, onSyncStatusChange, type SyncStatus,
} from '@/lib/journal-studio/sync/sync-engine';
import {
  executeCommand, undo as historyUndo, redo as historyRedo,
  onHistoryChange, getHistorySnapshot, resetHistory,
  createElementCommand, deleteElementCommand, updateElementCommand, compoundCommand,
} from '@/lib/journal-studio/history';
import { StickerPicker } from './sticker-picker';
import { QuickBlocksPanel, QUICK_BLOCKS, type QuickBlock } from './quick-blocks';
import { JournalSearch } from './journal-search';
import { ShapePicker } from './shape-picker';
import { ElementRenderer } from './element-renderer';
import { PageThumbnails } from './page-thumbnails';
import { ContextMenu } from './context-menu';

// ---- Constants ----
const PAGE_W = 595;
const PAGE_H = 842;
const AUTOSAVE_DEBOUNCE = 2500;
const MAX_DRAWING_POINTS = 600;

type Tool = 'select' | 'text' | 'shape' | 'sticker' | 'image' | 'drawing';

const PAPER_OPTIONS: { value: PaperStyle; label: string }[] = [
  { value: 'blank', label: 'Blanc' },
  { value: 'lined', label: 'Ligné' },
  { value: 'dotted', label: 'Pointillé' },
  { value: 'grid', label: 'Grillé' },
  { value: 'cream', label: 'Crème' },
  { value: 'white', label: 'Blanc cassé' },
  { value: 'pastel', label: 'Pastel' },
  { value: 'kraft', label: 'Kraft' },
  { value: 'rose', label: 'Rose' },
  { value: 'sky', label: 'Ciel' },
  { value: 'lavender', label: 'Lavande' },
  { value: 'dark', label: 'Sombre' },
];

const INK_COLORS = [
  '#1a1a1a', '#4a5568', '#718096', '#e53e3e', '#dd6b20',
  '#d69e2e', '#38a169', '#3182ce', '#805ad5', '#d53f8c',
  '#9b2c2c', '#2c5282', '#276749', '#744210', '#553c9a',
];

export function JournalEditor({ journalId, onBack }: { journalId: string; onBack: () => void }) {
  // ---- Data ----
  const [journal, setJournal] = useState<Journal | null>(null);
  const [pages, setPages] = useState<JournalPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [elements, setElements] = useState<JournalElement[]>([]);
  const [pagesElements, setPagesElements] = useState<Map<string, JournalElement[]>>(new Map());

  // ---- UI State ----
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [contextMenu, setContextMenu] = useState<{ elementId: string; x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showPaperPicker, setShowPaperPicker] = useState(false);

  // ---- Drawing ----
  const [drawingPoints, setDrawingPoints] = useState<[number, number, number][]>([]);
  const [drawingColor, setDrawingColor] = useState('#1a1a1a');
  const [drawingSize, setDrawingSize] = useState(3);
  const [drawingTool, setDrawingTool] = useState<'pen' | 'pencil' | 'highlighter' | 'eraser'>('pen');
  const [isDrawing, setIsDrawing] = useState(false);

  // ---- Pickers ----
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showShapePicker, setShowShapePicker] = useState(false);
  const [showQuickBlocks, setShowQuickBlocks] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // ---- Undo/Redo (from history manager) ----
  const [historyState, setHistoryState] = useState(getHistorySnapshot());

  // ---- Dirty tracking & autosave ----
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'offline'>('idle');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const currentPageRef = useRef<JournalPage | null>(null);
  const currentPageIndexRef = useRef(0);
  currentPageIndexRef.current = currentPageIndex;
  const isFlushingRef = useRef(false);

  // ---- Clipboard ----
  const clipboardRef = useRef<JournalElement | null>(null);

  const currentPage = pages[currentPageIndex] || null;
  currentPageRef.current = currentPage;
  const canvasRef = useRef<HTMLDivElement>(null);

  // ---- Position snapshots for undo tracking ----
  const dragSnapshotRef = useRef<{ x: number; y: number; width: number; height: number; rotation: number; z_index: number; opacity: number } | null>(null);
  const propsSnapshotRef = useRef<Record<string, unknown> | null>(null);
  const multiDragSnapshotRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // ===================================================================
  // INIT: IndexedDB + Sync + History listener
  // ===================================================================
  useEffect(() => {
    initIndexedDB().catch(() => {});
    const unsubSync = onSyncStatusChange(setSyncStatus);
    const unsubHistory = onHistoryChange(() => setHistoryState(getHistorySnapshot()));
    return () => { unsubSync(); unsubHistory(); };
  }, []);

  // ===================================================================
  // LOAD
  // ===================================================================
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const j = await getJournal(journalId);
        if (cancelled || !j) { if (!cancelled) onBack(); return; }
        setJournal(j);

        const p = await getJournalPages(journalId);
        if (cancelled) return;
        setPages(p);

        if (p.length > 0) {
          const els = await getPageElements(p[0].id);
          if (cancelled) return;
          setElements(els);
          resetHistory();
          // Cache in IndexedDB
          cacheElements(p[0].id, els as unknown as Record<string, unknown>[]).catch(() => {});
        }
      } catch {
        if (!cancelled) onBack();
      }
    })();
    return () => { cancelled = true; };
  }, [journalId, onBack]);

  // ===================================================================
  // FLUSH: Save current page elements before switching
  // ===================================================================
  const flushCurrentPage = useCallback(async () => {
    if (isFlushingRef.current) return;
    if (!dirtyRef.current) return;

    isFlushingRef.current = true;
    const page = currentPageRef.current;
    const els = elementsRef.current;

    if (!page) {
      isFlushingRef.current = false;
      return;
    }

    try {
      const updates = els
        .filter((el) => el.id && !el.id.startsWith('local-'))
        .map((el) => ({
          id: el.id,
          updates: {
            x: Math.round(el.x * 100) / 100,
            y: Math.round(el.y * 100) / 100,
            width: Math.round(el.width * 100) / 100,
            height: Math.round(el.height * 100) / 100,
            rotation: Math.round(el.rotation * 100) / 100,
            z_index: el.z_index,
            opacity: Math.round(el.opacity * 100) / 100,
            properties: el.properties as unknown as Record<string, unknown>,
          },
        }));

      if (updates.length > 0) {
        await batchPersistElements(updates, { page_id: page.id, elements: [] }, []);
        dirtyRef.current = false;
        devLog('FLUSH', `Flushed ${updates.length} elements for page ${page.id}`);
      }

      // Also cache locally
      cacheElements(page.id, els as unknown as Record<string, unknown>[]).catch(() => {});
    } catch (err) {
      devLog('FLUSH', 'Flush failed, queuing to IndexedDB', err);
      // Queue to IndexedDB for later sync
      await addToQueue({
        resource: 'element',
        operation: 'UPDATE',
        resourceId: page.id,
        parentId: page.journal_id,
        payload: { elements: els },
      });
      triggerSync();
    } finally {
      isFlushingRef.current = false;
    }
  }, []);

  // ===================================================================
  // PAGE CHANGE: Flush current, then load new page
  // ===================================================================
  const loadPage = useCallback(async (idx: number) => {
    if (!pages[idx]) return;

    // Flush current page first
    await flushCurrentPage();

    try {
      // Try cache first
      const cached = await getCachedElements(pages[idx].id);
      if (cached && cached.length > 0) {
        setElements(cached as unknown as JournalElement[]);
      } else {
        const els = await getPageElements(pages[idx].id);
        setElements(els);
        cacheElements(pages[idx].id, els as unknown as Record<string, unknown>[]).catch(() => {});
      }
      setSelectedId(null);
      resetHistory();
      dirtyRef.current = false;
      setSaveStatus('idle');
    } catch (err) {
      devLog('PAGE', `Failed to load page ${pages[idx].id}`, err);
      // Try cache on network failure
      try {
        const cached = await getCachedElements(pages[idx].id);
        if (cached) {
          setElements(cached as unknown as JournalElement[]);
          setSaveStatus('offline');
        }
      } catch { /* silent */ }
    }
  }, [pages, flushCurrentPage]);

  // Navigate to a page
  const navigateToPage = useCallback(async (idx: number) => {
    if (idx === currentPageIndexRef.current) return;
    if (idx < 0 || idx >= pages.length) return;
    setCurrentPageIndex(idx);
    await loadPage(idx);
  }, [pages, loadPage]);

  // ===================================================================
  // AUTOSAVE — debounced batch persist
  // ===================================================================
  const persistToServer = useCallback(async () => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    setSaveStatus('saving');

    const page = currentPageRef.current;
    const els = elementsRef.current;
    if (!page) { setSaveStatus('error'); return; }

    try {
      const updates = els
        .filter((el) => el.id && !el.id.startsWith('local-'))
        .map((el) => ({
          id: el.id,
          updates: {
            x: Math.round(el.x * 100) / 100,
            y: Math.round(el.y * 100) / 100,
            width: Math.round(el.width * 100) / 100,
            height: Math.round(el.height * 100) / 100,
            rotation: Math.round(el.rotation * 100) / 100,
            z_index: el.z_index,
            opacity: Math.round(el.opacity * 100) / 100,
            properties: el.properties as unknown as Record<string, unknown>,
          },
        }));

      if (updates.length > 0) {
        await batchPersistElements(updates, { page_id: page.id, elements: [] }, []);
      }

      // Cache locally
      cacheElements(page.id, els as unknown as Record<string, unknown>[]).catch(() => {});

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      if (!navigator.onLine) {
        setSaveStatus('offline');
        // Queue for later sync
        for (const el of els) {
          if (el.id && !el.id.startsWith('local-')) {
            await addToQueue({
              resource: 'element',
              operation: 'UPDATE',
              resourceId: el.id,
              parentId: page.id,
              payload: {
                x: el.x, y: el.y, width: el.width, height: el.height,
                rotation: el.rotation, z_index: el.z_index, opacity: el.opacity,
                properties: el.properties,
              },
            });
          }
        }
        triggerSync();
      } else {
        setSaveStatus('error');
      }
      dirtyRef.current = true;
    }
  }, []);

  // Debounced autosave
  useEffect(() => {
    if (!dirtyRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(persistToServer, AUTOSAVE_DEBOUNCE);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [elements, persistToServer]);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  // ===================================================================
  // HISTORY (undo/redo) — via Command pattern
  // ===================================================================
  const handleUndo = useCallback(async () => {
    await historyUndo();
  }, []);

  const handleRedo = useCallback(async () => {
    await historyRedo();
  }, []);

  // ===================================================================
  // ELEMENT OPERATIONS (local-first with Command pattern)
  // ===================================================================
  const addElement = useCallback(
    async (type: ElementType, properties: Record<string, unknown>, x?: number, y?: number) => {
      const page = currentPageRef.current;
      if (!page) return;

      try {
        // Create optimistically with a temporary ID
        const tempId = `local-${crypto.randomUUID()}`;
        const newEl: JournalElement = {
          id: tempId,
          page_id: page.id,
          user_id: '',
          element_type: type,
          x: x ?? 100,
          y: y ?? 100,
          width: type === 'text' ? 200 : type === 'sticker' ? 80 : 120,
          height: type === 'text' ? 100 : type === 'sticker' ? 80 : 120,
          rotation: 0,
          z_index: elementsRef.current.length,
          opacity: 1,
          properties: properties as unknown as JournalElement['properties'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Execute creates the element in Supabase
        const command = createElementCommand(
          newEl,
          (el) => {
            // Replace temp with real element
            setElements((prev) => {
              const idx = prev.findIndex((p) => p.id === tempId);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = el;
                return copy;
              }
              return [...prev, el];
            });
          },
          (id) => setElements((prev) => prev.filter((e) => e.id !== id))
        );

        await executeCommand(command);
        setSelectedId(newEl.id);
        setActiveTool('select');
        markDirty();
      } catch (err) {
        devLog('ELEMENT', 'Failed to create element', err);
      }
    },
    [markDirty]
  );

  const handleUpdateLocal = useCallback((id: string, overrides: Partial<JournalElement>) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...overrides } : el))
    );
    markDirty();
  }, [markDirty]);

  // Snapshot element state before drag/resize/rotate for undo
  const snapshotElement = useCallback((id: string) => {
    const el = elementsRef.current.find((e) => e.id === id);
    if (el) {
      dragSnapshotRef.current = {
        x: el.x, y: el.y, width: el.width, height: el.height,
        rotation: el.rotation, z_index: el.z_index, opacity: el.opacity,
      };
      propsSnapshotRef.current = el.properties as unknown as Record<string, unknown>;
    }
    // Snapshot all selected elements for multi-select undo
    const snaps = new Map<string, { x: number; y: number }>();
    for (const sid of selectedIds) {
      const sEl = elementsRef.current.find((e) => e.id === sid);
      if (sEl) snaps.set(sid, { x: sEl.x, y: sEl.y });
    }
    if (snaps.size > 1) {
      snaps.set(id, { x: el?.x ?? 0, y: el?.y ?? 0 });
    }
    multiDragSnapshotRef.current = snaps;
  }, [selectedIds]);

  const handleDragEnd = useCallback((id: string) => {
    markDirty();
    const el = elementsRef.current.find((e) => e.id === id);
    
    // Multi-select: create compound undo for all selected elements that moved
    const multiSnapshots = multiDragSnapshotRef.current;
    if (multiSnapshots.size > 1) {
      const commands: ReturnType<typeof updateElementCommand>[] = [];
      for (const [eid, prevPos] of multiSnapshots) {
        const e = elementsRef.current.find((el) => el.id === eid);
        if (e) {
          commands.push(updateElementCommand(
            e.page_id, eid,
            e.properties as unknown as Record<string, unknown>, e.properties as unknown as Record<string, unknown>,
            { ...prevPos, width: e.width, height: e.height, rotation: e.rotation, z_index: e.z_index, opacity: e.opacity },
            { x: e.x, y: e.y, width: e.width, height: e.height, rotation: e.rotation, z_index: e.z_index, opacity: e.opacity },
            (eid2, updates) => {
              setElements((p) => p.map((el2) => el2.id === eid2 ? { ...el2, ...updates } : el2));
            }
          ));
        }
      }
      if (commands.length > 0) {
        executeCommand(compoundCommand(commands)).catch(() => {});
      }
      multiDragSnapshotRef.current = new Map();
    } else if (el && dragSnapshotRef.current) {
      // Single element drag
      const prev = dragSnapshotRef.current;
      const prevProps = propsSnapshotRef.current ?? el.properties as unknown as Record<string, unknown>;
      const cmd = updateElementCommand(
        el.page_id, id,
        prevProps, el.properties as unknown as Record<string, unknown>,
        prev,
        { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation, z_index: el.z_index, opacity: el.opacity },
        (eid, updates) => {
          setElements((p) => p.map((e) => e.id === eid ? { ...e, ...updates } : e));
        }
      );
      executeCommand(cmd).catch(() => {});
    }
    dragSnapshotRef.current = null;
    propsSnapshotRef.current = null;
  }, [markDirty]);

  const handleResizeEnd = useCallback((id: string) => {
    markDirty();
    const el = elementsRef.current.find((e) => e.id === id);
    if (el && dragSnapshotRef.current) {
      const prev = dragSnapshotRef.current;
      const prevProps = propsSnapshotRef.current ?? el.properties as unknown as Record<string, unknown>;
      const cmd = updateElementCommand(
        el.page_id, id,
        prevProps, el.properties as unknown as Record<string, unknown>,
        prev,
        { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation, z_index: el.z_index, opacity: el.opacity },
        (eid, updates) => {
          setElements((p) => p.map((e) => e.id === eid ? { ...e, ...updates } : e));
        }
      );
      executeCommand(cmd).catch(() => {});
    }
    dragSnapshotRef.current = null;
    propsSnapshotRef.current = null;
  }, [markDirty]);

  const handleRotateEnd = useCallback((id: string) => {
    markDirty();
    const el = elementsRef.current.find((e) => e.id === id);
    if (el && dragSnapshotRef.current) {
      const prev = dragSnapshotRef.current;
      const prevProps = propsSnapshotRef.current ?? el.properties as unknown as Record<string, unknown>;
      const cmd = updateElementCommand(
        el.page_id, id,
        prevProps, el.properties as unknown as Record<string, unknown>,
        prev,
        { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation, z_index: el.z_index, opacity: el.opacity },
        (eid, updates) => {
          setElements((p) => p.map((e) => e.id === eid ? { ...e, ...updates } : e));
        }
      );
      executeCommand(cmd).catch(() => {});
    }
    dragSnapshotRef.current = null;
    propsSnapshotRef.current = null;
  }, [markDirty]);  const handleDeleteElement = useCallback(async (id: string) => {
    const el = elementsRef.current.find((e) => e.id === id);
    if (!el) return;
    const command = deleteElementCommand(
      el,
      (deletedEl) => setElements((prev) => [...prev, deletedEl]),
      (eid) => setElements((prev) => prev.filter((e) => e.id !== eid))
    );
    setSelectedId(null);
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    await executeCommand(command);
    markDirty();
  }, [markDirty]);

  // ---- Lock / Unlock ----
  const handleToggleLock = useCallback((id: string) => {
    setElements((prev) => prev.map((el) => el.id === id ? { ...el, is_locked: !(el.is_locked ?? false) } : el));
    markDirty();
  }, [markDirty]);

  // ---- Layer management ----
  const handleBringForward = useCallback((id: string) => {
    setElements((prev) => {
      const sorted = [...prev].sort((a, b) => a.z_index - b.z_index);
      const idx = sorted.findIndex((e) => e.id === id);
      if (idx < 0 || idx >= sorted.length - 1) return prev;
      const targetZ = sorted[idx + 1].z_index;
      sorted[idx] = { ...sorted[idx], z_index: targetZ };
      sorted[idx + 1] = { ...sorted[idx + 1], z_index: targetZ - 1 };
      return sorted;
    });
    markDirty();
  }, [markDirty]);

  const handleSendBackward = useCallback((id: string) => {
    setElements((prev) => {
      const sorted = [...prev].sort((a, b) => a.z_index - b.z_index);
      const idx = sorted.findIndex((e) => e.id === id);
      if (idx <= 0) return prev;
      const targetZ = sorted[idx - 1].z_index;
      sorted[idx] = { ...sorted[idx], z_index: targetZ };
      sorted[idx - 1] = { ...sorted[idx - 1], z_index: targetZ + 1 };
      return sorted;
    });
    markDirty();
  }, [markDirty]);

  const handleBringToFront = useCallback((id: string) => {
    const maxZ = Math.max(...elementsRef.current.map((e) => e.z_index));
    setElements((prev) => prev.map((el) => el.id === id ? { ...el, z_index: maxZ + 1 } : el));
    markDirty();
  }, [markDirty]);

  const handleSendToBack = useCallback((id: string) => {
    const minZ = Math.min(...elementsRef.current.map((e) => e.z_index));
    setElements((prev) => prev.map((el) => el.id === id ? { ...el, z_index: minZ - 1 } : el));
    markDirty();
  }, [markDirty]);

  // ---- Multi-select toggle ----
  const handleToggleSelect = useCallback((id: string, e: React.MouseEvent) => {
    if (e.shiftKey || e.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
      setSelectedId(null);
    } else {
      setSelectedId(id);
      setSelectedIds(new Set());
    }
  }, []);

  // ---- Favorites ----
  const [favoritePages, setFavoritePages] = useState<Set<number>>(new Set());

  const toggleFavorite = useCallback((pageIndex: number) => {
    setFavoritePages((prev) => {
      const next = new Set(prev);
      if (next.has(pageIndex)) {
        next.delete(pageIndex);
      } else {
        next.add(pageIndex);
      }
      return next;
    });
  }, []);

  // ---- Context menu ----
  const handleContextMenuAction = useCallback((action: string, id: string) => {
    switch (action) {
      case 'lock': handleToggleLock(id); break;
      case 'forward': handleBringForward(id); break;
      case 'backward': handleSendBackward(id); break;
      case 'front': handleBringToFront(id); break;
      case 'back': handleSendToBack(id); break;
    }
  }, [handleToggleLock, handleBringForward, handleSendBackward, handleBringToFront, handleSendToBack]);

  // ===================================================================
  // COPY / PASTE / DUPLICATE
  // ===================================================================
  const copyElementById = useCallback((id: string) => {
    const el = elements.find((e) => e.id === id);
    if (el) clipboardRef.current = JSON.parse(JSON.stringify(el));
  }, [elements]);

  const handleCopy = useCallback(() => {
    if (!selectedId) return;
    copyElementById(selectedId);
  }, [copyElementById, selectedId]);

  const handlePaste = useCallback(async () => {
    const src = clipboardRef.current;
    const page = currentPageRef.current;
    if (!src || !page) return;

    try {
      await addElement(
        src.element_type,
        JSON.parse(JSON.stringify(src.properties)) as Record<string, unknown>,
        src.x + 20,
        src.y + 20
      );
    } catch {
      // silent
    }
  }, [addElement]);

  const handleDuplicate = useCallback(async () => {
    handleCopy();
    await handlePaste();
  }, [handleCopy, handlePaste]);

  // ===================================================================
  // CANVAS CLICK — coordinate conversion
  // ===================================================================
  const screenToPage = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = (clientX - rect.left) / zoom;
    const y = (clientY - rect.top) / zoom;
    return { x, y };
  }, [zoom]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target !== canvasRef.current && !target.classList.contains('canvas-bg')) return;

      if (activeTool === 'text') {
        const pos = screenToPage(e.clientX, e.clientY);
        if (!pos) return;
        addElement('text', DEFAULT_TEXT_PROPERTIES as unknown as Record<string, unknown>, pos.x, pos.y);
      } else if (activeTool === 'shape') {
        setShowShapePicker(true);
      } else if (activeTool === 'sticker') {
        setShowStickerPicker(true);
      } else if (activeTool === 'image') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png,image/jpeg,image/webp';
        input.onchange = async (ev) => {
          const file = (ev.target as HTMLInputElement).files?.[0];
          const page = currentPageRef.current;
          const j = journal;
          if (!file || !page || !j) return;
          try {
            const url = await uploadJournalImage(file, j.id);
            addElement('image', { url, alt: file.name, object_fit: 'cover' });
          } catch (err) {
            devLog('IMAGE', 'Upload failed', err);
          }
        };
        input.click();
      } else {
        setSelectedId(null);
      }
    },
    [activeTool, addElement, journal, screenToPage]
  );

  // ===================================================================
  // KEYBOARD SHORTCUTS
  // ===================================================================
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // Ctrl/Cmd+S = force flush
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        flushCurrentPage();
        persistToServer();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) { e.preventDefault(); handleDeleteElement(selectedId); }
      }
      if (e.key === 'Escape') { setSelectedId(null); setActiveTool('select'); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); handleRedo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); handleRedo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedId) { handleCopy(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') { handlePaste(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedId) { e.preventDefault(); handleDuplicate(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, handleDeleteElement, handleUndo, handleRedo, handleCopy, handlePaste, handleDuplicate, flushCurrentPage, persistToServer]);

  // ===================================================================
  // PAGE OPERATIONS
  // ===================================================================
  const handleAddPage = useCallback(async () => {
    const j = journal;
    if (!j) return;
    try {
      // Flush current page first
      await flushCurrentPage();

      const newPage = await createJournalPage(j.id, pages.length + 1, j.paper_style);
      setPages((prev) => [...prev, newPage]);
      await loadPage(pages.length); // Navigate to the new page
    } catch (err) {
      devLog('PAGE', 'Failed to add page', err);
    }
  }, [journal, pages, flushCurrentPage, loadPage]);

  const handleDuplicatePage = useCallback(async () => {
    const page = currentPageRef.current;
    if (!page) return;
    try {
      // Flush current page first
      await flushCurrentPage();

      const dup = await duplicateJournalPage(page.id, pages.length + 1);
      setPages((prev) => [...prev, dup]);
      await loadPage(pages.length); // Navigate to the new page
    } catch (err) {
      devLog('PAGE', 'Failed to duplicate page', err);
    }
  }, [pages, flushCurrentPage, loadPage]);

  const handleDeletePage = useCallback(async () => {
    const page = currentPageRef.current;
    if (!page || pages.length <= 1) return;
    if (!window.confirm('Supprimer cette page ?')) return;

    try {
      await deleteJournalPage(page.id);
      const newPages = pages.filter((p) => p.id !== page.id);
      setPages(newPages);
      const newIndex = Math.max(0, Math.min(currentPageIndex, newPages.length - 1));
      setCurrentPageIndex(newIndex);
      await loadPage(newIndex);
    } catch (err) {
      devLog('PAGE', 'Failed to delete page', err);
    }
  }, [pages, currentPageIndex, loadPage]);

  const handleMovePage = useCallback(async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= pages.length) return;

    // Flush current page
    await flushCurrentPage();

    const newPages = [...pages];
    const [moved] = newPages.splice(fromIndex, 1);
    newPages.splice(toIndex, 0, moved);
    setPages(newPages);

    // Update current index
    if (currentPageIndex === fromIndex) {
      setCurrentPageIndex(toIndex);
    } else if (fromIndex < currentPageIndex && toIndex >= currentPageIndex) {
      setCurrentPageIndex((prev) => prev - 1);
    } else if (fromIndex > currentPageIndex && toIndex <= currentPageIndex) {
      setCurrentPageIndex((prev) => prev + 1);
    }

    // Atomic reorder via Supabase
    try {
      const pageIds = newPages.map((p) => p.id);
      await reorderJournalPages(pages[0].journal_id, pageIds);
    } catch (err) {
      devLog('PAGE', 'Failed to reorder pages', err);
    }
  }, [pages, currentPageIndex, flushCurrentPage]);

  // Paper change for current page
  const handlePaperChange = useCallback(async (style: PaperStyle) => {
    const page = currentPageRef.current;
    if (!page) return;
    try {
      await updateJournalPage(page.id, { paper_style: style });
      setPages((prev) => prev.map((p) => p.id === page.id ? { ...p, paper_style: style } : p));
      setShowPaperPicker(false);
    } catch (err) {
      devLog('PAGE', 'Failed to update paper', err);
    }
  }, []);

  // ===================================================================
  // DRAWING — inline on canvas, coordinates relative to page
  // ===================================================================
  const drawingRef = useRef(false);
  const drawingPointsRef = useRef<[number, number, number][]>([]);

  const handleDrawPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    drawingRef.current = true;
    setIsDrawing(true);
    const pos = screenToPage(e.clientX, e.clientY);
    if (!pos) return;
    const point: [number, number, number] = [pos.x, pos.y, e.pressure || 0.5];
    drawingPointsRef.current = [point];
    setDrawingPoints([point]);

    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }, [screenToPage]);

  const handleDrawPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const pos = screenToPage(e.clientX, e.clientY);
    if (!pos) return;
    const pts = drawingPointsRef.current;
    const last = pts[pts.length - 1];
    if (last) {
      const dx = pos.x - last[0];
      const dy = pos.y - last[1];
      if (dx * dx + dy * dy < 4) return;
    }
    const point: [number, number, number] = [pos.x, pos.y, e.pressure || 0.5];

    if (pts.length >= MAX_DRAWING_POINTS) {
      const simplified: [number, number, number][] = [];
      for (let i = 0; i < pts.length; i += 2) {
        simplified.push(pts[i]);
      }
      simplified.push(point);
      drawingPointsRef.current = simplified;
      setDrawingPoints(simplified);
    } else {
      pts.push(point);
      setDrawingPoints([...pts]);
    }
  }, [screenToPage]);

  // ---- Quick Blocks ----
  const handleAddQuickBlock = useCallback(async (block: QuickBlock) => {
    const page = currentPageRef.current;
    if (!page) return;
    // Center on page
    const x = Math.max(20, (PAGE_W - 400) / 2);
    const y = Math.max(20, 100 + Math.random() * 100);
    try {
      await addElement(block.type as 'text' | 'shape', block.properties, x, y);
    } catch {
      // silent
    }
  }, [addElement]);

  const finishDrawing = useCallback(async () => {
    drawingRef.current = false;
    setIsDrawing(false);
    const pts = drawingPointsRef.current;
    drawingPointsRef.current = [];

    if (pts.length < 2) { setDrawingPoints([]); return; }

    const isEraser = drawingTool === 'eraser';
    const drawingProps = {
      points: pts,
      stroke_color: isEraser ? 'eraser' : drawingColor,
      stroke_width: isEraser ? drawingSize * 3 : drawingSize,
      opacity: drawingTool === 'highlighter' ? 0.4 : 1,
      tool: drawingTool,
    };

    setDrawingPoints([]);
    await addElement('drawing', drawingProps);
  }, [drawingColor, drawingSize, drawingTool, addElement]);

  // ===================================================================
  // SELECTED ELEMENT HELPERS
  // ===================================================================
  const selectedElement = elements.find((e) => e.id === selectedId) ?? null;

  // ===================================================================
  // SAVE STATUS DISPLAY
  // ===================================================================
  const getSaveStatusDisplay = () => {
    if (syncStatus === 'offline' || saveStatus === 'offline') {
      return <span className="flex items-center gap-1 text-xs text-muted-foreground"><CloudOff className="w-3 h-3" />Hors ligne</span>;
    }
    if (syncStatus === 'syncing' || saveStatus === 'saving') {
      return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /><span className="hidden sm:inline">…</span></span>;
    }
    if (syncStatus === 'synced' || saveStatus === 'saved') {
      return <span className="flex items-center gap-1 text-xs text-kin-sage"><Check className="w-3 h-3" /><span className="hidden sm:inline">Enregistré</span></span>;
    }
    if (saveStatus === 'error') {
      return <span className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="w-3 h-3" /></span>;
    }
    if (syncStatus === 'pending') {
      return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Cloud className="w-3 h-3" /><span className="hidden sm:inline">En attente</span></span>;
    }
    return null;
  };

  // ===================================================================
  // RENDER
  // ===================================================================
  if (!journal) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const paperBg = PAPER_PATTERNS[currentPage?.paper_style as keyof typeof PAPER_PATTERNS] ?? '';
  const paperColor = PAPER_BACKGROUND_COLORS[currentPage?.paper_style as keyof typeof PAPER_BACKGROUND_COLORS] ?? '#ffffff';

  return (
    <div className="flex flex-col h-full select-none bg-background">
      {/* ====== HEADER BAR ====== */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/80 backdrop-blur-sm z-20">
        <div className="flex items-center gap-2">
          <button onClick={async () => { await flushCurrentPage(); onBack(); }} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-smooth" aria-label="Retour à la bibliothèque">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-foreground truncate max-w-[120px] sm:max-w-[250px]">{journal.title}</h1>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-muted-foreground">Page {currentPageIndex + 1}/{pages.length}</p>
                <button
                  onClick={() => toggleFavorite(currentPageIndex)}
                  className="p-0.5 hover:scale-110 transition-transform"
                  aria-label={favoritePages.has(currentPageIndex) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                >
                  <Star className={cn('w-3.5 h-3.5', favoritePages.has(currentPageIndex) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground')} />
                </button>
              </div>
              {getSaveStatusDisplay()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Page navigation arrows */}
          <div className="hidden sm:flex items-center gap-0.5">
            <button onClick={() => navigateToPage(currentPageIndex - 1)} disabled={currentPageIndex === 0} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30" aria-label="Page précédente"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => navigateToPage(currentPageIndex + 1)} disabled={currentPageIndex >= pages.length - 1} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30" aria-label="Page suivante"><ChevronRight className="w-4 h-4" /></button>
          </div>

          <div className="h-5 w-px bg-border hidden sm:block" />

          {/* Undo/Redo */}
          <div className="flex items-center gap-0.5">
            <button onClick={handleUndo} disabled={!historyState.canUndo} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30" aria-label="Annuler"><Undo2 className="w-4 h-4" /></button>
            <button onClick={handleRedo} disabled={!historyState.canRedo} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30" aria-label="Rétablir"><Redo2 className="w-4 h-4" /></button>
          </div>

          <div className="h-5 w-px bg-border hidden sm:block" />

          {/* Zoom */}
          <div className="hidden sm:flex items-center gap-0.5">
            <button onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))} className="p-1.5 rounded-md hover:bg-muted" aria-label="Zoom arrière"><ZoomOut className="w-4 h-4" /></button>
            <span className="text-xs text-muted-foreground min-w-[36px] text-center font-medium">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(3, z + 0.1))} className="p-1.5 rounded-md hover:bg-muted" aria-label="Zoom avant"><ZoomIn className="w-4 h-4" /></button>
            <button onClick={() => setZoom(1)} className="p-1.5 rounded-md hover:bg-muted" aria-label="Taille réelle"><Maximize className="w-4 h-4" /></button>
          </div>

          <div className="h-5 w-px bg-border hidden sm:block" />

          {/* More */}
          <div className="relative">
            <button onClick={() => setShowMoreMenu(!showMoreMenu)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" aria-label="Plus d'options"><MoreVertical className="w-5 h-5" /></button>
            <AnimatePresence>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-border bg-card shadow-lg p-1">
                    <button onClick={() => { setShowThumbnails(!showThumbnails); setShowMoreMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted"><Grid3X3 className="w-4 h-4" />Miniatures</button>
                    <button onClick={() => { setShowPaperPicker(!showPaperPicker); setShowMoreMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted"><Palette className="w-4 h-4" />Changer le papier</button>
                    <div className="my-1 h-px bg-border" />
                    <button onClick={() => { handleAddPage(); setShowMoreMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted"><Plus className="w-4 h-4" />Ajouter une page</button>
                    <button onClick={() => { handleDuplicatePage(); setShowMoreMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted"><CopyPlus className="w-4 h-4" />Dupliquer la page</button>
                    {currentPageIndex > 0 && (
                      <button onClick={() => { handleMovePage(currentPageIndex, currentPageIndex - 1); setShowMoreMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted">↑ Déplacer vers le haut</button>
                    )}
                    {currentPageIndex < pages.length - 1 && (
                      <button onClick={() => { handleMovePage(currentPageIndex, currentPageIndex + 1); setShowMoreMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted">↓ Déplacer vers le bas</button>
                    )}
                    {pages.length > 1 && <div className="my-1 h-px bg-border" />}
                    {pages.length > 1 && <button onClick={() => { handleDeletePage(); setShowMoreMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" />Supprimer la page</button>}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* ====== CONTEXTUAL TOOLBAR ====== */}
      <ContextualToolbar
        selectedElement={selectedElement}
        activeTool={activeTool}
        drawingTool={drawingTool}
        drawingColor={drawingColor}
        drawingSize={drawingSize}
        onUpdateElement={(id, props) => {
          setElements((prev) =>
            prev.map((el) =>
              el.id === id
                ? { ...el, properties: { ...el.properties, ...props } as typeof el.properties }
                : el
            )
          );
          markDirty();
        }}
        onDrawingToolChange={setDrawingTool}
        onDrawingColorChange={setDrawingColor}
        onDrawingSizeChange={setDrawingSize}
        onExitDrawing={() => { setActiveTool('select'); setDrawingPoints([]); drawingRef.current = false; setIsDrawing(false); }}
        uploadImage={uploadJournalImage}
        journalId={journalId}
      />

      {/* ====== PAPER PICKER ====== */}
      <AnimatePresence>
        {showPaperPicker && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-b border-border bg-card overflow-hidden z-10">
            <div className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Paintbrush className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Style de papier</span>
                <button onClick={() => setShowPaperPicker(false)} className="ml-auto text-muted-foreground hover:text-foreground"><Minus className="w-4 h-4" /></button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {PAPER_OPTIONS.map((paper) => (
                  <button
                    key={paper.value}
                    onClick={() => handlePaperChange(paper.value)}
                    className={cn(
                      'flex-shrink-0 w-16 h-20 rounded-lg border-2 transition-smooth flex flex-col items-center justify-end p-1',
                      currentPage?.paper_style === paper.value
                        ? 'border-primary shadow-sm'
                        : 'border-border hover:border-primary/50'
                    )}
                    style={{
                      background: PAPER_PATTERNS[paper.value] || PAPER_BACKGROUND_COLORS[paper.value],
                    }}
                  >
                    <span className="text-[9px] font-medium text-foreground/70 bg-white/70 px-1 rounded">{paper.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====== MAIN AREA ====== */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop toolbar */}
        <div className="hidden md:flex flex-col w-14 border-r border-border bg-card/80 p-1.5 gap-0.5">
          <ToolBtn icon={Move} label="Sélect." active={activeTool === 'select'} onClick={() => setActiveTool('select')} />
          <ToolBtn icon={Type} label="Texte" active={activeTool === 'text'} onClick={() => setActiveTool('text')} />
          <ToolBtn icon={Square} label="Forme" active={activeTool === 'shape'} onClick={() => setActiveTool('shape')} />
          <ToolBtn icon={Smile} label="Sticker" active={activeTool === 'sticker'} onClick={() => setActiveTool('sticker')} />
          <ToolBtn icon={Image} label="Image" active={activeTool === 'image'} onClick={() => setActiveTool('image')} />
          <ToolBtn icon={Pen} label="Dessin" active={activeTool === 'drawing'} onClick={() => setActiveTool(activeTool === 'drawing' ? 'select' : 'drawing')} />
          <div className="flex-1" />
          <ToolBtn icon={Search} label="Chercher" active={showSearch} onClick={() => { setShowSearch(!showSearch); setShowQuickBlocks(false); }} />
          <ToolBtn icon={Plus} label="Blocs" active={showQuickBlocks} onClick={() => { setShowQuickBlocks(!showQuickBlocks); setShowSearch(false); }} />
          <ToolBtn icon={Layers} label="Pages" active={showThumbnails} onClick={() => setShowThumbnails(!showThumbnails)} />
        </div>

        {/* Thumbnails */}
        <AnimatePresence>
          {showThumbnails && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 130, opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="hidden md:block border-r border-border bg-card overflow-hidden flex-shrink-0">
              <PageThumbnails
                pages={pages}
                currentPageIndex={currentPageIndex}
                elements={elements}
                onSelectPage={(idx) => navigateToPage(idx)}
                onAddPage={handleAddPage}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ====== CANVAS AREA ====== */}
        <div
          className="flex-1 overflow-auto relative"
          style={{
            touchAction: activeTool === 'drawing' ? 'none' : 'auto',
            background: 'linear-gradient(135deg, #f5f5f4 0%, #e7e5e4 100%)',
          }}
          onPointerDown={activeTool === 'drawing' ? handleDrawPointerDown : undefined}
          onPointerMove={activeTool === 'drawing' ? handleDrawPointerMove : undefined}
          onPointerUp={activeTool === 'drawing' ? finishDrawing : undefined}
        >
          <div className="flex items-center justify-center min-h-full p-4 sm:p-8 gap-4">
            {/* Book spine effect */}
            <div
              className="hidden lg:block flex-shrink-0"
              style={{
                width: 6,
                height: PAGE_H * Math.min(zoom, 1.5),
                background: 'linear-gradient(90deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.04) 40%, rgba(0,0,0,0) 100%)',
                borderRadius: '0 2px 2px 0',
                opacity: zoom >= 0.8 ? 1 : 0,
              }}
            />

            {/* The page itself */}
            <div className="relative" style={{ perspective: '1200px' }}>
              <div
                ref={canvasRef}
                className="relative overflow-hidden"
                style={{
                  width: PAGE_W,
                  height: PAGE_H,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center center',
                  backgroundImage: paperBg || undefined,
                  backgroundSize: currentPage?.paper_style === 'grid' ? '20px 20px, 20px 20px' : undefined,
                  backgroundColor: paperColor,
                  boxShadow: '0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(0,0,0,0.04)',
                  borderRadius: '2px 6px 6px 2px',
                  borderLeft: '3px solid rgba(0,0,0,0.06)',
                }}
                onClick={handleCanvasClick}
              >
                {/* Rendered elements */}
                {elements.map((el) => (                  <ElementRenderer
                    key={el.id} element={el} isSelected={selectedId === el.id || selectedIds.has(el.id)} zoom={zoom}
                    onSelect={(e) => handleToggleSelect(el.id, e as React.MouseEvent)}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ elementId: el.id, x: e.clientX, y: e.clientY }); }}
                    onDragStart={snapshotElement}
                    onDragEnd={handleDragEnd}
                    onResizeStart={snapshotElement}
                    onResizeEnd={handleResizeEnd}
                    onRotateEnd={handleRotateEnd}
                    onUpdateLocal={handleUpdateLocal}
                    onDelete={() => handleDeleteElement(el.id)}
                    onUpdateElement={(id, props) => {
                      setElements((prev) =>
                        prev.map((el) =>
                          el.id === id
                            ? { ...el, properties: { ...el.properties, ...props } as typeof el.properties }
                            : el
                        )
                      );
                      markDirty();
                    }}
                  />
                ))}

                {/* Live drawing preview */}
                {isDrawing && drawingPoints.length >= 2 && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}>
                    <path
                      d={drawingPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')}
                      fill="none"
                      stroke={drawingTool === 'eraser' ? 'rgba(255,0,0,0.3)' : drawingColor}
                      strokeWidth={drawingTool === 'eraser' ? drawingSize * 3 : drawingSize}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={drawingTool === 'highlighter' ? 0.4 : 1}
                    />
                  </svg>
                )}
              </div>

              {/* Page number */}
              <div className="absolute -bottom-6 left-0 right-0 text-center">
                <span className="text-[10px] text-muted-foreground/60 font-medium">{currentPageIndex + 1}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ====== MOBILE BOTTOM BAR ====== */}
      <div className="md:hidden flex items-center justify-between px-2 py-1.5 border-t border-border bg-card/90 backdrop-blur-sm">
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {([
            { tool: 'select' as Tool, icon: Move, label: 'Sélect.' },
            { tool: 'text' as Tool, icon: Type, label: 'Texte' },
            { tool: 'shape' as Tool, icon: Square, label: 'Forme' },
            { tool: 'sticker' as Tool, icon: Smile, label: 'Sticker' },
            { tool: 'image' as Tool, icon: Image, label: 'Image' },
            { tool: 'drawing' as Tool, icon: Pen, label: 'Dessin' },
          ]).map(({ tool, icon: Icon, label }) => (
            <button key={tool} onClick={() => {
              if (tool === 'shape') { setShowShapePicker(true); setActiveTool('shape'); }
              else if (tool === 'sticker') { setShowStickerPicker(true); setActiveTool('sticker'); }
              else if (tool === 'image') {
                setActiveTool('image');
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/png,image/jpeg,image/webp';
                input.onchange = async (ev) => {
                  const file = (ev.target as HTMLInputElement).files?.[0];
                  const page = currentPageRef.current;
                  const j = journal;
                  if (!file || !page || !j) return;
                  try {
                    const url = await uploadJournalImage(file, j.id);
                    addElement('image', { url, alt: file.name, object_fit: 'cover' });
                  } catch { /* silent */ }
                };
                input.click();
              }
              else { setActiveTool(tool); }
            }} className={cn('p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex flex-col items-center justify-center gap-0.5', activeTool === tool ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')} aria-label={label}>
              <Icon className="w-5 h-5" />
              <span className="text-[8px] font-medium">{label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleUndo} disabled={!historyState.canUndo} className="p-2 rounded-lg hover:bg-muted disabled:opacity-30"><Undo2 className="w-4 h-4" /></button>
          <button onClick={handleRedo} disabled={!historyState.canRedo} className="p-2 rounded-lg hover:bg-muted disabled:opacity-30"><Redo2 className="w-4 h-4" /></button>
        </div>
      </div>

      {/* ====== CONTEXT MENU ====== */}
      {contextMenu && (
        <ContextMenu
          element={elements.find(el => el.id === contextMenu.elementId) ?? null}
          elements={elements}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onDuplicate={(id) => { copyElementById(id); handlePaste(); setContextMenu(null); }}
          onCopy={(id) => { copyElementById(id); setContextMenu(null); }}
          onDelete={(id) => { handleDeleteElement(id); setContextMenu(null); }}
          onLock={(id, locked) => {
            setElements(prev => prev.map(el => el.id === id ? { ...el, is_locked: locked } : el));
            setContextMenu(null);
          }}
          onBringForward={(id) => { handleBringForward(id); setContextMenu(null); }}
          onSendBackward={(id) => { handleSendBackward(id); setContextMenu(null); }}
          onBringToFront={(id) => { handleBringToFront(id); setContextMenu(null); }}
          onSendToBack={(id) => { handleSendToBack(id); setContextMenu(null); }}
        />
      )}

      {/* ====== SEARCH ====== */}
      <AnimatePresence>
        {showSearch && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-b border-border bg-card overflow-hidden z-10">
            <JournalSearch
              pages={pages}
              pagesElements={pagesElements}
              onGoToPage={(idx) => navigateToPage(idx)}
              onClose={() => setShowSearch(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====== QUICK BLOCKS ====== */}
      <AnimatePresence>
        {showQuickBlocks && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-b border-border bg-card overflow-hidden z-10">
            <QuickBlocksPanel
              onAddBlock={handleAddQuickBlock}
              onClose={() => setShowQuickBlocks(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====== PICKERS ====== */}
      <AnimatePresence>
        {showStickerPicker && (
          <StickerPicker onSelect={(s) => { addElement('sticker', { sticker_id: s.id, category: s.category }); setShowStickerPicker(false); }} onClose={() => setShowStickerPicker(false)} />
        )}
        {showShapePicker && (
          <ShapePicker onSelect={(s) => { addElement('shape', { ...DEFAULT_SHAPE_PROPERTIES, shape_type: s.type }); setShowShapePicker(false); }} onClose={() => setShowShapePicker(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ===================================================================
// CONTEXTUAL TOOLBAR — changes based on selected element / tool
// ===================================================================
function ContextualToolbar({
  selectedElement,
  activeTool,
  drawingTool,
  drawingColor,
  drawingSize,
  onUpdateElement,
  onDrawingToolChange,
  onDrawingColorChange,
  onDrawingSizeChange,
  onExitDrawing,
  uploadImage,
  journalId,
}: {
  selectedElement: JournalElement | null;
  activeTool: Tool;
  drawingTool: string;
  drawingColor: string;
  drawingSize: number;
  onUpdateElement: (id: string, props: Record<string, unknown>) => void;
  onDrawingToolChange: (tool: 'pen' | 'pencil' | 'highlighter' | 'eraser') => void;
  onDrawingColorChange: (color: string) => void;
  onDrawingSizeChange: (size: number) => void;
  onExitDrawing: () => void;
  uploadImage: (file: File, journalId: string) => Promise<string>;
  journalId: string;
}) {
  // Drawing toolbar
  if (activeTool === 'drawing') {
    return (
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border bg-card/80 overflow-x-auto">
        {(['pen', 'pencil', 'highlighter', 'eraser'] as const).map((t) => (
          <button
            key={t}
            onClick={() => onDrawingToolChange(t)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-smooth',
              drawingTool === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {t === 'pen' ? '✏️ Stylo' : t === 'pencil' ? '🖊️ Crayon' : t === 'highlighter' ? '🖍️ Surligneur' : '🧹 Gomme'}
          </button>
        ))}
        <div className="h-5 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          {INK_COLORS.slice(0, 8).map((c) => (
            <button key={c} onClick={() => onDrawingColorChange(c)} className={cn('w-5 h-5 rounded-full border-2 transition-smooth', drawingColor === c ? 'border-primary scale-110' : 'border-transparent hover:scale-110')} style={{ backgroundColor: c }} aria-label={`Couleur ${c}`} />
          ))}
        </div>
        <div className="h-5 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{drawingSize}px</span>
          <input type="range" min={1} max={20} value={drawingSize} onChange={(e) => onDrawingSizeChange(Number(e.target.value))} className="w-20" />
        </div>
        <button onClick={onExitDrawing} className="ml-auto px-3 py-1.5 rounded-lg text-xs bg-muted hover:bg-muted/80 text-muted-foreground">Quitter</button>
      </div>
    );
  }

  // Text contextual toolbar
  if (selectedElement?.element_type === 'text') {
    const props = selectedElement.properties as TextProperties;
    const update = (updates: Record<string, unknown>) => onUpdateElement(selectedElement.id, updates);

    return (
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/80 overflow-x-auto">
        {/* Text presets */}
        <select
          value={props.preset || 'body'}
          onChange={(e) => {
            const preset = TEXT_PRESETS.find((p) => p.id === e.target.value);
            if (preset) {
              update({
                preset: preset.id,
                font_family: preset.font_family,
                font_size: preset.font_size,
                font_weight: preset.font_weight,
                font_style: preset.font_style,
                line_height: preset.line_height,
                letter_spacing: preset.letter_spacing,
              });
            }
          }}
          className="px-2 py-1 rounded-lg border border-border bg-background text-xs min-w-[100px]"
          aria-label="Style de texte"
        >
          {TEXT_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <div className="h-5 w-px bg-border" />

        {/* Font */}
        <select
          value={props.font_family || 'Inter'}
          onChange={(e) => update({ font_family: e.target.value })}
          className="px-2 py-1 rounded-lg border border-border bg-background text-xs min-w-[80px]"
          aria-label="Police"
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        {/* Size */}
        <input
          type="number"
          value={props.font_size || 16}
          onChange={(e) => update({ font_size: Number(e.target.value) })}
          className="w-14 px-2 py-1 rounded-lg border border-border bg-background text-xs text-center"
          min={8}
          max={120}
          aria-label="Taille"
        />

        <div className="h-5 w-px bg-border" />

        {/* Bold / Italic / Underline */}
        <button onClick={() => update({ font_weight: props.font_weight === 'bold' ? 'normal' : 'bold' })} className={cn('p-1.5 rounded-md transition-smooth', props.font_weight === 'bold' ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground')} aria-label="Gras"><Bold className="w-4 h-4" /></button>
        <button onClick={() => update({ font_style: props.font_style === 'italic' ? 'normal' : 'italic' })} className={cn('p-1.5 rounded-md transition-smooth', props.font_style === 'italic' ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground')} aria-label="Italique"><Italic className="w-4 h-4" /></button>
        <button onClick={() => update({ text_decoration: props.text_decoration === 'underline' ? 'none' : 'underline' })} className={cn('p-1.5 rounded-md transition-smooth', props.text_decoration === 'underline' ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground')} aria-label="Souligné"><Underline className="w-4 h-4" /></button>

        <div className="h-5 w-px bg-border" />

        {/* Alignment */}
        <button onClick={() => update({ text_align: 'left' })} className={cn('p-1.5 rounded-md transition-smooth', props.text_align === 'left' ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground')} aria-label="Aligner à gauche"><AlignLeft className="w-4 h-4" /></button>
        <button onClick={() => update({ text_align: 'center' })} className={cn('p-1.5 rounded-md transition-smooth', props.text_align === 'center' ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground')} aria-label="Centrer"><AlignCenter className="w-4 h-4" /></button>
        <button onClick={() => update({ text_align: 'right' })} className={cn('p-1.5 rounded-md transition-smooth', props.text_align === 'right' ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground')} aria-label="Aligner à droite"><AlignRight className="w-4 h-4" /></button>

        <div className="h-5 w-px bg-border" />

        {/* Text color */}
        <label className="flex items-center gap-1 cursor-pointer" aria-label="Couleur du texte">
          <div className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: props.color || '#1a1a1a' }} />
          <input type="color" value={props.color || '#1a1a1a'} onChange={(e) => update({ color: e.target.value })} className="sr-only" />
        </label>

        {/* Background color */}
        <label className="flex items-center gap-1 cursor-pointer" aria-label="Couleur de fond">
          <div className="w-5 h-5 rounded border border-border" style={{ backgroundColor: props.background_color || '#ffffff' }}>
            <span className="block w-full h-full rounded" style={{ background: props.background_color ? undefined : 'repeating-conic-gradient(#ccc 0% 25%, white 0% 50%) 50%/8px 8px' }} />
          </div>
          <input type="color" value={props.background_color || '#ffffff'} onChange={(e) => update({ background_color: e.target.value, background_opacity: 1 })} className="sr-only" />
        </label>

        {/* Background opacity */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">Opacité</span>
          <input type="range" min={0} max={1} step={0.1} value={props.background_opacity ?? 0} onChange={(e) => update({ background_opacity: Number(e.target.value) })} className="w-14" aria-label="Opacité du fond" />
        </div>

        {/* Padding */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">Marge</span>
          <input type="range" min={0} max={40} value={props.padding ?? 8} onChange={(e) => update({ padding: Number(e.target.value) })} className="w-14" aria-label="Marge interne" />
        </div>
      </div>
    );
  }

  // Shape contextual toolbar
  if (selectedElement?.element_type === 'shape') {
    const props = selectedElement.properties as ShapeProperties;
    const update = (updates: Record<string, unknown>) => onUpdateElement(selectedElement.id, updates);

    return (
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/80 overflow-x-auto">
        <span className="text-xs font-medium text-muted-foreground">Forme</span>
        <div className="h-5 w-px bg-border" />

        {/* Fill color */}
        <label className="flex items-center gap-1 cursor-pointer" aria-label="Remplissage">
          <span className="text-[10px] text-muted-foreground">Fond</span>
          <div className="w-5 h-5 rounded border border-border" style={{ backgroundColor: props.fill || '#E8D5C4' }} />
          <input type="color" value={props.fill || '#E8D5C4'} onChange={(e) => update({ fill: e.target.value })} className="sr-only" />
        </label>

        {/* Stroke color */}
        <label className="flex items-center gap-1 cursor-pointer" aria-label="Contour">
          <span className="text-[10px] text-muted-foreground">Contour</span>
          <div className="w-5 h-5 rounded border border-border" style={{ backgroundColor: props.stroke || '#1a1a1a' }} />
          <input type="color" value={props.stroke || '#1a1a1a'} onChange={(e) => update({ stroke: e.target.value })} className="sr-only" />
        </label>

        {/* Stroke width */}
        <div className="flex items-center gap-1">
          <Minus className="w-3 h-3 text-muted-foreground" />
          <input
            type="range"
            min={0}
            max={10}
            value={props.stroke_width ?? 2}
            onChange={(e) => update({ stroke_width: Number(e.target.value) })}
            className="w-16"
            aria-label="Épaisseur du contour"
          />
        </div>

        <div className="h-5 w-px bg-border" />

        {/* Fill type: color or image */}
        <div className="flex items-center gap-0.5">
          <button onClick={() => update({ fill_type: 'color' })} className={cn('px-2 py-1 rounded-lg text-[10px] font-medium transition-smooth', (props.fill_type || 'color') === 'color' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>Couleur</button>
          <button onClick={() => update({ fill_type: 'image' })} className={cn('px-2 py-1 rounded-lg text-[10px] font-medium transition-smooth', props.fill_type === 'image' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>Image</button>
        </div>
        {props.fill_type === 'image' && (
          <label className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted text-[10px] font-medium cursor-pointer hover:bg-muted/80">
            <Image className="w-3 h-3" /> Choisir
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const url = await uploadImage(file, journalId);
                update({ fill_image_url: url, fill_type: 'image' });
              } catch { /* silent */ }
            }} />
          </label>
        )}

        <div className="h-5 w-px bg-border" />

        {/* Rotation */}
        <div className="flex items-center gap-1">
          <RotateCw className="w-3 h-3 text-muted-foreground" />
          <input
            type="number"
            value={Math.round(selectedElement.rotation)}
            onChange={(e) => onUpdateElement(selectedElement.id, { rotation: Number(e.target.value) })}
            className="w-14 px-1.5 py-0.5 rounded border border-border bg-background text-xs text-center"
            aria-label="Rotation"
          />
          <span className="text-[10px] text-muted-foreground">°</span>
        </div>
      </div>
    );
  }

  // Image contextual toolbar
  if (selectedElement?.element_type === 'image') {
    const props = selectedElement.properties as ImageProperties;
    const update = (updates: Record<string, unknown>) => onUpdateElement(selectedElement.id, updates);

    return (
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/80 overflow-x-auto">
        <span className="text-xs font-medium text-muted-foreground">Image</span>
        <div className="h-5 w-px bg-border" />

        {/* Object fit */}
        {(['contain', 'cover', 'fill'] as const).map((fit) => (
          <button
            key={fit}
            onClick={() => update({ object_fit: fit })}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-medium transition-smooth',
              props.object_fit === fit ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {fit === 'contain' ? 'Contain' : fit === 'cover' ? 'Cover' : 'Fill'}
          </button>
        ))}

        <div className="h-5 w-px bg-border" />

        {/* Rotation */}
        <div className="flex items-center gap-1">
          <RotateCw className="w-3 h-3 text-muted-foreground" />
          <input
            type="number"
            value={Math.round(selectedElement.rotation)}
            onChange={(e) => onUpdateElement(selectedElement.id, { rotation: Number(e.target.value) })}
            className="w-14 px-1.5 py-0.5 rounded border border-border bg-background text-xs text-center"
            aria-label="Rotation"
          />
          <span className="text-[10px] text-muted-foreground">°</span>
        </div>

        <div className="h-5 w-px bg-border" />

        {/* Border radius */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">Rayon</span>
          <input
            type="range"
            min={0}
            max={50}
            value={props.border_radius ?? 0}
            onChange={(e) => update({ border_radius: Number(e.target.value) })}
            className="w-16"
            aria-label="Rayon de bordure"
          />
        </div>
      </div>
    );
  }

  // No contextual toolbar needed
  return null;
}

// ===================================================================
// TOOL BUTTON
// ===================================================================
function ToolBtn({ icon: Icon, label, active, onClick }: { icon: React.ElementType; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn('flex flex-col items-center gap-0.5 p-1.5 rounded-xl text-xs transition-smooth', active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')} title={label} aria-label={label}>
      <Icon className="w-5 h-5" />
      <span className="text-[9px] font-medium leading-none">{label}</span>
    </button>
  );
}
