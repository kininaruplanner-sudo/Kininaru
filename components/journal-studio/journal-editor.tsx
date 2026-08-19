'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Copy,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize,
  Type,
  Square,
  Smile,
  Image,
  Pen,
  Undo2,
  Redo2,
  Save,
  Check,
  Loader2,
  MoreVertical,
  Grid3X3,
  Move,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  getJournal,
  getJournalPages,
  getPageElements,
  createElement,
  updateElement,
  deleteElement,
  createJournalPage,
  deleteJournalPage,
} from '@/lib/journal-studio/supabase';
import type {
  Journal,
  JournalPage,
  JournalElement,
  ElementType,
  TextProperties,
  ShapeProperties,
  StickerProperties,
  DrawingProperties,
} from '@/lib/journal-studio/types';
import {
  DEFAULT_TEXT_PROPERTIES,
  DEFAULT_SHAPE_PROPERTIES,
  DEFAULT_STICKER_PROPERTIES,
} from '@/lib/journal-studio/types';
import { StickerPicker } from './sticker-picker';
import { ShapePicker } from './shape-picker';
import { ColorPicker } from './color-picker';
import { ElementRenderer } from './element-renderer';
import { DrawingCanvas } from './drawing-canvas';
import { TextEditor } from './text-editor';
import { PageThumbnails } from './page-thumbnails';

interface JournalEditorProps {
  journalId: string;
  onBack: () => void;
}

type Tool = 'select' | 'text' | 'shape' | 'sticker' | 'image' | 'drawing';

