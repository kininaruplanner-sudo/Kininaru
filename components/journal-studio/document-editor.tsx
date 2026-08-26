'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Trash2, Undo2, Redo2,
  Check, Loader2, MoreVertical, Star,
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, CheckSquare, Minus,
  Quote, Heading1, Heading2, Type,
  CloudOff, Cloud, Palette,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getJournal, getJournalPages,
  batchPersistElements, createJournalPage, deleteJournalPage,
} from '@/lib/journal-studio/supabase';
import type { Journal, JournalPage, JournalElement, PaperStyle } from '@/lib/journal-studio/types';
import {
  PAPER_PATTERNS, PAPER_BACKGROUND_COLORS,
} from '@/lib/journal-studio/types';
import type {
  DocumentPageContent, DocumentBlock, BlockType,
} from '@/lib/journal-studio/types';
import {
  createEmptyDocumentPageContent, createDocumentBlock, blockPlainText,
} from '@/lib/journal-studio/types';
import {
  initIndexedDB, addToQueue, devLog, cacheElements, getCachedElements,
} from '@/lib/journal-studio/sync/indexed-db';
import {
  triggerSync, onSyncStatusChange, type SyncStatus,
} from '@/lib/journal-studio/sync/sync-engine';
import { BlockRenderer } from './block-renderer';

const AUTOSAVE_DEBOUNCE = 2500;

// ===================================================================
// Block history for undo/redo
// ===================================================================
interface BlockHistoryEntry {
  blocks: DocumentBlock[];
}

