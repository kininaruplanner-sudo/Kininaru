'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Trash2, Copy, ZoomIn, ZoomOut, Maximize,
  Type, Square, Smile, Image, Pen, Undo2, Redo2,
  Check, Loader2, MoreVertical, Grid3X3, Move, Layers,
  AlertTriangle, CopyPlus, GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getJournal, getJournalPages, getPageElements,
  createElement, deleteElement,
  batchPersistElements, createJournalPage, deleteJournalPage,
  duplicateJournalPage, reindexJournalPages, uploadJournalImage,
} from '@/lib/journal-studio/supabase';
import type {
  Journal, JournalPage, JournalElement, ElementType,
  TextProperties, DrawingProperties,
} from '@/lib/journal-studio/types';
import {
  DEFAULT_TEXT_PROPERTIES, DEFAULT_SHAPE_PROPERTIES, PAPER_PATTERNS,
} from '@/lib/journal-studio/types';
import { StickerPicker } from './sticker-picker';
import { ShapePicker } from './shape-picker';
import { ElementRenderer } from './element-renderer';
import { PageThumbnails } from './page-thumbnails';

// ---- Constants ----
const PAGE_W = 595;
const PAGE_H = 842;
const MAX_HISTORY = 60;
const AUTOSAVE_DEBOUNCE = 2500;
const MAX_DRAWING_POINTS = 600;

type Tool = 'select' | 'text' | 'shape' | 'sticker' | 'image' | 'drawing';