export function JournalEditor({ journalId, onBack }: JournalEditorProps) {
  const [journal, setJournal] = useState<Journal | null>(null);
  const [pages, setPages] = useState<JournalPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [elements, setElements] = useState<JournalElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<JournalElement | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [zoom, setZoom] = useState(1);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingColor, setDrawingColor] = useState('#1a1a1a');
  const [drawingSize, setDrawingSize] = useState(3);

  // Pickers
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showShapePicker, setShowShapePicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Save state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // History for undo/redo
  const [history, setHistory] = useState<JournalElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const canvasRef = useRef<HTMLDivElement>(null);

  const currentPage = pages[currentPageIndex] || null;

  // Load journal data
  useEffect(() => {
    const loadJournal = async () => {
      try {
        const journalData = await getJournal(journalId);
        if (!journalData) {
          onBack();
          return;
        }
        setJournal(journalData);

        const pagesData = await getJournalPages(journalId);
        setPages(pagesData);

        if (pagesData.length > 0) {
          const elementsData = await getPageElements(pagesData[0].id);
          setElements(elementsData);
          setHistory([elementsData]);
          setHistoryIndex(0);
        }
      } catch (err) {
        console.error('Failed to load journal:', err);
      }
    };

    loadJournal();
  }, [journalId, onBack]);

  // Load elements when page changes
  const loadPageElements = useCallback(async (pageIndex: number) => {
    if (pages[pageIndex]) {
      try {
        const elementsData = await getPageElements(pages[pageIndex].id);
        setElements(elementsData);
        setSelectedElement(null);
        setHistory([elementsData]);
        setHistoryIndex(0);
      } catch (err) {
        console.error('Failed to load elements:', err);
      }
    }
  }, [pages]);

  useEffect(() => {
    loadPageElements(currentPageIndex);
  }, [currentPageIndex, loadPageElements]);

  // Auto-save
  const saveElements = useCallback(async () => {
    if (!currentPage) return;

    setSaveStatus('saving');
    try {
      // Save would batch update elements - simplified for now
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to save:', err);
      setSaveStatus('error');
    }
  }, [currentPage]);

  // Debounced auto-save
  useEffect(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      if (elements.length > 0) {
        saveElements();
      }
    }, 2000);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [elements, saveElements]);

  // Add to history
  const addToHistory = useCallback((newElements: JournalElement[]) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newElements);
      return newHistory;
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1);
      setElements(history[historyIndex - 1]);
      setSelectedElement(null);
    }
  }, [history, historyIndex]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((prev) => prev + 1);
      setElements(history[historyIndex + 1]);
      setSelectedElement(null);
    }
  }, [history, historyIndex]);

  // Add element
  const addElement = useCallback(
    async (type: ElementType, properties: Record<string, unknown>, x?: number, y?: number) => {
      if (!currentPage) return;

      try {
        const newElement = await createElement({
          page_id: currentPage.id,
          element_type: type,
          x: x ?? 100,
          y: y ?? 100,
          width: type === 'text' ? 200 : type === 'sticker' ? 64 : 100,
          height: type === 'text' ? 100 : type === 'sticker' ? 64 : 100,
          z_index: elements.length,
          properties,
        });

        const newElements = [...elements, newElement];
        setElements(newElements);
        addToHistory(newElements);
        setSelectedElement(newElement);
        setActiveTool('select');
      } catch (err) {
        console.error('Failed to add element:', err);
      }
    },
    [currentPage, elements, addToHistory]
  );

  // Update element
  const handleUpdateElement = useCallback(
    async (id: string, updates: Partial<JournalElement>) => {
    try {
      const { properties: propUpdates, ...rest } = updates;
      const supabaseUpdates: Record<string, unknown> = { ...rest };
      if (propUpdates !== undefined) {
        supabaseUpdates.properties = propUpdates;
      }
      await updateElement(id, supabaseUpdates as { x?: number; y?: number; width?: number; height?: number; rotation?: number; z_index?: number; opacity?: number; properties?: Record<string, unknown> });
      const newElements = elements.map((el) =>
        el.id === id ? { ...el, ...updates } : el
      );
      setElements(newElements);
      if (selectedElement?.id === id) {
        setSelectedElement((prev) => (prev ? { ...prev, ...updates } : null));
      }
    } catch (err) {
      console.error('Failed to update element:', err);
    }
    },
    [elements, selectedElement]
  );

  // Delete element
  const handleDeleteElement = useCallback(
    async (id: string) => {
      try {
        await deleteElement(id);
        const newElements = elements.filter((el) => el.id !== id);
        setElements(newElements);
        addToHistory(newElements);
        if (selectedElement?.id === id) {
          setSelectedElement(null);
        }
      } catch (err) {
        console.error('Failed to delete element:', err);
      }
    },
    [elements, selectedElement, addToHistory]
  );

  // Handle canvas click
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-bg')) {
        if (activeTool === 'text') {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            const x = (e.clientX - rect.left) / zoom;
            const y = (e.clientY - rect.top) / zoom;
            addElement('text', DEFAULT_TEXT_PROPERTIES as unknown as Record<string, unknown>, x, y);
          }
        } else if (activeTool === 'shape') {
          setShowShapePicker(true);
        } else if (activeTool === 'sticker') {
          setShowStickerPicker(true);
        } else if (activeTool === 'image') {
          // Handle image upload
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
              // TODO: Upload image and add element
              console.log('Upload image:', file);
            }
          };
          input.click();
        } else {
          setSelectedElement(null);
        }
      }
    },
    [activeTool, zoom, addElement]
  );

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElement && !(e.target as HTMLElement).closest('input, textarea')) {
          handleDeleteElement(selectedElement.id);
        }
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
        }
        if (e.key === 'c' && selectedElement) {
          // Copy element
          console.log('Copy:', selectedElement);
        }
        if (e.key === 'v') {
          // Paste element
          console.log('Paste');
        }
      }
      if (e.key === 'Escape') {
        setSelectedElement(null);
        setActiveTool('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElement, handleDeleteElement, handleUndo, handleRedo]);

  // Add page
  const handleAddPage = useCallback(async () => {
    if (!journal) return;

    try {
      const newPage = await createJournalPage(
        journal.id,
        pages.length + 1,
        journal.paper_style
      );
      setPages((prev) => [...prev, newPage]);
      setCurrentPageIndex(pages.length);
    } catch (err) {
      console.error('Failed to add page:', err);
    }
  }, [journal, pages]);

  // Delete page
  const handleDeletePage = useCallback(async () => {
    if (!currentPage || pages.length <= 1) return;

    if (!window.confirm('Supprimer cette page ?')) return;

    try {
      await deleteJournalPage(currentPage.id);
      setPages((prev) => prev.filter((p) => p.id !== currentPage.id));
      setCurrentPageIndex((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to delete page:', err);
    }
  }, [currentPage, pages]);

  if (!journal) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-smooth"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-foreground line-clamp-1">
              {journal.title}
            </h1>
            <p className="text-xs text-muted-foreground">
              Page {currentPageIndex + 1} / {pages.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Save status */}
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Enregistrement...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1.5 text-xs text-kin-sage">
              <Check className="w-3 h-3" />
              Enregistré
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs text-destructive">Erreur de sauvegarde</span>
          )}

          {/* Undo/Redo */}
          <div className="hidden sm:flex items-center gap-1 p-1 rounded-lg bg-muted">
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-1.5 rounded-md hover:bg-background disabled:opacity-50 transition-smooth"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 rounded-md hover:bg-background disabled:opacity-50 transition-smooth"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Zoom */}
          <div className="hidden sm:flex items-center gap-1 p-1 rounded-lg bg-muted">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
              className="p-1.5 rounded-md hover:bg-background transition-smooth"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-muted-foreground min-w-[40px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
              className="p-1.5 rounded-md hover:bg-background transition-smooth"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="p-1.5 rounded-md hover:bg-background transition-smooth"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>

          {/* More menu */}
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-smooth"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            <AnimatePresence>
              {showMoreMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMoreMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.1 }}
                    className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl border border-border bg-card shadow-lg p-1"
                  >
                    <button
                      onClick={() => {
                        setShowThumbnails(!showThumbnails);
                        setShowMoreMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-smooth"
                    >
                      <Grid3X3 className="w-4 h-4" />
                      Aperçu des pages
                    </button>
                    <button
                      onClick={() => {
                        handleAddPage();
                        setShowMoreMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-smooth"
                    >
                      <Plus className="w-4 h-4" />
                      Ajouter une page
                    </button>
                    {pages.length > 1 && (
                      <button
                        onClick={() => {
                          handleDeletePage();
                          setShowMoreMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-smooth"
                      >
                        <Trash2 className="w-4 h-4" />
                        Supprimer la page
                      </button>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left toolbar (desktop) */}
        <div className="hidden md:flex flex-col w-16 border-r border-border bg-card p-2 gap-1">
          <ToolButton
            icon={Move}
            label="Sélectionner"
            active={activeTool === 'select'}
            onClick={() => setActiveTool('select')}
          />
          <ToolButton
            icon={Type}
            label="Texte"
            active={activeTool === 'text'}
            onClick={() => setActiveTool('text')}
          />
          <ToolButton
            icon={Square}
            label="Forme"
            active={activeTool === 'shape'}
            onClick={() => setActiveTool('shape')}
          />
          <ToolButton
            icon={Smile}
            label="Sticker"
            active={activeTool === 'sticker'}
            onClick={() => setActiveTool('sticker')}
          />
          <ToolButton
            icon={Image}
            label="Image"
            active={activeTool === 'image'}
            onClick={() => setActiveTool('image')}
          />
          <ToolButton
            icon={Pen}
            label="Dessiner"
            active={activeTool === 'drawing'}
            onClick={() => setActiveTool('drawing')}
          />

          <div className="flex-1" />

          <ToolButton
            icon={Layers}
            label="Calques"
            active={showThumbnails}
            onClick={() => setShowThumbnails(!showThumbnails)}
          />
        </div>

        {/* Page thumbnails sidebar */}
        <AnimatePresence>
          {showThumbnails && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 120, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="hidden md:block border-r border-border bg-card overflow-hidden"
            >
              <PageThumbnails
                pages={pages}
                currentPageIndex={currentPageIndex}
                onSelectPage={setCurrentPageIndex}
                onAddPage={handleAddPage}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Canvas area */}
        <div className="flex-1 overflow-auto bg-muted/30 relative">
          {/* Drawing canvas overlay */}
          {activeTool === 'drawing' && currentPage && (
            <DrawingCanvas
              pageId={currentPage.id}
              color={drawingColor}
              size={drawingSize}
              onComplete={(drawing) => {
                addElement('drawing', {
                  points: drawing.points,
                  stroke_color: drawing.color,
                  stroke_width: drawing.size,
                  opacity: 1,
                  tool: 'pen',
                });
                setActiveTool('select');
              }}
              onCancel={() => setActiveTool('select')}
            />
          )}

          {/* Main canvas */}
          <div className="flex items-center justify-center min-h-full p-8">
            <div
              ref={canvasRef}
              className="relative bg-white shadow-lg rounded-lg overflow-hidden cursor-crosshair"
              style={{
                width: 595, // A4 width at 72 DPI
                height: 842, // A4 height at 72 DPI
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                backgroundImage: currentPage?.paper_style === 'lined'
                  ? 'repeating-linear-gradient(transparent, transparent 31px, #e5e5e5 31px, #e5e5e5 32px)'
                  : currentPage?.paper_style === 'dotted'
                  ? 'radial-gradient(circle, #d1d1d1 1px, transparent 1px)'
                  : currentPage?.paper_style === 'grid'
                  ? 'linear-gradient(#e5e5e5 1px, transparent 1px), linear-gradient(90deg, #e5e5e5 1px, transparent 1px)'
                  : undefined,
                backgroundSize: currentPage?.paper_style === 'grid' ? '20px 20px, 20px 20px' : undefined,
                backgroundColor: currentPage?.background_color ?? undefined,
              }}
              onClick={handleCanvasClick}
            >
              {/* Elements */}
              {elements.map((element) => (
                <ElementRenderer
                  key={element.id}
                  element={element}
                  isSelected={selectedElement?.id === element.id}
                  onSelect={() => setSelectedElement(element)}
                  onUpdate={(updates) => handleUpdateElement(element.id, updates)}
                  onDelete={() => handleDeleteElement(element.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right sidebar - element properties */}
        <AnimatePresence>
          {selectedElement && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="hidden lg:block border-l border-border bg-card overflow-hidden"
            >
              <ElementPropertiesPanel
                element={selectedElement}
                onUpdate={(updates) => handleUpdateElement(selectedElement.id, updates)}
                onDelete={() => handleDeleteElement(selectedElement.id)}
                onDuplicate={() => {
                  addElement(
                    selectedElement.element_type,
                    selectedElement.properties as unknown as Record<string, unknown>,
                    selectedElement.x + 20,
                    selectedElement.y + 20
                  );
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile toolbar */}
      <div className="md:hidden flex items-center justify-between p-2 border-t border-border bg-card">
        <div className="flex items-center gap-1 overflow-x-auto">
          <MobileToolButton
            icon={Move}
            active={activeTool === 'select'}
            onClick={() => setActiveTool('select')}
          />
          <MobileToolButton
            icon={Type}
            active={activeTool === 'text'}
            onClick={() => setActiveTool('text')}
          />
          <MobileToolButton
            icon={Square}
            active={activeTool === 'shape'}
            onClick={() => setShowShapePicker(true)}
          />
          <MobileToolButton
            icon={Smile}
            active={activeTool === 'sticker'}
            onClick={() => setShowStickerPicker(true)}
          />
          <MobileToolButton
            icon={Image}
            active={activeTool === 'image'}
            onClick={() => setActiveTool('image')}
          />
          <MobileToolButton
            icon={Pen}
            active={activeTool === 'drawing'}
            onClick={() => setActiveTool('drawing')}
          />
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-2 rounded-lg hover:bg-muted disabled:opacity-50"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-2 rounded-lg hover:bg-muted disabled:opacity-50"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pickers */}
      <AnimatePresence>
        {showStickerPicker && (
          <StickerPicker
            onSelect={(sticker) => {
              addElement('sticker', { sticker_id: sticker.id, category: sticker.category });
              setShowStickerPicker(false);
            }}
            onClose={() => setShowStickerPicker(false)}
          />
        )}
        {showShapePicker && (
          <ShapePicker
            onSelect={(shape) => {
              addElement('shape', { ...DEFAULT_SHAPE_PROPERTIES, shape_type: shape.type });
              setShowShapePicker(false);
            }}
            onClose={() => setShowShapePicker(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------
// Tool Button
// ---------------------------------------------------------------------
interface ToolButtonProps {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}

function ToolButton({ icon: Icon, label, active, onClick }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 p-2 rounded-xl transition-smooth',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
      title={label}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------
// Mobile Tool Button
// ---------------------------------------------------------------------
interface MobileToolButtonProps {
  icon: React.ElementType;
  active: boolean;
  onClick: () => void;
}

function MobileToolButton({ icon: Icon, active, onClick }: MobileToolButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'p-2.5 rounded-xl transition-smooth min-w-[44px] min-h-[44px] flex items-center justify-center',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
      )}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}

// ---------------------------------------------------------------------
// Element Properties Panel
// ---------------------------------------------------------------------
interface ElementPropertiesPanelProps {
  element: JournalElement;
  onUpdate: (updates: Partial<JournalElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function ElementPropertiesPanel({
  element,
  onUpdate,
  onDelete,
  onDuplicate,
}: ElementPropertiesPanelProps) {
  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Propriétés
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onDuplicate}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Dupliquer"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Position */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Position</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">X</label>
            <input
              type="number"
              value={Math.round(element.x)}
              onChange={(e) => onUpdate({ x: Number(e.target.value) })}
              className="w-full px-2 py-1 rounded-lg border border-border bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Y</label>
            <input
              type="number"
              value={Math.round(element.y)}
              onChange={(e) => onUpdate({ y: Number(e.target.value) })}
              className="w-full px-2 py-1 rounded-lg border border-border bg-background text-sm"
            />
          </div>
        </div>
      </div>

      {/* Size */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Taille</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Largeur</label>
            <input
              type="number"
              value={Math.round(element.width)}
              onChange={(e) => onUpdate({ width: Number(e.target.value) })}
              className="w-full px-2 py-1 rounded-lg border border-border bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Hauteur</label>
            <input
              type="number"
              value={Math.round(element.height)}
              onChange={(e) => onUpdate({ height: Number(e.target.value) })}
              className="w-full px-2 py-1 rounded-lg border border-border bg-background text-sm"
            />
          </div>
        </div>
      </div>

      {/* Rotation */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Rotation</p>
        <input
          type="range"
          min={-180}
          max={180}
          value={element.rotation}
          onChange={(e) => onUpdate({ rotation: Number(e.target.value) })}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground text-center">{element.rotation}°</p>
      </div>

      {/* Opacity */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Opacité</p>
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={element.opacity}
          onChange={(e) => onUpdate({ opacity: Number(e.target.value) })}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground text-center">{Math.round(element.opacity * 100)}%</p>
      </div>

      {/* Z-Index */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Ordre</p>
        <div className="flex gap-2">
          <button
            onClick={() => onUpdate({ z_index: element.z_index - 1 })}
            className="flex-1 px-2 py-1 rounded-lg border border-border text-xs hover:bg-muted"
          >
            ↶ Arrière
          </button>
          <button
            onClick={() => onUpdate({ z_index: element.z_index + 1 })}
            className="flex-1 px-2 py-1 rounded-lg border border-border text-xs hover:bg-muted"
          >
            Avant ↷
          </button>
        </div>
      </div>
    </div>
  );
}
