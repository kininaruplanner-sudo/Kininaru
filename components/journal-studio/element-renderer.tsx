'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useSignedUrl } from '@/lib/journal-studio/hooks/use-signed-url';
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
  autoEdit?: boolean;
  onSelect: (e?: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
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
  autoEdit,
  onSelect,
  onContextMenu,
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
  const [_isResizing, setIsResizing] = useState(false);
  const [_isRotating, setIsRotating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const dragStart = useRef({ x: 0, y: 0, elX: 0, elY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const rotateStart = useRef({ centerX: 0, centerY: 0, startAngle: 0, startRotation: 0 });

  const elementRef = useRef<HTMLDivElement>(null);

  // ---- DRAG (local-first, no network during move) ----
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isEditing) return;
      if ((e.target as HTMLElement).dataset.handle) return;
      e.stopPropagation();
      e.preventDefault();

      // Writing-first: single-click on a selected text element enters edit mode
      // immediately. Double-click still works as a fallback.
      if (isSelected && element.element_type === 'text') {
        setIsEditing(true);
        return;
      }

      onSelect(e as unknown as React.MouseEvent);

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
    [element, isEditing, isSelected, zoom, onSelect, onDragStart, onDragEnd, onUpdateLocal]
  );

  // ---- RESIZE (local-first) ----
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
        onResizeEnd(element.id, Math.max(20, resizeStart.current.w + dx), Math.max(20, resizeStart.current.h + dy));
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [element, zoom, onResizeStart, onResizeEnd, onUpdateLocal]
  );

  // ---- ROTATION ----
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
        if (ev.shiftKey) newRotation = Math.round(newRotation / 45) * 45;
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

  const handleDoubleClick = useCallback(() => {
    if (element.element_type === 'text') setIsEditing(true);
  }, [element]);

  // Auto-enter edit mode when requested (e.g., new text element just created)
  useEffect(() => {
    if (autoEdit && element.element_type === 'text' && !isEditing) {
      setIsEditing(true);
    }
  }, [autoEdit, element.element_type]);

  // Auto-dismiss editing when clicking outside: use a pointerdown handler on
  // the window that excludes clicks inside THIS element.
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      // Only dismiss if clicking outside this element
      const clickedElement = target.closest('[data-element]');
      if (clickedElement !== elementRef.current) {
        setIsEditing(false);
      }
    };
    const timer = setTimeout(() => window.addEventListener('pointerdown', handler), 200);
    return () => { clearTimeout(timer); window.removeEventListener('pointerdown', handler); };
  }, [isEditing]);

  return (
    <div
      ref={elementRef}
      data-element
      className={cn(
        'absolute',
        isDragging && 'cursor-grabbing',
        !isDragging && !isEditing && 'cursor-grab',
        isSelected && 'ring-2 ring-primary/60 ring-offset-1 ring-offset-transparent'
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
      onContextMenu={(e) => { if (onContextMenu) { e.preventDefault(); e.stopPropagation(); onContextMenu(e); } }}
    >
      {renderInner(element, isEditing, setIsEditing, onUpdateElement)}

      {isSelected && !isEditing && (
        <>
          {/* Rotation handle */}
          <div data-handle="rotate" className="absolute -top-8 left-1/2 -translate-x-1/2 w-6 h-6 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-grab" onPointerDown={handleRotateDown} aria-label="Rotation">
            <div className="w-5 h-5 rounded-full bg-white border-2 border-primary shadow-md flex items-center justify-center text-[10px]">↻</div>
            <div className="absolute top-5 left-1/2 -translate-x-1/2 w-px h-3 bg-primary/40" />
          </div>

          {/* Resize handle (bottom-right) */}
          <div data-handle="resize" className="absolute -bottom-2 -right-2 w-6 h-6 min-w-[44px] min-h-[44px] flex items-center justify-end pb-0.5 pr-0.5 cursor-se-resize" onPointerDown={handleResizeDown} aria-label="Redimensionner">
            <div className="w-4 h-4 bg-primary rounded-full border-2 border-white shadow-md" />
          </div>

          {/* Resize handle (top-left) */}
          <div data-handle="resize-tl" className="absolute -top-2 -left-2 w-6 h-6 min-w-[44px] min-h-[44px] flex items-center justify-start pt-0.5 pl-0.5 cursor-nw-resize" onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsResizing(true);
            onResizeStart(element.id);
            const startX = e.clientX;
            const startY = e.clientY;
            const startW = element.width;
            const startH = element.height;
            const startElX = element.x;
            const startElY = element.y;

            const onMove = (ev: PointerEvent) => {
              const dx = (ev.clientX - startX) / zoom;
              const dy = (ev.clientY - startY) / zoom;
              onUpdateLocal(element.id, {
                width: Math.max(20, startW - dx),
                height: Math.max(20, startH - dy),
                x: startElX + dx,
                y: startElY + dy,
              });
            };
            const onUp = (ev: PointerEvent) => {
              setIsResizing(false);
              const dx = (ev.clientX - startX) / zoom;
              const dy = (ev.clientY - startY) / zoom;
              onResizeEnd(element.id, Math.max(20, startW - dx), Math.max(20, startH - dy));
              window.removeEventListener('pointermove', onMove);
              window.removeEventListener('pointerup', onUp);
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
          }} aria-label="Redimensionner">
            <div className="w-3 h-3 bg-primary rounded-full border-2 border-white shadow-sm" />
          </div>

          {/* Delete button */}
          <button data-handle="delete" className="absolute -top-2 -right-2 w-6 h-6 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-destructive text-white text-sm hover:bg-destructive/80 shadow-sm z-10" onClick={(e) => { e.stopPropagation(); onDelete(); }} aria-label="Supprimer l'élément">×</button>
        </>
      )}
    </div>
  );
}

