'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Trash2, Copy, ZoomIn, ZoomOut, Maximize,
  Type, Square, Smile, Image, Pen, Undo2, Redo2,
  Check, Loader2, MoreVertical, Grid3X3, Move, Layers,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getJournal, getJournalPages, getPageElements,
  createElement, deleteElement, deleteElements,
  batchPersistElements, createJournalPage, deleteJournalPage,
  reindexJournalPages, uploadJournalImage,
} from '@/lib/journal-studio/supabase';
import type {
  Journal, JournalPage, JournalElement, ElementType,
  TextProperties,
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
const MAX_HISTORY = 80;
const AUTOSAVE_DEBOUNCE = 2000;

type Tool = 'select' | 'text' | 'shape' | 'sticker' | 'image' | 'drawing';

interface LocalChange {
  type: 'create' | 'update' | 'delete';
  elementId: string;
  before?: JournalElement;
  after?: JournalElement;
}

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

  // ---- Undo/Redo (operation log) ----
  const [undoStack, setUndoStack] = useState<JournalElement[][]>([]);
  const [redoStack, setRedoStack] = useState<JournalElement[][]>([]);

  // ---- Dirty tracking & autosave ----
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  // ---- Clipboard ----
  const clipboardRef = useRef<JournalElement | null>(null);

  const currentPage = pages[currentPageIndex] || null;
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
      setDirty(false);
      setSaveStatus('idle');
    } catch { /* silent */ }
  }, [pages]);

  useEffect(() => {
    loadPage(currentPageIndex);
  }, [currentPageIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===================================================================
  // AUTOSAVE — batch persist dirty elements to Supabase
  // ===================================================================
  const persistToServer = useCallback(async () => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    setDirty(false);
    setSaveStatus('saving');

    try {
      const els = elementsRef.current;
      // For now: upsert all elements of the current page
      // In production we'd track which specific elements changed
      if (currentPage) {
        const updates = els
          .filter((el) => el.id && !el.id.startsWith('local-'))
          .map((el) => ({
            id: el.id,
            updates: {
              x: el.x,
              y: el.y,
              width: el.width,
              height: el.height,
              rotation: el.rotation,
              z_index: el.z_index,
              opacity: el.opacity,
              properties: el.properties as unknown as Record<string, unknown>,
            },
          }));

        await batchPersistElements(updates, { page_id: '', elements: [] }, []);
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      dirtyRef.current = true;
      setDirty(true);
    }
  }, [currentPage]);

  // Debounced autosave
  useEffect(() => {
    if (!dirty) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(persistToServer, AUTOSAVE_DEBOUNCE);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [dirty, persistToServer]);

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
      setDirty(true);
      return prev.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const snapshot = prev[prev.length - 1];
      setUndoStack((u) => [...u, elementsRef.current]);
      setElements(snapshot);
      setDirty(true);
      return prev.slice(0, -1);
    });
  }, []);

  // ===================================================================
  // ELEMENT OPERATIONS (all local-first)
  // ===================================================================
  const addElement = useCallback(
    async (type: ElementType, properties: Record<string, unknown>, x?: number, y?: number) => {
      if (!currentPage) return;

      // Create server-side to get a real ID
      try {
        const newEl = await createElement({
          page_id: currentPage.id,
          element_type: type,
          x: x ?? 100,
          y: y ?? 100,
          width: type === 'text' ? 200 : type === 'sticker' ? 80 : 120,
          height: type === 'text' ? 100 : type === 'sticker' ? 80 : 120,
          z_index: elements.length,
          properties,
        });

        pushUndo(elements);
        const newElements = [...elements, newEl];
        setElements(newElements);
        setSelectedId(newEl.id);
        setActiveTool('select');
      } catch { /* silent */ }
    },
    [currentPage, elements, pushUndo]
  );

  // Local update during drag/resize/rotate — NO network
  const handleUpdateLocal = useCallback((id: string, overrides: Partial<JournalElement>) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...overrides } : el))
    );
    setDirty(true);
  }, []);

  // Persist after drag ends
  const handleDragEnd = useCallback((_id: string, x: number, y: number) => {
    // Already in local state via handleUpdateLocal, just mark dirty
    setDirty(true);
  }, []);

  // Persist after resize ends
  const handleResizeEnd = useCallback((_id: string, w: number, h: number) => {
    setDirty(true);
  }, []);

  // Persist after rotate ends
  const handleRotateEnd = useCallback((_id: string, _r: number) => {
    setDirty(true);
  }, []);

  // Delete
  const handleDeleteElement = useCallback(async (id: string) => {
    pushUndo(elements);
    const removed = elements.find((e) => e.id === id);
    setElements((prev) => prev.filter((e) => e.id !== id));
    setSelectedId(null);
    setDirty(true);
    // Fire-and-forget server delete
    deleteElement(id).catch(() => {});
  }, [elements, pushUndo]);

  // ===================================================================
  // COPY / PASTE / DUPLICATE
  // ===================================================================
  const handleCopy = useCallback(() => {
    if (!selectedId) return;
    const el = elements.find((e) => e.id === selectedId);
    if (el) clipboardRef.current = { ...el };
  }, [elements, selectedId]);

  const handlePaste = useCallback(async () => {
    const src = clipboardRef.current;
    if (!src || !currentPage) return;

    try {
      const newEl = await createElement({
        page_id: currentPage.id,
        element_type: src.element_type,
        x: src.x + 20,
        y: src.y + 20,
        width: src.width,
        height: src.height,
        rotation: src.rotation,
        z_index: elements.length,
        opacity: src.opacity,
        properties: src.properties as unknown as Record<string, unknown>,
      });
      pushUndo(elements);
      setElements((prev) => [...prev, newEl]);
      setSelectedId(newEl.id);
      setDirty(true);
    } catch { /* silent */ }
  }, [currentPage, elements, pushUndo]);

  const handleDuplicate = useCallback(async () => {
    handleCopy();
    await handlePaste();
  }, [handleCopy, handlePaste]);

  // ===================================================================
  // CANVAS CLICK — tool actions
  // ===================================================================
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target !== canvasRef.current && !target.classList.contains('canvas-bg')) return;

      if (activeTool === 'text') {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = (e.clientX - rect.left - (rect.width - PAGE_W * zoom) / 2) / zoom;
        const y = (e.clientY - rect.top - (rect.height - PAGE_H * zoom) / 2) / zoom;
        addElement('text', DEFAULT_TEXT_PROPERTIES as unknown as Record<string, unknown>, x, y);
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
          if (!file || !currentPage || !journal) return;
          try {
            const url = await uploadJournalImage(file, journal.id);
            addElement('image', { url, alt: file.name, object_fit: 'cover' });
          } catch { /* silent */ }
        };
        input.click();
      } else {
        setSelectedId(null);
      }
    },
    [activeTool, zoom, addElement, currentPage, journal]
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
    if (!journal) return;
    try {
      const newPage = await createJournalPage(journal.id, pages.length + 1, journal.paper_style);
      setPages((prev) => [...prev, newPage]);
      setCurrentPageIndex(pages.length);
    } catch { /* silent */ }
  }, [journal, pages]);

  const handleDeletePage = useCallback(async () => {
    if (!currentPage || pages.length <= 1) return;
    if (!window.confirm('Supprimer cette page ?')) return;
    try {
      await deleteJournalPage(currentPage.id);
      const newPages = pages.filter((p) => p.id !== currentPage.id);
      setPages(newPages);
      // Reindex
      const jId = currentPage.journal_id;
      reindexJournalPages(jId).catch(() => {});
      setCurrentPageIndex((prev) => Math.max(0, prev - 1));
    } catch { /* silent */ }
  }, [currentPage, pages]);

  // ===================================================================
  // DRAWING — inline on canvas, coordinates relative to page
  // ===================================================================
  const handleDrawPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDrawing(true);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - (rect.width - PAGE_W * zoom) / 2) / zoom;
    const y = (e.clientY - rect.top - (rect.height - PAGE_H * zoom) / 2) / zoom;
    setDrawingPoints([[x, y, e.pressure || 0.5]]);
  }, [zoom]);

  const handleDrawPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawing) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - (rect.width - PAGE_W * zoom) / 2) / zoom;
    const y = (e.clientY - rect.top - (rect.height - PAGE_H * zoom) / 2) / zoom;
    setDrawingPoints((prev) => [...prev, [x, y, e.pressure || 0.5]]);
  }, [isDrawing, zoom]);

  const finishDrawing = useCallback(async () => {
    setIsDrawing(false);
    if (drawingPoints.length < 2) { setDrawingPoints([]); return; }
    if (!currentPage) { setDrawingPoints([]); return; }

    await addElement('drawing', {
      points: drawingPoints,
      stroke_color: drawingTool === 'eraser' ? '#ffffff' : drawingColor,
      stroke_width: drawingTool === 'eraser' ? drawingSize * 3 : drawingSize,
      opacity: drawingTool === 'highlighter' ? 0.4 : 1,
      tool: drawingTool,
    });
    setDrawingPoints([]);
  }, [drawingPoints, currentPage, addElement, drawingColor, drawingSize, drawingTool]);

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
          {dirty && saveStatus === 'idle' && <span className="text-xs text-muted-foreground">Modifié</span>}

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
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute right-0 top-full mt-1 z-50 w-52 rounded-xl border border-border bg-card shadow-lg p-1">
                    <button onClick={() => { setShowThumbnails(!showThumbnails); setShowMoreMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted"><Grid3X3 className="w-4 h-4" />Miniatures</button>
                    <button onClick={() => { handleAddPage(); setShowMoreMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted"><Plus className="w-4 h-4" />Ajouter une page</button>
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
              <PageThumbnails pages={pages} currentPageIndex={currentPageIndex} elements={elements} onSelectPage={setCurrentPageIndex} onAddPage={handleAddPage} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Canvas area */}
        <div
          className="flex-1 overflow-auto bg-muted/30 relative"
          style={{ touchAction: activeTool === 'drawing' ? 'none' : undefined }}
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
                />
              ))}

              {/* Live drawing preview */}
              {isDrawing && drawingPoints.length >= 2 && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}>
                  <path
                    d={drawingPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')}
                    fill="none"
                    stroke={drawingTool === 'eraser' ? '#ffffff' : drawingColor}
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
            <button onClick={() => { setActiveTool('select'); setDrawingPoints([]); setIsDrawing(false); }} className="mt-auto px-3 py-2 rounded-lg text-sm bg-muted hover:bg-muted/80">Quitter le dessin</button>
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
              // Trigger image upload
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/png,image/jpeg,image/webp';
              input.onchange = async (ev) => {
                const file = (ev.target as HTMLInputElement).files?.[0];
                if (!file || !currentPage || !journal) return;
                try {
                  const url = await uploadJournalImage(file, journal.id);
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