// ===================================================================
// DocumentEditor — Word/Google Docs-like editor
// ===================================================================
export function DocumentEditor({
  journalId,
  onBack,
}: {
  journalId: string;
  onBack: () => void;
}) {
  // ---- Data ----
  const [journal, setJournal] = useState<Journal | null>(null);
  const [pages, setPages] = useState<JournalPage[]>([]);

  // Content blocks per page (page_id → DocumentPageContent)
  const [pageContents, setPageContents] = useState<Map<string, DocumentPageContent>>(new Map());
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // ---- UI State ----
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showPaperPicker, setShowPaperPicker] = useState(false);

  // ---- Undo/Redo ----
  const [undoStack, setUndoStack] = useState<BlockHistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<BlockHistoryEntry[]>([]);

  // ---- Save ----
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'offline'>('idle');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFlushingRef = useRef(false);
  const contentsRef = useRef(pageContents);

  // Keep ref in sync
  useEffect(() => { contentsRef.current = pageContents; });

  const currentIndex = currentPageIndex;
  const currentPage = pages[currentIndex] ?? null;

  // ===================================================================
  // INIT
  // ===================================================================
  useEffect(() => {
    initIndexedDB().catch(() => {});
    const unsubSync = onSyncStatusChange(setSyncStatus);
    return () => { unsubSync(); };
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

        // Load content blocks for all pages
        const contents = new Map<string, DocumentPageContent>();
        for (const page of p) {
          // Try to load from IndexedDB cache first
          const cached = await getCachedElements(page.id);
          if (cached && cached.length > 0) {
            // Check if cached data is DocumentPageContent format
            const first = cached[0] as Record<string, unknown>;
            if ('version' in first && 'blocks' in first) {
              contents.set(page.id, first as unknown as DocumentPageContent);
              continue;
            }
          }
          // Default: create empty document
          contents.set(page.id, createEmptyDocumentPageContent());
        }
        if (!cancelled) {
          setPageContents(contents);
          // Focus the first block of the first page
          const firstPage = p[0];
          if (firstPage) {
            const content = contents.get(firstPage.id);
            if (content && content.blocks.length > 0) {
              setFocusedBlockId(content.blocks[0].id);
            }
          }
        }
      } catch {
        if (!cancelled) onBack();
      }
    })();
    return () => { cancelled = true; };
  }, [journalId, onBack]);

  // ===================================================================
  // FLUSH: Save content blocks to Supabase + IndexedDB
  // ===================================================================
  const flushCurrentPage = useCallback(async () => {
    if (isFlushingRef.current || !dirtyRef.current) return;
    isFlushingRef.current = true;

    try {
      const page = currentPage;
      if (!page) { isFlushingRef.current = false; return; }

      const content = contentsRef.current.get(page.id);
      if (!content) { isFlushingRef.current = false; return; }

      // Save to IndexedDB (as a pseudo-element for compatibility with cacheElements)
      await cacheElements(page.id, [content as unknown as Record<string, unknown>]);

      // Save to Supabase via journal_pages content_blocks column
      // For now, we use the sync queue mechanism
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { error } = await supabase
        .from('journal_pages')
        .update({ content_blocks: content as unknown as Record<string, unknown> })
        .eq('id', page.id);

      if (error) {
        devLog('SAVE', 'Supabase update failed, queuing', error);
        await addToQueue({
          resource: 'page',
          operation: 'UPDATE',
          resourceId: page.id,
          parentId: page.journal_id,
          payload: { content_blocks: content },
        });
        triggerSync();
        setSaveStatus('error');
      } else {
        dirtyRef.current = false;
        setSaveStatus('saved');
        devLog('SAVE', `Saved ${content.blocks.length} blocks for page ${page.id}`);
      }

      // Touch journal updated_at
      await supabase
        .from('journals')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', page.journal_id);
    } catch (err) {
      devLog('SAVE', 'Flush failed', err);
      setSaveStatus('error');
    } finally {
      isFlushingRef.current = false;
    }
  }, [currentPage]);

  // Autosave timer
  useEffect(() => {
    if (!dirtyRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      flushCurrentPage();
    }, AUTOSAVE_DEBOUNCE);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [pageContents, flushCurrentPage]);

  // ===================================================================
  // Block operations
  // ===================================================================
  const updateBlock = useCallback((blockId: string, updates: Partial<DocumentBlock>) => {
    setPageContents((prev) => {
      const next = new Map(prev);
      const page = currentPage;
      if (!page) return prev;
      const content = next.get(page.id);
      if (!content) return prev;

      // Push to undo stack
      setUndoStack((stack) => [...stack, { blocks: JSON.parse(JSON.stringify(content.blocks)) }]);
      setRedoStack([]);

      const newBlocks = content.blocks.map((b) =>
        b.id === blockId ? { ...b, ...updates } : b
      );
      next.set(page.id, { ...content, blocks: newBlocks });
      dirtyRef.current = true;
      setSaveStatus('idle');
      return next;
    });
  }, [currentPage]);

  const deleteBlock = useCallback((blockId: string) => {
    setPageContents((prev) => {
      const next = new Map(prev);
      const page = currentPage;
      if (!page) return prev;
      const content = next.get(page.id);
      if (!content) return prev;

      // Don't delete the last block
      if (content.blocks.length <= 1) return prev;

      setUndoStack((stack) => [...stack, { blocks: JSON.parse(JSON.stringify(content.blocks)) }]);
      setRedoStack([]);

      const newBlocks = content.blocks.filter((b) => b.id !== blockId);
      next.set(page.id, { ...content, blocks: newBlocks });
      dirtyRef.current = true;
      setSaveStatus('idle');

      // Focus the previous block or the first one
      const deletedIdx = content.blocks.findIndex((b) => b.id === blockId);
      const newFocusIdx = Math.max(0, deletedIdx - 1);
      if (newBlocks[newFocusIdx]) {
        setFocusedBlockId(newBlocks[newFocusIdx].id);
      }

      return next;
    });
  }, [currentPage]);

  const insertBlockAfter = useCallback((afterId: string, type: BlockType) => {
    setPageContents((prev) => {
      const next = new Map(prev);
      const page = currentPage;
      if (!page) return prev;
      const content = next.get(page.id);
      if (!content) return prev;

      const newBlock = createDocumentBlock(type);
      const idx = content.blocks.findIndex((b) => b.id === afterId);
      const newBlocks = [...content.blocks];
      newBlocks.splice(idx + 1, 0, newBlock);

      setUndoStack((stack) => [...stack, { blocks: JSON.parse(JSON.stringify(content.blocks)) }]);
      setRedoStack([]);

      next.set(page.id, { ...content, blocks: newBlocks });
      dirtyRef.current = true;
      setSaveStatus('idle');
      setFocusedBlockId(newBlock.id);
      return next;
    });
  }, [currentPage]);

  // ===================================================================
  // Undo / Redo
  // ===================================================================
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || !currentPage) return;
    const entry = undoStack[undoStack.length - 1];

    // Save current state to redo
    const currentContent = pageContents.get(currentPage.id);
    if (currentContent) {
      setRedoStack((stack) => [...stack, { blocks: JSON.parse(JSON.stringify(currentContent.blocks)) }]);
    }

    // Restore
    setPageContents((prev) => {
      const next = new Map(prev);
      const content = next.get(currentPage.id);
      if (!content) return prev;
      next.set(currentPage.id, { ...content, blocks: entry.blocks });
      dirtyRef.current = true;
      return next;
    });

    setUndoStack((stack) => stack.slice(0, -1));
  }, [undoStack, currentPage, pageContents]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0 || !currentPage) return;
    const entry = redoStack[redoStack.length - 1];

    const currentContent = pageContents.get(currentPage.id);
    if (currentContent) {
      setUndoStack((stack) => [...stack, { blocks: JSON.parse(JSON.stringify(currentContent.blocks)) }]);
    }

    setPageContents((prev) => {
      const next = new Map(prev);
      const content = next.get(currentPage.id);
      if (!content) return prev;
      next.set(currentPage.id, { ...content, blocks: entry.blocks });
      dirtyRef.current = true;
      return next;
    });

    setRedoStack((stack) => stack.slice(0, -1));
  }, [redoStack, currentPage, pageContents]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        flushCurrentPage();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo, flushCurrentPage]);

  // ===================================================================
  // Block keyboard handler (Enter, Backspace, Tab, etc.)
  // ===================================================================
  const handleBlockKeyDown = useCallback((blockId: string, e: React.KeyboardEvent) => {
    const page = currentPage;
    if (!page) return;
    const content = pageContents.get(page.id);
    if (!content) return;

    const blockIdx = content.blocks.findIndex((b) => b.id === blockId);
    if (blockIdx === -1) return;
    const block = content.blocks[blockIdx];

    // Enter → create new block after current
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // If current block is empty list/heading, convert to paragraph
      const text = block.segments.map((s) => s.text).join('');
      if (text === '' && (block.type === 'bullet_list' || block.type === 'numbered_list' || block.type === 'checklist')) {
        updateBlock(blockId, { type: 'paragraph' });
        return;
      }
      const nextType: BlockType = (block.type === 'bullet_list' || block.type === 'numbered_list' || block.type === 'checklist')
        ? block.type
        : 'paragraph';
      insertBlockAfter(blockId, nextType);
      return;
    }

    // Backspace at start → convert to paragraph or merge with previous
    if (e.key === 'Backspace') {
      const sel = window.getSelection();
      if (sel && sel.isCollapsed) {
        const range = sel.getRangeAt(0);
        // Check if cursor is at the very start of the block
        if (range.startOffset === 0 && blockIdx > 0) {
          // Check if block is empty
          const text = block.segments.map((s) => s.text).join('');
          if (text === '') {
            e.preventDefault();
            // If it's a list type, convert to paragraph first
            if (block.type !== 'paragraph') {
              updateBlock(blockId, { type: 'paragraph' });
            } else {
              // Merge with previous block
              const prevBlock = content.blocks[blockIdx - 1];
              const prevText = prevBlock.segments.map((s) => s.text).join('');
              const curText = block.segments.map((s) => s.text).join('');
              updateBlock(prevBlock.id, { segments: [{ text: prevText + curText }] });
              deleteBlock(blockId);
              setFocusedBlockId(prevBlock.id);
            }
            return;
          }
        }
      }
    }

    // Tab → indent (for lists) or create subheading
    if (e.key === 'Tab') {
      e.preventDefault();
      if (block.type === 'bullet_list' || block.type === 'numbered_list') {
        const newLevel = (block.level ?? 0) + 1;
        updateBlock(blockId, { level: Math.min(newLevel, 3) });
      }
    }

    // Shift+Tab → outdent
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      if (block.type === 'bullet_list' || block.type === 'numbered_list') {
        const newLevel = Math.max(0, (block.level ?? 0) - 1);
        updateBlock(blockId, { level: newLevel });
      }
    }

    // Ctrl+B → bold (handled by contentEditable natively for now)
    // We'll add rich text support in Phase 7
  }, [currentPage, pageContents, updateBlock, deleteBlock, insertBlockAfter, setFocusedBlockId]);

  // ===================================================================
  // PAGE OPERATIONS
  // ===================================================================
  const handleAddPage = useCallback(async () => {
    if (!currentPage) return;
    await flushCurrentPage();
    const newPage = await createJournalPage(journalId, pages.length + 1);
    setPages((prev) => [...prev, newPage]);
    setPageContents((prev) => {
      const next = new Map(prev);
      next.set(newPage.id, createEmptyDocumentPageContent());
      return next;
    });
    setCurrentPageIndex(pages.length);
    setFocusedBlockId(null);
  }, [currentPage, journalId, pages, flushCurrentPage]);

  const handleDeletePage = useCallback(async () => {
    if (!currentPage || pages.length <= 1) return;
    if (!confirm('Supprimer cette page ?')) return;
    await deleteJournalPage(currentPage.id);
    const newPages = pages.filter((_, i) => i !== currentIndex);
    setPages(newPages);
    const newIdx = Math.min(currentIndex, newPages.length - 1);
    setCurrentPageIndex(newIdx);
    setPageContents((prev) => {
      const next = new Map(prev);
      next.delete(currentPage.id);
      return next;
    });
  }, [currentPage, pages, currentIndex]);

  const navigateToPage = useCallback(async (idx: number) => {
    if (idx < 0 || idx >= pages.length || idx === currentIndex) return;
    await flushCurrentPage();
    setCurrentPageIndex(idx);
    const page = pages[idx];
    if (page) {
      const content = pageContents.get(page.id);
      if (content && content.blocks.length > 0) {
        setFocusedBlockId(content.blocks[0].id);
      }
    }
  }, [pages, currentIndex, flushCurrentPage, pageContents]);

  // ===================================================================
  // SAVE STATUS
  // ===================================================================
  const getSaveStatusDisplay = () => {
    if (syncStatus === 'offline' || saveStatus === 'offline') {
      return <span className="flex items-center gap-1 text-xs text-muted-foreground"><CloudOff className="w-3 h-3" />Hors ligne</span>;
    }
    if (syncStatus === 'syncing' || saveStatus === 'saving') {
      return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" />…</span>;
    }
    if (syncStatus === 'synced' || saveStatus === 'saved') {
      return <span className="flex items-center gap-1 text-xs text-kin-sage"><Check className="w-3 h-3" /><span className="hidden sm:inline">Enregistré</span></span>;
    }
    if (saveStatus === 'error') {
      return <span className="flex items-center gap-1 text-xs text-destructive">⚠</span>;
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

  const page = currentPage;
  const content = page ? pageContents.get(page.id) : null;
  const blocks = content?.blocks ?? [];
  const paperBg = page ? (PAPER_PATTERNS[page.paper_style as keyof typeof PAPER_PATTERNS] ?? '') : '';
  const paperColor = page ? (PAPER_BACKGROUND_COLORS[page.paper_style as keyof typeof PAPER_BACKGROUND_COLORS] ?? '#ffffff') : '#ffffff';

  return (
    <div className="flex flex-col h-full select-none bg-background">
      {/* ====== HEADER BAR ====== */}
      <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/80 backdrop-blur-sm z-20">
        <div className="flex items-center gap-2">
          <button onClick={async () => { await flushCurrentPage(); onBack(); }} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-smooth" aria-label="Retour">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-foreground truncate max-w-[120px] sm:max-w-[250px]">{journal.title}</h1>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">Page {currentIndex + 1}/{pages.length}</p>
              {getSaveStatusDisplay()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Page navigation */}
          <div className="hidden sm:flex items-center gap-0.5">
            <button onClick={() => navigateToPage(currentIndex - 1)} disabled={currentIndex === 0} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30" aria-label="Page précédente">‹</button>
            <button onClick={() => navigateToPage(currentIndex + 1)} disabled={currentIndex >= pages.length - 1} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30" aria-label="Page suivante">›</button>
          </div>

          <div className="h-5 w-px bg-border hidden sm:block" />

          {/* Undo/Redo */}
          <div className="flex items-center gap-0.5">
            <button onClick={handleUndo} disabled={undoStack.length === 0} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30" aria-label="Annuler"><Undo2 className="w-4 h-4" /></button>
            <button onClick={handleRedo} disabled={redoStack.length === 0} className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30" aria-label="Rétablir"><Redo2 className="w-4 h-4" /></button>
          </div>

          <div className="h-5 w-px bg-border hidden sm:block" />

          {/* More menu */}
          <div className="relative">
            <button onClick={() => setShowMoreMenu(!showMoreMenu)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" aria-label="Plus"><MoreVertical className="w-5 h-5" /></button>
            <AnimatePresence>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-border bg-card shadow-lg p-1">
                    <button onClick={() => { setShowThumbnails(!showThumbnails); setShowMoreMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted">Miniatures</button>
                    <button onClick={() => { setShowPaperPicker(!showPaperPicker); setShowMoreMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted">Changer le papier</button>
                    <div className="my-1 h-px bg-border" />
                    <button onClick={() => { handleAddPage(); setShowMoreMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted"><Plus className="w-4 h-4" />Ajouter une page</button>
                    {pages.length > 1 && <button onClick={() => { handleDeletePage(); setShowMoreMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" />Supprimer la page</button>}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* ====== DOCUMENT PAGE ====== */}
      <div className="flex-1 overflow-auto bg-muted/30 flex justify-center py-8 px-4">
        <div
          className="relative w-full max-w-[700px] min-h-[900px] rounded-lg shadow-lg border border-border/50"
          style={{
            backgroundColor: paperColor,
            backgroundImage: paperBg || undefined,
            backgroundSize: paperBg ? undefined : undefined,
          }}
        >
          {/* Page content */}
          <div className="px-12 sm:px-16 py-12 space-y-1">
            {blocks.map((block, idx) => (
              <BlockRenderer
                key={block.id}
                block={block}
                index={idx}
                isFocused={focusedBlockId === block.id}
                isLast={idx === blocks.length - 1}
                onUpdate={updateBlock}
                onDelete={deleteBlock}
                onInsertAfter={insertBlockAfter}
                onFocus={setFocusedBlockId}
                onKeyDown={handleBlockKeyDown}
              />
            ))}

            {/* Click-to-add at bottom */}
            <button
              onClick={() => {
                const lastBlock = blocks[blocks.length - 1];
                if (lastBlock) {
                  const text = lastBlock.segments.map((s) => s.text).join('');
                  if (text === '') {
                    setFocusedBlockId(lastBlock.id);
                  } else {
                    insertBlockAfter(lastBlock.id, 'paragraph');
                  }
                }
              }}
              className="w-full py-8 text-center text-muted-foreground/30 hover:text-muted-foreground/60 text-sm transition-smooth cursor-text"
            >
              Cliquez ici pour continuer à écrire…
            </button>
          </div>
        </div>
      </div>

      {/* ====== THUMBNAILS PANEL ====== */}
      <AnimatePresence>
        {showThumbnails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border bg-card overflow-hidden"
          >
            <div className="p-3">
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-medium text-muted-foreground px-1 uppercase tracking-wide">Pages</p>
                {pages.map((page, idx) => {
                  const isActive = idx === currentIndex;
                  const content = pageContents.get(page.id);
                  const firstBlock = content?.blocks.find((b) => b.type === 'paragraph' || b.type === 'heading');
                  const firstText = firstBlock ? blockPlainText(firstBlock) : '';
                  return (
                    <button
                      key={page.id}
                      onClick={() => { navigateToPage(idx); setShowThumbnails(false); }}
                      className={cn(
                        'w-full text-left rounded-lg border-2 p-2 transition-smooth',
                        isActive ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/30'
                      )}
                    >
                      <span className="text-[10px] font-semibold text-foreground">Page {idx + 1}</span>
                      {firstText && (
                        <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{firstText.slice(0, 50)}</p>
                      )}
                    </button>
                  );
                })}
                <button
                  onClick={handleAddPage}
                  className="w-full rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center p-2 transition-smooth"
                >
                  <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
