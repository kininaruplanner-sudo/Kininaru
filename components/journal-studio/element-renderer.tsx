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

interface ElementRendererProps {
  element: JournalElement;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<JournalElement>) => void;
  onDelete: () => void;
}

export function ElementRenderer({
  element,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
}: ElementRendererProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, elementX: 0, elementY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Handle drag start
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isEditing) return;
      e.stopPropagation();
      onSelect();

      setIsDragging(true);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        elementX: element.x,
        elementY: element.y,
      };

      const onPointerMove = (e: PointerEvent) => {
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        onUpdate({
          x: dragStart.current.elementX + dx,
          y: dragStart.current.elementY + dy,
        });
      };

      const onPointerUp = () => {
        setIsDragging(false);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    },
    [element, isEditing, onSelect, onUpdate]
  );

  // Handle resize start
  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      setIsResizing(true);

      resizeStart.current = {
        x: e.clientX,
        y: e.clientY,
        width: element.width,
        height: element.height,
      };

      const onPointerMove = (e: PointerEvent) => {
        const dx = e.clientX - resizeStart.current.x;
        const dy = e.clientY - resizeStart.current.y;
        onUpdate({
          width: Math.max(20, resizeStart.current.width + dx),
          height: Math.max(20, resizeStart.current.height + dy),
        });
      };

      const onPointerUp = () => {
        setIsResizing(false);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    },
    [element, onUpdate]
  );

  // Handle double click for text editing
  const handleDoubleClick = useCallback(() => {
    if (element.element_type === 'text') {
      setIsEditing(true);
    }
  }, [element]);

  // Render based on element type
  const renderElement = () => {
    switch (element.element_type) {
      case 'text':
        return <TextElement element={element} isEditing={isEditing} onEditEnd={() => setIsEditing(false)} onUpdate={onUpdate} />;
      case 'shape':
        return <ShapeElement element={element} />;
      case 'sticker':
        return <StickerElement element={element} />;
      case 'image':
        return <ImageElement element={element} />;
      case 'drawing':
        return <DrawingElement element={element} />;
      default:
        return null;
    }
  };

  return (
    <div
      ref={elementRef}
      className={cn(
        'absolute touch-none',
        isDragging && 'cursor-grabbing',
        !isDragging && !isEditing && 'cursor-grab',
        isSelected && 'ring-2 ring-primary ring-offset-1'
      )}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        transform: `rotate(${element.rotation}deg)`,
        opacity: element.opacity,
        zIndex: element.z_index,
      }}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
    >
      {renderElement()}

      {/* Selection handles */}
      {isSelected && !isEditing && (
        <>
          {/* Resize handle */}
          <div
            className="absolute -bottom-2 -right-2 w-4 h-4 bg-primary rounded-full cursor-se-resize border-2 border-white shadow-sm"
            onPointerDown={handleResizeStart}
          />

          {/* Delete button */}
          <button
            className="absolute -top-2 -right-2 w-5 h-5 bg-destructive rounded-full flex items-center justify-center text-white text-xs hover:bg-destructive/80 shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Text Element
// ---------------------------------------------------------------------
interface TextElementProps {
  element: JournalElement;
  isEditing: boolean;
  onEditEnd: () => void;
  onUpdate: (updates: Partial<JournalElement>) => void;
}

function TextElement({ element, isEditing, onEditEnd, onUpdate }: TextElementProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const props = element.properties as TextProperties;

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={props.content}
        onChange={(e) => {
          onUpdate({
            properties: { ...props, content: e.target.value },
          });
        }}
        onBlur={onEditEnd}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onEditEnd();
          }
        }}
        className="w-full h-full p-2 border border-primary/50 rounded-lg bg-white resize-none focus:outline-none"
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
      />
    );
  }

  return (
    <div
      className="w-full h-full p-2 whitespace-pre-wrap break-words"
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
      {props.content}
    </div>
  );
}

// ---------------------------------------------------------------------
// Shape Element
// ---------------------------------------------------------------------
function ShapeElement({ element }: { element: JournalElement }) {
  const props = element.properties as ShapeProperties;

  const getShapeStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      width: '100%',
      height: '100%',
      backgroundColor: props.fill ?? 'transparent',
      border: `${props.stroke_width ?? 2}px solid ${props.stroke ?? '#1a1a1a'}`,
    };

    switch (props.shape_type) {
      case 'circle':
        return { ...base, borderRadius: '50%' };
      case 'ellipse':
        return { ...base, borderRadius: '50%' };
      case 'rounded-rectangle':
        return { ...base, borderRadius: '16px' };
      default:
        return base;
    }
  };

  if (props.shape_type === 'line' || props.shape_type === 'arrow') {
    return (
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line
          x1="0"
          y1="50"
          x2="90"
          y2="50"
          stroke={props.stroke ?? '#1a1a1a'}
          strokeWidth={props.stroke_width ?? 2}
        />
        {props.shape_type === 'arrow' && (
          <polygon
            points="90,40 100,50 90,60"
            fill={props.stroke ?? '#1a1a1a'}
          />
        )}
      </svg>
    );
  }

  return <div style={getShapeStyle()} />;
}

// ---------------------------------------------------------------------
// Sticker Element
// ---------------------------------------------------------------------
function StickerElement({ element }: { element: JournalElement }) {
  const props = element.properties as StickerProperties;

  // Find the sticker emoji
  const { STICKERS } = require('@/lib/journal-studio/stickers');
  const sticker = STICKERS.find((s: { id: string }) => s.id === props.sticker_id);

  return (
    <div className="w-full h-full flex items-center justify-center text-4xl select-none">
      {sticker?.emoji ?? '⭐'}
    </div>
  );
}

// ---------------------------------------------------------------------
// Image Element
// ---------------------------------------------------------------------
function ImageElement({ element }: { element: JournalElement }) {
  const props = element.properties as ImageProperties;

  if (!props.url) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg border-2 border-dashed border-border">
        <span className="text-xs text-muted-foreground">Image</span>
      </div>
    );
  }

  return (
    <img
      src={props.url}
      alt={props.alt ?? ''}
      className="w-full h-full object-cover rounded-lg"
      style={{ objectFit: props.object_fit }}
    />
  );
}

// ---------------------------------------------------------------------
// Drawing Element
// ---------------------------------------------------------------------
function DrawingElement({ element }: { element: JournalElement }) {
  const props = element.properties as DrawingProperties;

  if (!props.points || props.points.length === 0) {
    return null;
  }

  // Calculate SVG path from points
  const pathData = props.points
    .map((point, i) => `${i === 0 ? 'M' : 'L'} ${point[0]} ${point[1]}`)
    .join(' ');

  // Calculate bounds
  const xs = props.points.map((p) => p[0]);
  const ys = props.points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return (
    <svg
      className="w-full h-full"
      viewBox={`${minX - 10} ${minY - 10} ${maxX - minX + 20} ${maxY - minY + 20}`}
      preserveAspectRatio="none"
    >
      <path
        d={pathData}
        fill="none"
        stroke={props.stroke_color}
        strokeWidth={props.stroke_width}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={props.opacity}
      />
    </svg>
  );
}
