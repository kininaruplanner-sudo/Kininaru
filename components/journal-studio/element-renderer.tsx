'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type {
  JournalElement,
  TextProperties,
  ShapeProperties,
  StickerProperties,
  ImageProperties,
  DrawingProperties,
} from '@/lib/journal-studio/types';
import { getStickerById } from '@/lib/journal-studio/stickers';

interface ElementRendererProps {
  element: JournalElement;
  isSelected: boolean;
  zoom: number;
  onSelect: () => void;
  onDragStart: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onResizeStart: (id: string) => void;
  onResizeEnd: (id: string, width: number, height: number) => void;
  onRotateEnd: (id: string, rotation: number) => void;
  onUpdateLocal: (id: string, localOverrides: Partial<JournalElement>) => void;
  onDelete: () => void;
  onUpdateElement?: (id: string, properties: Partial<TextProperties | ShapeProperties | StickerProperties | ImageProperties | DrawingProperties>) => void;
}

export function ElementRenderer({
  element,
  isSelected,
  zoom,
  onSelect,
  onDragStart,
  onDragEnd,
  onResizeStart,
  onResizeEnd,
  onRotateEnd,
  onUpdateLocal,
  onDelete,
  onUpdateElement,
}: ElementRendererProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const dragStart = useRef({ x: 0, y: 0, elX: 0, elY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const rotateStart = useRef({ centerX: 0, centerY: 0, startAngle: 0, startRotation: 0 });

  // ---- DRAG (LOCAL-ONLY during move, persist on pointerup) ----
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isEditing) return;
      if ((e.target as HTMLElement).dataset.handle) return;
      e.stopPropagation();
      e.preventDefault();
      onSelect();

      setIsDragging(true);
      onDragStart(element.id);
      dragStart.current = { x: e.clientX, y: e.clientY, elX: element.x, elY: element.y };

      const onMove = (ev: PointerEvent) => {
        const dx = (ev.clientX - dragStart.current.x) / zoom;
        const dy = (ev.clientY - dragStart.current.y) / zoom;
        onUpdateLocal(element.id, {
          x: dragStart.current.elX + dx,
          y: dragStart.current.elY + dy,
        });
      };

      const onUp = (ev: PointerEvent) => {
        setIsDragging(false);
        const dx = (ev.clientX - dragStart.current.x) / zoom;
        const dy = (ev.clientY - dragStart.current.y) / zoom;
        onDragEnd(element.id, dragStart.current.elX + dx, dragStart.current.elY + dy);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [element, isEditing, zoom, onSelect, onDragStart, onDragEnd, onUpdateLocal]
  );

  // ---- RESIZE (LOCAL-ONLY during move, persist on pointerup) ----
  const handleResizeDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsResizing(true);
      onResizeStart(element.id);
      resizeStart.current = { x: e.clientX, y: e.clientY, w: element.width, h: element.height };

      const onMove = (ev: PointerEvent) => {
        const dx = (ev.clientX - resizeStart.current.x) / zoom;
        const dy = (ev.clientY - resizeStart.current.y) / zoom;
        onUpdateLocal(element.id, {
          width: Math.max(20, resizeStart.current.w + dx),
          height: Math.max(20, resizeStart.current.h + dy),
        });
      };

      const onUp = (ev: PointerEvent) => {
        setIsResizing(false);
        const dx = (ev.clientX - resizeStart.current.x) / zoom;
        const dy = (ev.clientY - resizeStart.current.y) / zoom;
        onResizeEnd(
          element.id,
          Math.max(20, resizeStart.current.w + dx),
          Math.max(20, resizeStart.current.h + dy)
        );
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [element, zoom, onResizeStart, onResizeEnd, onUpdateLocal]
  );

  // ---- ROTATION (LOCAL-ONLY during move, persist on pointerup) ----
  const handleRotateDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsRotating(true);

      const rect = (e.currentTarget.closest('[data-element]') as HTMLElement)?.getBoundingClientRect();
      if (!rect) return;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);

      rotateStart.current = { centerX, centerY, startAngle, startRotation: element.rotation };

      const onMove = (ev: PointerEvent) => {
        const angle = Math.atan2(ev.clientY - centerY, ev.clientX - centerX) * (180 / Math.PI);
        let newRotation = rotateStart.current.startRotation + (angle - startAngle);

        // Snap to 45° increments when shift held
        if (ev.shiftKey) {
          newRotation = Math.round(newRotation / 45) * 45;
        }

        onUpdateLocal(element.id, { rotation: newRotation });
      };

      const onUp = () => {
        setIsRotating(false);
        onRotateEnd(element.id, element.rotation);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [element, onRotateEnd, onUpdateLocal]
  );

  // Double-click to edit text
  const handleDoubleClick = useCallback(() => {
    if (element.element_type === 'text') {
      setIsEditing(true);
    }
  }, [element]);

  // Click outside to end editing
  useEffect(() => {
    if (!isEditing) return;
    const handler = () => setIsEditing(false);
    // Delay to avoid catching the same click that opened editing
    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handler);
    }, 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', handler);
    };
  }, [isEditing]);

  return (
    <div
      data-element
      className={cn(
        'absolute',
        isDragging && 'cursor-grabbing',
        !isDragging && !isEditing && 'cursor-grab',
        isSelected && 'ring-2 ring-primary/70'
      )}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        transform: `rotate(${element.rotation}deg)`,
        opacity: element.opacity,
        zIndex: element.z_index,
        pointerEvents: 'auto',
      }}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
    >
      {renderInner(element, isEditing, setIsEditing, onUpdateElement)}

      {/* Selection handles */}
      {isSelected && !isEditing && (
        <>
          {/* Rotation handle — bigger for touch */}
          <div
            data-handle="rotate"
            className="absolute -top-8 left-1/2 -translate-x-1/2 w-5 h-5 cursor-grab flex items-center justify-center"
            onPointerDown={handleRotateDown}
          >
            <div className="w-4 h-4 rounded-full bg-white border-2 border-primary shadow-sm flex items-center justify-center text-[8px]">
              ↻
            </div>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-px h-3 bg-primary/50" />
          </div>

          {/* Resize handle — bigger for touch (44px touch target) */}
          <div
            data-handle="resize"
            className="absolute -bottom-3 -right-3 w-5 h-5 min-w-[44px] min-h-[44px] flex items-center justify-end pb-1 pr-1 cursor-se-resize"
            onPointerDown={handleResizeDown}
          >
            <div className="w-4 h-4 bg-primary rounded-full border-2 border-white shadow-sm" />
          </div>

          {/* Delete button — bigger for touch */}
          <button
            data-handle="delete"
            className="absolute -top-2 -right-2 w-6 h-6 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-destructive text-white text-sm hover:bg-destructive/80 shadow-sm z-10"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label="Supprimer l'élément"
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Inner renderers
// ---------------------------------------------------------------------

function renderInner(
  element: JournalElement,
  isEditing: boolean,
  setIsEditing: (v: boolean) => void,
  onUpdateElement?: (id: string, properties: Partial<TextProperties | ShapeProperties | StickerProperties | ImageProperties | DrawingProperties>) => void
) {
  switch (element.element_type) {
    case 'text':
      return <TextInner element={element} isEditing={isEditing} setIsEditing={setIsEditing} onUpdateElement={onUpdateElement} />;
    case 'shape':
      return <ShapeInner element={element} />;
    case 'sticker':
      return <StickerInner element={element} />;
    case 'image':
      return <ImageInner element={element} />;
    case 'drawing':
      return <DrawingInner element={element} />;
    default:
      return null;
  }
}

// ---- Text (with controlled state — NO direct mutation) ----
function TextInner({ element, isEditing, setIsEditing, onUpdateElement }: {
  element: JournalElement;
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  onUpdateElement?: (id: string, properties: Partial<TextProperties>) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const props = element.properties as TextProperties;
  const [localText, setLocalText] = useState(props.content);

  // Sync from props when element changes (e.g. undo/redo)
  useEffect(() => {
    setLocalText(props.content);
  }, [props.content]);

  useEffect(() => {
    if (isEditing && ref.current) {
      ref.current.focus();
      // Place cursor at end
      ref.current.selectionStart = ref.current.value.length;
      ref.current.selectionEnd = ref.current.value.length;
    }
  }, [isEditing]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (localText !== props.content && onUpdateElement) {
      onUpdateElement(element.id, { content: localText });
    }
  }, [setIsEditing, localText, props.content, onUpdateElement, element.id]);

  if (isEditing) {
    return (
      <textarea
        ref={ref}
        value={localText}
        onChange={(e) => setLocalText(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setIsEditing(false);
            // Revert if Escape
            setLocalText(props.content);
          }
          e.stopPropagation();
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-full h-full p-2 border border-primary/50 rounded-lg bg-white/90 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
        style={{
          fontFamily: props.font_family,
          fontSize: props.font_size,
          fontWeight: props.font_weight,
          fontStyle: props.font_style,
          textDecoration: props.text_decoration,
          textAlign: props.text_align,
          color: props.color,
          lineHeight: props.line_height,
          letterSpacing: props.letter_spacing,
        }}
        aria-label="Éditer le texte"
      />
    );
  }

  return (
    <div
      className="w-full h-full p-2 whitespace-pre-wrap break-words select-none overflow-hidden"
      style={{
        fontFamily: props.font_family,
        fontSize: props.font_size,
        fontWeight: props.font_weight,
        fontStyle: props.font_style,
        textDecoration: props.text_decoration,
        textAlign: props.text_align,
        color: props.color,
        backgroundColor: props.background_color,
        lineHeight: props.line_height,
        letterSpacing: props.letter_spacing,
      }}
    >
      {props.content || 'Double-cliquez pour écrire'}
    </div>
  );
}

// ---- Shape ----
function ShapeInner({ element }: { element: JournalElement }) {
  const props = element.properties as ShapeProperties;

  if (props.shape_type === 'line' || props.shape_type === 'arrow') {
    return (
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="0" y1="50" x2="85" y2="50" stroke={props.stroke ?? '#1a1a1a'} strokeWidth={props.stroke_width ?? 2} />
        {props.shape_type === 'arrow' && (
          <polygon points="85,40 100,50 85,60" fill={props.stroke ?? '#1a1a1a'} />
        )}
      </svg>
    );
  }

  if (props.shape_type === 'triangle') {
    return (
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon points="50,5 95,95 5,95" fill={props.fill ?? 'transparent'} stroke={props.stroke ?? '#1a1a1a'} strokeWidth={props.stroke_width ?? 2} />
      </svg>
    );
  }

  if (props.shape_type === 'star') {
    return (
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon points="50,5 61,35 95,35 68,57 79,90 50,70 21,90 32,57 5,35 39,35" fill={props.fill ?? '#FFD700'} stroke={props.stroke ?? '#1a1a1a'} strokeWidth={props.stroke_width ?? 2} />
      </svg>
    );
  }

  if (props.shape_type === 'heart') {
    return (
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M50,88 C20,65 5,50 5,30 C5,15 15,5 30,5 C40,5 48,12 50,18 C52,12 60,5 70,5 C85,5 95,15 95,30 C95,50 80,65 50,88Z" fill={props.fill ?? '#FF6B6B'} stroke={props.stroke ?? '#1a1a1a'} strokeWidth={props.stroke_width ?? 2} />
      </svg>
    );
  }

  if (props.shape_type === 'speech-bubble') {
    return (
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M10,10 H90 Q95,10 95,15 V60 Q95,65 90,65 H30 L15,85 L20,65 H10 Q5,65 5,60 V15 Q5,10 10,10Z" fill={props.fill ?? '#E8D5C4'} stroke={props.stroke ?? '#1a1a1a'} strokeWidth={props.stroke_width ?? 2} />
      </svg>
    );
  }

  // Default: rectangle, rounded-rectangle, circle, ellipse
  const baseStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor: props.fill ?? 'transparent',
    border: `${props.stroke_width ?? 2}px solid ${props.stroke ?? '#1a1a1a'}`,
    boxSizing: 'border-box',
  };

  if (props.shape_type === 'circle' || props.shape_type === 'ellipse') {
    return <div style={{ ...baseStyle, borderRadius: '50%' }} />;
  }
  if (props.shape_type === 'rounded-rectangle') {
    return <div style={{ ...baseStyle, borderRadius: '16px' }} />;
  }
  return <div style={baseStyle} />;
}

// ---- Sticker ----
function StickerInner({ element }: { element: JournalElement }) {
  const props = element.properties as StickerProperties;
  const sticker = getStickerById(props.sticker_id);

  return (
    <div className="w-full h-full flex items-center justify-center text-4xl select-none pointer-events-none">
      {sticker?.emoji ?? '⭐'}
    </div>
  );
}

// ---- Image ----
function ImageInner({ element }: { element: JournalElement }) {
  const props = element.properties as ImageProperties;

  if (!props.url) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg border-2 border-dashed border-border">
        <span className="text-xs text-muted-foreground">Cliquer pour ajouter</span>
      </div>
    );
  }

  return (
    <img
      src={props.url}
      alt={props.alt ?? ''}
      className="w-full h-full rounded-lg pointer-events-none"
      style={{ objectFit: props.object_fit ?? 'cover' }}
      draggable={false}
    />
  );
}

