'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPageElements } from '@/lib/journal-studio/supabase';
import type { JournalPage, JournalElement } from '@/lib/journal-studio/types';
import { PAPER_PATTERNS } from '@/lib/journal-studio/types';
import { getStickerById } from '@/lib/journal-studio/stickers';

interface PageThumbnailsProps {
  pages: JournalPage[];
  currentPageIndex: number;
  elements: JournalElement[];
  onSelectPage: (index: number) => void;
  onAddPage: () => void;
}

const THUMB_W = 100;
const SCALE = THUMB_W / 595;

export function PageThumbnails({ pages, currentPageIndex, elements, onSelectPage, onAddPage }: PageThumbnailsProps) {
  const [thumbElements, setThumbElements] = useState<Record<string, JournalElement[]>>({});

  // Load elements for all pages
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const page of pages) {
        if (thumbElements[page.id]) continue;
        try {
          const els = await getPageElements(page.id);
          if (!cancelled) setThumbElements((prev) => ({ ...prev, [page.id]: els }));
        } catch { /* skip */ }
      }
    })();
    return () => { cancelled = true; };
  }, [pages]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update current page elements when they change (in-memory)
  useEffect(() => {
    if (pages[currentPageIndex]) {
      setThumbElements((prev) => ({ ...prev, [pages[currentPageIndex].id]: elements }));
    }
  }, [elements, currentPageIndex, pages]);

  return (
    <div className="flex flex-col h-full p-2 gap-2 overflow-y-auto">
      <p className="text-[10px] font-medium text-muted-foreground px-1 uppercase tracking-wide">Pages</p>

      {pages.map((page, index) => {
        const els = thumbElements[page.id] ?? [];
        const isActive = index === currentPageIndex;
        const bg = PAPER_PATTERNS[page.paper_style as keyof typeof PAPER_PATTERNS] ?? '';

        return (
          <button
            key={page.id}
            onClick={() => onSelectPage(index)}
            className={cn(
              'relative w-full rounded-lg border-2 transition-smooth overflow-hidden flex-shrink-0',
              isActive ? 'border-primary shadow-md' : 'border-border hover:border-primary/50'
            )}
            style={{ aspectRatio: '595/842' }}
          >
            <div
              className="w-full h-full relative bg-white overflow-hidden"
              style={{
                backgroundImage: bg || undefined,
                backgroundSize: page.paper_style === 'grid' ? '20px 20px, 20px 20px' : undefined,
              }}
            >
              {els.map((el) => (
                <ThumbElement key={el.id} element={el} scale={SCALE} />
              ))}
            </div>
            <div className="absolute bottom-0.5 left-0.5 px-1 py-px rounded bg-background/80 text-[8px] font-medium text-foreground">
              {page.page_number}
            </div>
          </button>
        );
      })}

      <button onClick={onAddPage} className="w-full rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center transition-smooth flex-shrink-0" style={{ aspectRatio: '595/842' }}>
        <Plus className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
}

// Minimal thumbnail element renderer
function ThumbElement({ element, scale }: { element: JournalElement; scale: number }) {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: element.x * scale,
    top: element.y * scale,
    width: element.width * scale,
    height: element.height * scale,
    opacity: element.opacity,
    zIndex: element.z_index,
    overflow: 'hidden',
  };

  if (element.element_type === 'text') {
    const p = element.properties as { content?: string; color?: string; font_size?: number };
    return (
      <div style={{ ...style, color: p.color, fontSize: Math.max(3, (p.font_size ?? 16) * scale), lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden' }}>
        {(p.content ?? '').slice(0, 40)}
      </div>
    );
  }

  if (element.element_type === 'shape') {
    const p = element.properties as { fill?: string; stroke?: string; shape_type?: string; stroke_width?: number };
    return (
      <div
        style={{
          ...style,
          backgroundColor: p.fill ?? 'transparent',
          border: `${Math.max(0.5, (p.stroke_width ?? 2) * scale)}px solid ${p.stroke ?? '#1a1a1a'}`,
          borderRadius: p.shape_type === 'circle' || p.shape_type === 'ellipse' ? '50%' : p.shape_type === 'rounded-rectangle' ? `${8 * scale}px` : undefined,
        }}
      />
    );
  }

  if (element.element_type === 'sticker') {
    const p = element.properties as { sticker_id?: string };
    const sticker = p.sticker_id ? getStickerById(p.sticker_id) : null;
    return (
      <div style={{ ...style, fontSize: Math.max(6, 32 * scale), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {sticker?.emoji ?? '⭐'}
      </div>
    );
  }

  if (element.element_type === 'image') {
    const p = element.properties as { url?: string };
    return p.url ? (
      <img src={p.url} alt="" style={{ ...style, objectFit: 'cover' }} draggable={false} />
    ) : (
      <div style={{ ...style, background: '#e5e5e5', border: '1px dashed #ccc' }} />
    );
  }

  if (element.element_type === 'drawing') {
    const p = element.properties as { points?: [number, number, number][]; stroke_color?: string; stroke_width?: number; tool?: string; opacity?: number };
    if (!p.points || p.points.length < 2) return null;
    const pathData = p.points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt[0] * scale} ${pt[1] * scale}`).join(' ');
    const xs = p.points.map((pt) => pt[0] * scale);
    const ys = p.points.map((pt) => pt[1] * scale);
    const pad = 1;
    return (
      <svg style={style} viewBox={`${Math.min(...xs) - pad} ${Math.min(...ys) - pad} ${Math.max(...xs) - Math.min(...xs) + 2 * pad} ${Math.max(...ys) - Math.min(...ys) + 2 * pad}`} preserveAspectRatio="none">
        <path
          d={pathData}
          fill="none"
          stroke={p.tool === 'eraser' ? 'rgba(200,200,200,0.6)' : (p.stroke_color ?? '#1a1a1a')}
          strokeWidth={Math.max(0.5, (p.stroke_width ?? 3) * scale)}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={p.tool === 'highlighter' ? 0.4 : p.opacity ?? 1}
          strokeDasharray={p.tool === 'eraser' ? '2 2' : undefined}
        />
      </svg>
    );
  }

  return null;
}