// ===================================================================
// Inner renderers
// ===================================================================
function renderInner(
  element: JournalElement,
  isEditing: boolean,
  setIsEditing: (v: boolean) => void,
  onUpdateElement?: (id: string, properties: Partial<TextProperties | ShapeProperties | StickerProperties | ImageProperties | DrawingProperties>) => void
) {
  switch (element.element_type) {
    case 'text': return <TextInner element={element} isEditing={isEditing} setIsEditing={setIsEditing} onUpdateElement={onUpdateElement} />;
    case 'shape': return <ShapeInner element={element} />;
    case 'sticker': return <StickerInner element={element} />;
    case 'image': return <ImageInner element={element} />;
    case 'drawing': return <DrawingInner element={element} />;
    default: return null;
  }
}

// ===================================================================
// TEXT — controlled state, editable textarea
// ===================================================================
function TextInner({ element, isEditing, setIsEditing, onUpdateElement }: {
  element: JournalElement;
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  onUpdateElement?: (id: string, properties: Partial<TextProperties>) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const props = element.properties as TextProperties;
  const [localText, setLocalText] = useState(props.content);

  useEffect(() => { setLocalText(props.content); }, [props.content]);

  useEffect(() => {
    if (isEditing && ref.current) {
      ref.current.focus();
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

  const bgColor = props.background_color;
  const bgOpacity = props.background_opacity ?? 0;
  const textBg = bgColor && bgOpacity > 0
    ? `rgba(${hexToRgb(bgColor)}, ${bgOpacity})`
    : bgColor && bgOpacity === 0
      ? undefined
      : bgColor || undefined;

  if (isEditing) {
    return (
      <textarea
        ref={ref}
        value={localText}
        onChange={(e) => setLocalText(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setIsEditing(false); setLocalText(props.content); }
          e.stopPropagation();
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-full h-full border-2 border-primary/40 rounded-lg bg-white/95 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
        style={{
          padding: props.padding ?? 8,
          fontFamily: props.font_family,
          fontSize: props.font_size,
          fontWeight: props.font_weight,
          fontStyle: props.font_style,
          textDecoration: props.text_decoration,
          textAlign: props.text_align,
          color: props.color,
          backgroundColor: textBg || 'rgba(255,255,255,0.95)',
          lineHeight: props.line_height,
          letterSpacing: props.letter_spacing,
          borderRadius: props.border_radius,
        }}
        aria-label="Éditer le texte"
      />
    );
  }

  return (
    <div
      className="w-full h-full whitespace-pre-wrap break-words select-none overflow-hidden"
      style={{
        padding: props.padding ?? 8,
        fontFamily: props.font_family,
        fontSize: props.font_size,
        fontWeight: props.font_weight,
        fontStyle: props.font_style,
        textDecoration: props.text_decoration,
        textAlign: props.text_align,
        color: props.color,
        backgroundColor: textBg,
        lineHeight: props.line_height,
        letterSpacing: props.letter_spacing,
        borderRadius: props.border_radius,
      }}
    >
      {props.content || (
        <span className="text-muted-foreground/50 italic">Double-cliquez pour écrire</span>
      )}
    </div>
  );
}

// ===================================================================
// SHAPE — SVG-based with image fill support
// ===================================================================
function ShapeInner({ element }: { element: JournalElement }) {
  const props = element.properties as ShapeProperties;

  // Handle line/arrow
  if (props.shape_type === 'line' || props.shape_type === 'arrow') {
    return (
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="0" y1="50" x2="85" y2="50" stroke={props.stroke ?? '#1a1a1a'} strokeWidth={props.stroke_width ?? 2} />
        {props.shape_type === 'arrow' && <polygon points="85,40 100,50 85,60" fill={props.stroke ?? '#1a1a1a'} />}
      </svg>
    );
  }

  const svgShapes: Record<string, string> = {
    'triangle': 'M50,5 L95,95 L5,95 Z',
    'star': 'M50,5 L61,35 L95,35 L68,57 L79,90 L50,70 L21,90 L32,57 L5,35 L39,35 Z',
    'heart': 'M50,88 C20,65 5,50 5,30 C5,15 15,5 30,5 C40,5 48,12 50,18 C52,12 60,5 70,5 C85,5 95,15 95,30 C95,50 80,65 50,88Z',
    'hexagon': 'M50,2 L93,25 L93,75 L50,98 L7,75 L7,25 Z',
    'diamond': 'M50,5 L90,50 L50,95 L10,50 Z',
    'speech-bubble': 'M10,10 H90 Q95,10 95,15 V60 Q95,65 90,65 H30 L15,85 L20,65 H10 Q5,65 5,60 V15 Q5,10 10,10Z',
    'cloud': 'M25,60 Q5,60 10,45 Q5,30 20,30 Q20,15 40,15 Q50,5 65,15 Q80,15 80,30 Q95,30 90,45 Q95,60 75,60 Z',
    'flower': 'M50,15 Q55,30 50,35 Q45,30 50,15 M15,50 Q30,45 35,50 Q30,55 15,50 M50,85 Q45,70 50,65 Q55,70 50,85 M85,50 Q70,55 65,50 Q70,45 85,50 M22,22 Q35,28 35,35 Q28,35 22,22 M78,22 Q65,28 65,35 Q72,35 78,22 M22,78 Q28,65 35,65 Q35,72 22,78 M78,78 Q72,65 65,65 Q65,72 78,78 M50,50 Q53,40 50,35 Q47,40 50,50',
    'sun': 'M50,15 L55,30 L50,35 L45,30 Z M15,50 L30,45 L35,50 L30,55 Z M50,85 L45,70 L50,65 L55,70 Z M85,50 L70,55 L65,50 L70,45 Z M22,22 L35,32 L32,35 L22,22Z M78,22 L65,32 L68,35 L78,22Z M22,78 L32,65 L35,68 L22,78Z M78,78 L68,65 L65,68 L78,78Z',
    'bookmark': 'M25,5 H75 V85 L50,70 L25,85 Z',
    'tag': 'M5,15 Q5,5 15,5 L60,5 L85,25 L85,30 L65,50 L85,70 L85,75 L60,95 L15,95 Q5,95 5,85 Z',
    'ribbon': 'M10,15 Q10,5 20,5 L80,5 Q90,5 90,15 V50 L50,35 L10,50 Z M10,50 L50,65 L90,50 V85 Q90,95 80,95 L20,95 Q10,95 10,85 Z',
    'pill': 'M20,5 H80 Q95,5 95,50 Q95,95 80,95 H20 Q5,95 5,50 Q5,5 20,5 Z',
  };

  const svgPath = svgShapes[props.shape_type];

  if (svgPath) {
    const isImageFill = props.fill_type === 'image' && props.fill_image_url;
    return (
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          {isImageFill && (
            <clipPath id={`clip-${element.id}`}>
              <path d={svgPath} />
            </clipPath>
          )}
        </defs>
        {isImageFill ? (
          <image href={props.fill_image_url} x="0" y="0" width="100" height="100" clipPath={`url(#clip-${element.id})`} preserveAspectRatio="xMidYMid slice" />
        ) : (
          <path d={svgPath} fill={props.fill ?? 'transparent'} />
        )}
        <path d={svgPath} fill="none" stroke={props.stroke ?? '#1a1a1a'} strokeWidth={props.stroke_width ?? 2} />
      </svg>
    );
  }

  // CSS-based shapes
  const isImageFill = props.fill_type === 'image' && props.fill_image_url;

  const baseStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor: isImageFill ? undefined : (props.fill ?? 'transparent'),
    border: `${props.stroke_width ?? 2}px solid ${props.stroke ?? '#1a1a1a'}`,
    boxSizing: 'border-box',
    ...(isImageFill ? {
      backgroundImage: `url(${props.fill_image_url})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    } : {}),
  };

  if (props.shape_type === 'circle' || props.shape_type === 'ellipse') {
    return <div style={{ ...baseStyle, borderRadius: '50%' }} />;
  }
  if (props.shape_type === 'rounded-rectangle') {
    return <div style={{ ...baseStyle, borderRadius: '16px' }} />;
  }
  return <div style={baseStyle} />;
}

// ===================================================================
// STICKER
// ===================================================================
function StickerInner({ element }: { element: JournalElement }) {
  const props = element.properties as StickerProperties;
  const sticker = getStickerById(props.sticker_id);

  return (
    <div className="w-full h-full flex items-center justify-center text-4xl select-none pointer-events-none">
      {sticker?.emoji ?? '⭐'}
    </div>
  );
}

// ===================================================================
// IMAGE
// ===================================================================
function ImageInner({ element }: { element: JournalElement }) {
  const props = element.properties as ImageProperties;
  const { src, onError } = useSignedUrl(props.url ?? null);

  if (!props.url) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg border-2 border-dashed border-border">
        <span className="text-xs text-muted-foreground">Cliquer pour ajouter</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={props.alt ?? ''}
      className="w-full h-full pointer-events-none"
      style={{
        objectFit: props.object_fit ?? 'cover',
        borderRadius: props.border_radius,
        border: props.border_width ? `${props.border_width}px solid ${props.border_color ?? 'transparent'}` : undefined,
      }}
      draggable={false}
      onError={onError}
    />
  );
}

// ===================================================================
// DRAWING — segment-aware eraser (hides nearby strokes)
// ===================================================================
function DrawingInner({ element }: { element: JournalElement }) {
  const props = element.properties as DrawingProperties;
  if (!props.points || props.points.length < 2) return null;

  const isEraser = props.tool === 'eraser';

  // For eraser strokes, we render them as very light gray dashes to indicate
  // "this area was erased" without using white (which breaks on colored paper)
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

  // Determine stroke appearance based on tool
  let strokeColor: string;
  let strokeOpacity: number;
  let strokeWidth: number;
  let dashArray: string | undefined;

  if (isEraser) {
    // Eraser: render as a very light overlay stroke to indicate erasure zone
    strokeColor = 'rgba(255,255,255,0.85)';
    strokeOpacity = 0.9;
    strokeWidth = props.stroke_width;
    dashArray = undefined;
  } else if (props.tool === 'highlighter') {
    strokeColor = props.stroke_color;
    strokeOpacity = 0.35;
    strokeWidth = props.stroke_width * 2;
    dashArray = undefined;
  } else if (props.tool === 'pencil') {
    strokeColor = props.stroke_color;
    strokeOpacity = 0.7;
    strokeWidth = props.stroke_width;
    dashArray = undefined;
  } else {
    // pen
    strokeColor = props.stroke_color;
    strokeOpacity = props.opacity;
    strokeWidth = props.stroke_width;
    dashArray = undefined;
  }

  return (
    <svg className="w-full h-full pointer-events-none" viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} preserveAspectRatio="none">
      <path
        d={pathData}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={strokeOpacity}
        strokeDasharray={dashArray}
      />
    </svg>
  );
}

// ===================================================================
// UTILITIES
// ===================================================================
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return `${r},${g},${b}`;
  }
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r},${g},${b}`;
}