// ---- Drawing (with eraser indicator) ----
function DrawingInner({ element }: { element: JournalElement }) {
  const props = element.properties as DrawingProperties;

  if (!props.points || props.points.length < 2) return null;

  // Build smooth path with quadratic curves
  let pathData = `M ${props.points[0][0]} ${props.points[0][1]}`;
  for (let i = 1; i < props.points.length; i++) {
    const [x, y] = props.points[i];
    const [px, py] = props.points[i - 1];
    const mx = (px + x) / 2;
    const my = (py + y) / 2;
    pathData += ` Q ${px} ${py} ${mx} ${my}`;
  }

  const xs = props.points.map((p) => p[0]);
  const ys = props.points.map((p) => p[1]);
  const pad = 10;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const maxX = Math.max(...xs) + pad;
  const maxY = Math.max(...ys) + pad;

  // For eraser strokes: use a dash pattern to indicate erasure
  const isEraser = props.tool === 'eraser';

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      preserveAspectRatio="none"
    >
      <path
        d={pathData}
        fill="none"
        stroke={isEraser ? 'rgba(200,200,200,0.6)' : props.stroke_color}
        strokeWidth={props.stroke_width}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={props.tool === 'highlighter' ? 0.4 : props.opacity}
        strokeDasharray={isEraser ? '4 4' : undefined}
      />
    </svg>
  );
}