export function JournalEditor({ journalId, onBack }: { journalId: string; onBack: () => void }) {
  // ---- Data ----
  const [journal, setJournal] = useState<Journal | null>(null);
  const [pages, setPages] = useState<JournalPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [elements, setElements] = useState<JournalElement[]>([]);

  // ---- UI State ----
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [zoom, setZoom] = useState(1);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // ---- Drawing ----
  const [drawingPoints, setDrawingPoints] = useState<[number, number, number][]>([]);
  const [drawingColor, setDrawingColor] = useState('#1a1a1a');
  const [drawingSize, setDrawingSize] = useState(3);
  const [drawingTool, setDrawingTool] = useState<'pen' | 'pencil' | 'highlighter' | 'eraser'>('pen');
  const [isDrawing, setIsDrawing] = useState(false);

  // ---- Pickers ----
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showShapePicker, setShowShapePicker] = useState(false);

  // ---- Undo/Redo ----
  const [undoStack, setUndoStack] = useState<JournalElement[][]>([]);
  const [redoStack, setRedoStack] = useState<JournalElement[][]>([]);

  // ---- Dirty tracking & autosave ----
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'offline'>('idle');
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const currentPageRef = useRef<JournalPage | null>(null);

  // ---- Clipboard ----
  const clipboardRef = useRef<JournalElement | null>(null);

  const currentPage = pages[currentPageIndex] || null;
  currentPageRef.current = currentPage;
  const canvasRef = useRef<HTMLDivElement>(null);

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
          setUndoStack([]);
          setRedoStack([]);
        }
      } catch {
        if (!cancelled) onBack();
      }
    })();
    return () => { cancelled = true; };
  }, [journalId, onBack]);

  // Load elements on page change
  const loadPage = useCallback(async (idx: number) => {
    if (!pages[idx]) return;
    try {
      const els = await getPageElements(pages[idx].id);
      setElements(els);
      setSelectedId(null);
      setUndoStack([]);
      setRedoStack([]);
      dirtyRef.current = false;
      setSaveStatus('idle');
    } catch { /* silent */ }
  }, [pages]);

  useEffect(() => {
    loadPage(currentPageIndex);
  }, [currentPageIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===================================================================
  // AUTOSAVE — real batch persist
  // ===================================================================
  const persistToServer = useCallback(async () => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    setSaveStatus('saving');

    try {
      const els = elementsRef.current;
      const page = currentPageRef.current;
      if (!page) { setSaveStatus('error'); return; }

      // Build updates for existing elements (server-created IDs)
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

      // Real batch persist with actual data
      if (updates.length > 0) {
        await batchPersistElements(
          updates,
          { page_id: page.id, elements: [] },
          []
        );
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('[Journal] autosave failed:', err);
      if (!navigator.onLine) {
        setSaveStatus('offline');
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
  }, [elements, persistToServer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark dirty whenever elements change
  const markDirty = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  // ===================================================================
  // HISTORY (undo/redo via element snapshots)
  // ===================================================================
  const pushUndo = useCallback((snapshot: JournalElement[]) => {
    setUndoStack((prev) => {
      const next = [...prev, snapshot];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const snapshot = prev[prev.length - 1];
      setRedoStack((r) => [...r, elementsRef.current]);
      setElements(snapshot);
      markDirty();
      return prev.slice(0, -1);
    });
  }, [markDirty]);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const snapshot = prev[prev.length - 1];
      setUndoStack((u) => [...u, elementsRef.current]);
      setElements(snapshot);
      markDirty();
      return prev.slice(0, -1);
    });
  }, [markDirty]);

  // ===================================================================
  // ELEMENT OPERATIONS (all local-first)
  // ===================================================================
  const addElement = useCallback(
    async (type: ElementType, properties: Record<string, unknown>, x?: number, y?: number) => {
      const page = currentPageRef.current;
      if (!page) return;

      try {
        const newEl = await createElement({
          page_id: page.id,
          element_type: type,
          x: x ?? 100,
          y: y ?? 100,
          width: type === 'text' ? 200 : type === 'sticker' ? 80 : 120,
          height: type === 'text' ? 100 : type === 'sticker' ? 80 : 120,
          z_index: elementsRef.current.length,
          properties,
        });

        pushUndo(elementsRef.current);
        setElements((prev) => [...prev, newEl]);
        setSelectedId(newEl.id);
        setActiveTool('select');
        markDirty();
      } catch (err) {
        console.error('[Journal] createElement failed:', err);
      }
    },
    [pushUndo, markDirty]
  );

  // Local update during drag/resize/rotate — NO network
  const handleUpdateLocal = useCallback((id: string, overrides: Partial<JournalElement>) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...overrides } : el))
    );
    markDirty();
  }, [markDirty]);

  // Persist after drag ends
  const handleDragEnd = useCallback((_id: string, _x: number, _y: number) => {
    markDirty();
  }, [markDirty]);

  // Persist after resize ends
  const handleResizeEnd = useCallback((_id: string, _w: number, _h: number) => {
    markDirty();
  }, [markDirty]);

  // Persist after rotate ends
  const handleRotateEnd = useCallback((_id: string, _r: number) => {
    markDirty();
  }, [markDirty]);

  // Delete
  const handleDeleteElement = useCallback((id: string) => {
    pushUndo(elementsRef.current);
    setElements((prev) => prev.filter((e) => e.id !== id));
    setSelectedId(null);
    markDirty();
    // Server delete (fire-and-forget)
    deleteElement(id).catch(() => {});
  }, [pushUndo, markDirty]);

  // ===================================================================
  // COPY / PASTE / DUPLICATE
  // ===================================================================
  const handleCopy = useCallback(() => {
    if (!selectedId) return;
    const el = elements.find((e) => e.id === selectedId);
    if (el) clipboardRef.current = JSON.parse(JSON.stringify(el)); // deep clone
  }, [elements, selectedId]);

  const handlePaste = useCallback(async () => {
    const src = clipboardRef.current;
    const page = currentPageRef.current;
    if (!src || !page) return;

    try {
      const newEl = await createElement({
        page_id: page.id,
        element_type: src.element_type,
        x: src.x + 20,
        y: src.y + 20,
        width: src.width,
        height: src.height,
        rotation: src.rotation,
        z_index: elementsRef.current.length,
        opacity: src.opacity,
        properties: JSON.parse(JSON.stringify(src.properties)) as Record<string, unknown>,
      });
      pushUndo(elementsRef.current);
      setElements((prev) => [...prev, newEl]);
      setSelectedId(newEl.id);
      markDirty();
    } catch (err) {
      console.error('[Journal] paste failed:', err);
    }
  }, [pushUndo, markDirty]);

  const handleDuplicate = useCallback(async () => {
    handleCopy();
    await handlePaste();
  }, [handleCopy, handlePaste]);

  // ===================================================================
  // CANVAS CLICK — coordinate conversion accounting for flex centering
  // ===================================================================
  const screenToPage = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    // Account for flex centering offset within the scrollable container
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
            console.error('[Journal] image upload failed:', err);
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
  }, [selectedId, handleDeleteElement, handleUndo, handleRedo, handleCopy, handlePaste, handleDuplicate]);

  // ===================================================================
  // PAGE OPERATIONS
  // ===================================================================
  const handleAddPage = useCallback(async () => {
    const j = journal;
    if (!j) return;
    try {
      const newPage = await createJournalPage(j.id, pages.length + 1, j.paper_style);
      setPages((prev) => [...prev, newPage]);
      setCurrentPageIndex(pages.length);
    } catch (err) {
      console.error('[Journal] addPage failed:', err);
    }
  }, [journal, pages]);

  const handleDuplicatePage = useCallback(async () => {
    const page = currentPageRef.current;
    if (!page) return;
    try {
      const dup = await duplicateJournalPage(page.id, pages.length + 1);
      setPages((prev) => [...prev, dup]);
      setCurrentPageIndex(pages.length);
    } catch (err) {
      console.error('[Journal] duplicatePage failed:', err);
    }
  }, [pages.length]);

  const handleDeletePage = useCallback(async () => {
    const page = currentPageRef.current;
    if (!page || pages.length <= 1) return;
    if (!window.confirm('Supprimer cette page ?')) return;
    try {
      await deleteJournalPage(page.id);
      const newPages = pages.filter((p) => p.id !== page.id);
      setPages(newPages);
      reindexJournalPages(page.journal_id).catch(() => {});
      setCurrentPageIndex((prev) => Math.max(0, Math.min(prev, newPages.length - 1)));
    } catch (err) {
      console.error('[Journal] deletePage failed:', err);
    }
  }, [pages]);

  const handleMovePage = useCallback(async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= pages.length) return;
    const newPages = [...pages];
    const [moved] = newPages.splice(fromIndex, 1);
    newPages.splice(toIndex, 0, moved);
    setPages(newPages);
    if (currentPageIndex === fromIndex) {
      setCurrentPageIndex(toIndex);
    } else if (fromIndex < currentPageIndex && toIndex >= currentPageIndex) {
      setCurrentPageIndex((prev) => prev - 1);
    } else if (fromIndex > currentPageIndex && toIndex <= currentPageIndex) {
      setCurrentPageIndex((prev) => prev + 1);
    }
    // Persist new order
    try {
      for (let i = 0; i < newPages.length; i++) {
        if (newPages[i].page_number !== i + 1) {
          const { createClient } = await import('@/lib/supabase/client');
          const supabase = createClient();
          await supabase.from('journal_pages').update({ page_number: i + 1 }).eq('id', newPages[i].id);
        }
      }
    } catch { /* silent */ }
  }, [pages, currentPageIndex]);

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

    // Capture pointer to avoid lost events
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }, [screenToPage]);

  const handleDrawPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    // Throttle: only add point every ~4ms
    const pos = screenToPage(e.clientX, e.clientY);
    if (!pos) return;
    const pts = drawingPointsRef.current;
    const last = pts[pts.length - 1];
    if (last) {
      const dx = pos.x - last[0];
      const dy = pos.y - last[1];
      if (dx * dx + dy * dy < 4) return; // skip tiny moves
    }
    const point: [number, number, number] = [pos.x, pos.y, e.pressure || 0.5];

    // Limit total points for performance
    if (pts.length >= MAX_DRAWING_POINTS) {
      // Simplify: keep every other point
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

  const finishDrawing = useCallback(async () => {
    drawingRef.current = false;
    setIsDrawing(false);
    const pts = drawingPointsRef.current;
    drawingPointsRef.current = [];

    if (pts.length < 2) { setDrawingPoints([]); return; }

    // Build drawing properties
    const isEraser = drawingTool === 'eraser';
    const drawingProps = {
      points: pts,
      stroke_color: isEraser ? '#ffffff' : drawingColor,
      stroke_width: isEraser ? drawingSize * 3 : drawingSize,
      opacity: drawingTool === 'highlighter' ? 0.4 : 1,
      tool: drawingTool,
    };

    setDrawingPoints([]);
    await addElement('drawing', drawingProps);
  }, [drawingPoints, drawingColor, drawingSize, drawingTool, addElement]);

  // ===================================================================
  // RENDER
  // ===================================================================
  if (!journal) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const paperBg = PAPER_PATTERNS[currentPage?.paper_style as keyof typeof PAPER_PATTERNS] ?? '';

  return (
    <div className="flex flex-col h-full select-none">
      {/* ---- HEADER ---- */}
      <div className="flex items-center justify-between p-2 sm:p-3 border-b border-border bg-card">
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" aria-label="Retour">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-foreground truncate max-w-[150px] sm:max-w-[300px]">{journal.title}</h1>
            <p className="text-xs text-muted-foreground">Page {currentPageIndex + 1} / {pages.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Save status */}
          {saveStatus === 'saving' && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /><span className="hidden sm:inline">Enregistrement…</span></span>}
          {saveStatus === 'saved' && <span className="flex items-center gap-1 text-xs text-kin-sage"><Check className="w-3 h-3" /><span className="hidden sm:inline">Enregistré</span></span>}
          {saveStatus === 'error' && <span className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="w-3 h-3" />Erreur</span>}
          {saveStatus === 'offline' && <span className="text-xs text-muted-foreground">Hors ligne</span>}

          {/* Undo/Redo */}
          <div className="hidden sm:flex items-center gap-0.5 p-0.5 rounded-lg bg-muted">
            <button onClick={handleUndo} disabled={undoStack.length === 0} className="p-1.5 rounded-md hover:bg-background disabled:opacity-40" aria-label="Annuler"><Undo2 className="w-4 h-4" /></button>
            <button onClick={handleRedo} disabled={redoStack.length === 0} className="p-1.5 rounded-md hover:bg-background disabled:opacity-40" aria-label="Rétablir"><Redo2 className="w-4 h-4" /></button>
          </div>

          {/* Zoom */}
          <div className="hidden sm:flex items-center gap-0.5 p-0.5 rounded-lg bg-muted">
            <button onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))} className="p-1.5 rounded-md hover:bg-background" aria-label="Zoom arrière"><ZoomOut className="w-4 h-4" /></button>
            <span className="text-xs text-muted-foreground min-w-[36px] text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(3, z + 0.1))} className="p-1.5 rounded-md hover:bg-background" aria-label="Zoom avant"><ZoomIn className="w-4 h-4" /></button>
            <button onClick={() => setZoom(1)} className="p-1.5 rounded-md hover:bg-background" aria-label="Taille réelle"><Maximize className="w-4 h-4" /></button>
          </div>

          {/* More */}
          <div className="relative">
            <button onClick={() => setShowMoreMenu(!showMoreMenu)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" aria-label="Plus d'options"><MoreVertical className="w-5 h-5" /></button>
            <AnimatePresence>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-border bg-card shadow-lg p-1">
                    <button onClick={() => { setShowThumbnails(!showThumbnails); setShowMoreMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted"><Grid3X3 className="w-4 h-4" />Miniatures</button>
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
      </div>

      {/* ---- MAIN ---- */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop toolbar */}
        <div className="hidden md:flex flex-col w-14 border-r border-border bg-card p-1.5 gap-0.5">
          <ToolBtn icon={Move} label="Sélect." active={activeTool === 'select'} onClick={() => setActiveTool('select')} />
          <ToolBtn icon={Type} label="Texte" active={activeTool === 'text'} onClick={() => setActiveTool('text')} />
          <ToolBtn icon={Square} label="Forme" active={activeTool === 'shape'} onClick={() => setActiveTool('shape')} />
          <ToolBtn icon={Smile} label="Sticker" active={activeTool === 'sticker'} onClick={() => setActiveTool('sticker')} />
          <ToolBtn icon={Image} label="Image" active={activeTool === 'image'} onClick={() => setActiveTool('image')} />
          <ToolBtn icon={Pen} label="Dessin" active={activeTool === 'drawing'} onClick={() => setActiveTool(activeTool === 'drawing' ? 'select' : 'drawing')} />
          <div className="flex-1" />
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
                onSelectPage={setCurrentPageIndex}
                onAddPage={handleAddPage}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Canvas area */}
        <div
          className="flex-1 overflow-auto bg-muted/30 relative"
          style={{ touchAction: activeTool === 'drawing' ? 'none' : 'auto' }}
          onPointerDown={activeTool === 'drawing' ? handleDrawPointerDown : undefined}
          onPointerMove={activeTool === 'drawing' ? handleDrawPointerMove : undefined}
          onPointerUp={activeTool === 'drawing' ? finishDrawing : undefined}
        >
          <div className="flex items-center justify-center min-h-full p-4 sm:p-8">
            <div
              ref={canvasRef}
              className="relative bg-white shadow-lg rounded-lg overflow-hidden"
              style={{
                width: PAGE_W,
                height: PAGE_H,
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                backgroundImage: paperBg || undefined,
                backgroundSize: currentPage?.paper_style === 'grid' ? '20px 20px, 20px 20px' : undefined,
                backgroundColor: currentPage?.background_color ?? undefined,
              }}
              onClick={handleCanvasClick}
            >
              {/* Rendered elements */}
              {elements.map((el) => (
                <ElementRenderer
                  key={el.id}
                  element={el}
                  isSelected={selectedId === el.id}
                  zoom={zoom}
                  onSelect={() => setSelectedId(el.id)}
                  onDragStart={() => {}}
                  onDragEnd={handleDragEnd}
                  onResizeStart={() => {}}
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
          </div>
        </div>

        {/* Drawing toolbar (when drawing mode active) */}
        {activeTool === 'drawing' && (
          <div className="hidden md:flex flex-col w-48 border-l border-border bg-card p-3 gap-3">
            <p className="text-xs font-semibold text-muted-foreground">Outils de dessin</p>
            {(['pen', 'pencil', 'highlighter', 'eraser'] as const).map((t) => (
              <button key={t} onClick={() => setDrawingTool(t)} className={cn('px-3 py-2 rounded-lg text-sm text-left transition-smooth', drawingTool === t ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                {t === 'pen' ? '✏️ Stylo' : t === 'pencil' ? '🖊️ Crayon' : t === 'highlighter' ? '🖍️ Surligneur' : '🧹 Gomme'}
              </button>
            ))}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Couleur</p>
              <input type="color" value={drawingColor} onChange={(e) => setDrawingColor(e.target.value)} className="w-full h-8 rounded-lg cursor-pointer" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Taille: {drawingSize}px</p>
              <input type="range" min={1} max={20} value={drawingSize} onChange={(e) => setDrawingSize(Number(e.target.value))} className="w-full" />
            </div>
            <button onClick={() => { setActiveTool('select'); setDrawingPoints([]); drawingRef.current = false; setIsDrawing(false); }} className="mt-auto px-3 py-2 rounded-lg text-sm bg-muted hover:bg-muted/80">Quitter le dessin</button>
          </div>
        )}
      </div>

      {/* ---- MOBILE BOTTOM BAR ---- */}
      <div className="md:hidden flex items-center justify-between px-2 py-1.5 border-t border-border bg-card">
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {([
            { tool: 'select' as Tool, icon: Move },
            { tool: 'text' as Tool, icon: Type },
            { tool: 'shape' as Tool, icon: Square },
            { tool: 'sticker' as Tool, icon: Smile },
            { tool: 'image' as Tool, icon: Image },
            { tool: 'drawing' as Tool, icon: Pen },
          ]).map(({ tool, icon: Icon }) => (
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
            }} className={cn('p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center', activeTool === tool ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              <Icon className="w-5 h-5" />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleUndo} disabled={undoStack.length === 0} className="p-2 rounded-lg hover:bg-muted disabled:opacity-40"><Undo2 className="w-4 h-4" /></button>
          <button onClick={handleRedo} disabled={redoStack.length === 0} className="p-2 rounded-lg hover:bg-muted disabled:opacity-40"><Redo2 className="w-4 h-4" /></button>
        </div>
      </div>

      {/* ---- PICKERS ---- */}
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

// ---- Small toolbar button ----
function ToolBtn({ icon: Icon, label, active, onClick }: { icon: React.ElementType; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn('flex flex-col items-center gap-0.5 p-1.5 rounded-xl text-xs transition-smooth', active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')} title={label} aria-label={label}>
      <Icon className="w-5 h-5" />
      <span className="text-[9px] font-medium leading-none">{label}</span>
    </button>
  );
}
