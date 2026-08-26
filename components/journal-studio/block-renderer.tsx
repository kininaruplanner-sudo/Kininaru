'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import type { DocumentBlock, InlineMark, TextSegment } from '@/lib/journal-studio/types';
import { Check, Circle, GripVertical, Plus, Trash2 } from 'lucide-react';

interface BlockRendererProps {
  block: DocumentBlock;
  index: number;
  isFocused: boolean;
  isLast: boolean;
  onUpdate: (id: string, updates: Partial<DocumentBlock>) => void;
  onDelete: (id: string) => void;
  onInsertAfter: (id: string, type: DocumentBlock['type']) => void;
  onFocus: (id: string) => void;
  onSplitAtEnd?: (id: string) => void;
  onKeyDown: (id: string, e: React.KeyboardEvent) => void;
}

// ===================================================================
// Block type labels and icons for the type selector
// ===================================================================
const BLOCK_LABELS: Record<DocumentBlock['type'], string> = {
  paragraph: 'Paragraphe',
  heading: 'Titre',
  subheading: 'Sous-titre',
  bullet_list: '• Liste',
  numbered_list: '1. Liste numérotée',
  checklist: '☑ Checklist',
  divider: '— Séparateur',
  quote: '❝ Citation',
};

// ===================================================================
// BlockRenderer
// ===================================================================
export function BlockRenderer({
  block,
  index,
  isFocused,
  isLast,
  onUpdate,
  onDelete,
  onInsertAfter,
  onFocus,
  onKeyDown,
}: BlockRendererProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [showTypeMenu, setShowTypeMenu] = useState(false);

  // Focus the contentEditable when isFocused becomes true
  useEffect(() => {
    if (isFocused && ref.current) {
      ref.current.focus();
      // Place cursor at end
      const sel = window.getSelection();
      if (sel && ref.current.childNodes.length > 0) {
        const range = document.createRange();
        range.selectNodeContents(ref.current);
        range.collapse(false); // collapse to end
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }, [isFocused]);

  // Sync external content changes (from undo/redo or persistence)
  useEffect(() => {
    if (!ref.current) return;
    const currentText = ref.current.textContent || '';
    const expectedText = block.segments.map((s) => s.text).join('');
    // Only update if content differs and we're not actively editing
    if (currentText !== expectedText && document.activeElement !== ref.current) {
      renderSegmentsIntoDOM(ref.current, block.segments);
    }
  }, [block.segments]);

  const handleInput = useCallback(() => {
    if (!ref.current) return;
    const text = ref.current.textContent || '';
    onUpdate(block.id, {
      segments: [{ text }],
    });
  }, [block.id, onUpdate]);

  const handleClick = useCallback(() => {
    onFocus(block.id);
  }, [block.id, onFocus]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    onKeyDown(block.id, e);
  }, [block.id, onKeyDown]);

  const handleFocus = useCallback(() => {
    onFocus(block.id);
  }, [block.id, onFocus]);

  // Divider block — no contentEditable
  if (block.type === 'divider') {
    return (
      <div className="group relative py-3 flex items-center gap-2" data-block-id={block.id}>
        <div className="flex-1 h-px bg-border" />
        <button
          onClick={() => onDelete(block.id)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground transition-smooth"
          aria-label="Supprimer le séparateur"
        >
          <Trash2 className="w-3 h-3" />
        </button>
        <div className="flex-1 h-px bg-border" />
      </div>
    );
  }

  // Checklist block
  if (block.type === 'checklist') {
    return (
      <div className="group relative flex items-start gap-2 py-0.5" data-block-id={block.id}>
        <button
          onClick={() => onUpdate(block.id, { checked: !block.checked })}
          className={cn(
            'mt-1 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-smooth',
            block.checked
              ? 'bg-primary border-primary text-primary-foreground'
              : 'border-border hover:border-primary'
          )}
          aria-label={block.checked ? 'Décocher' : 'Cocher'}
        >
          {block.checked && <Check className="w-2.5 h-2.5" />}
        </button>
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Liste de tâches…"
          className={cn(
            'flex-1 outline-none py-0.5 min-h-[1.5em]',
            block.checked && 'line-through text-muted-foreground'
          )}
          onInput={handleInput}
          onClick={handleClick}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          suppressHydrationWarning
        />
        <button
          onClick={() => onDelete(block.id)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground transition-smooth mt-0.5"
          aria-label="Supprimer"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // Bullet list block
  if (block.type === 'bullet_list') {
    return (
      <div className="group relative flex items-start gap-2 py-0.5" data-block-id={block.id}>
        <span className="mt-1 text-foreground select-none shrink-0">•</span>
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Élément de liste…"
          className="flex-1 outline-none py-0.5 min-h-[1.5em]"
          onInput={handleInput}
          onClick={handleClick}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          suppressHydrationWarning
        />
        <button
          onClick={() => onDelete(block.id)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground transition-smooth mt-0.5"
          aria-label="Supprimer"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // Numbered list block
  if (block.type === 'numbered_list') {
    return (
      <div className="group relative flex items-start gap-2 py-0.5" data-block-id={block.id}>
        <span className="mt-1 text-muted-foreground select-none shrink-0 text-sm font-medium min-w-[1.2em]">
          {index + 1}.
        </span>
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Élément de liste…"
          className="flex-1 outline-none py-0.5 min-h-[1.5em]"
          onInput={handleInput}
          onClick={handleClick}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          suppressHydrationWarning
        />
        <button
          onClick={() => onDelete(block.id)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground transition-smooth mt-0.5"
          aria-label="Supprimer"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // Quote block
  if (block.type === 'quote') {
    return (
      <div className="group relative pl-4 border-l-2 border-primary/30 py-1" data-block-id={block.id}>
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Citation…"
          className="outline-none italic text-muted-foreground min-h-[1.5em]"
          onInput={handleInput}
          onClick={handleClick}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          suppressHydrationWarning
        />
        <button
          onClick={() => onDelete(block.id)}
          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground transition-smooth"
          aria-label="Supprimer"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // Heading / Subheading / Paragraph
  const isHeading = block.type === 'heading';
  const isSubheading = block.type === 'subheading';

  const blockClasses = cn(
    'group relative outline-none min-h-[1.5em] w-full',
    isHeading && 'text-2xl font-bold text-foreground mt-6 mb-2 font-serif',
    isSubheading && 'text-lg font-semibold text-foreground mt-4 mb-1',
    !isHeading && !isSubheading && 'text-base text-foreground leading-relaxed',
    block.style?.textAlign === 'center' && 'text-center',
    block.style?.textAlign === 'right' && 'text-right',
  );

  const placeholder = isHeading
    ? 'Titre…'
    : isSubheading
      ? 'Sous-titre…'
      : 'Écrivez quelque chose…';

  return (
    <div className="relative" data-block-id={block.id}>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        className={blockClasses}
        style={{
          fontFamily: block.style?.fontFamily,
          fontSize: block.style?.fontSize,
          lineHeight: block.style?.lineHeight,
        }}
        onInput={handleInput}
        onClick={handleClick}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        suppressHydrationWarning
      />
      <button
        onClick={() => onDelete(block.id)}
        className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground transition-smooth"
        aria-label="Supprimer le bloc"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

// ===================================================================
// Render formatted segments into a DOM node
// ===================================================================
function renderSegmentsIntoDOM(node: HTMLElement, segments: TextSegment[]) {
  // Simple approach: just set textContent (inline marks require rich text)
  // For v1, we store formatting but render as plain text
  // Rich inline formatting will be added in Phase 7
  node.textContent = segments.map((s) => s.text).join('');
}
