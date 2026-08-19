'use client';

import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { JournalPage } from '@/lib/journal-studio/types';

interface PageThumbnailsProps {
  pages: JournalPage[];
  currentPageIndex: number;
  onSelectPage: (index: number) => void;
  onAddPage: () => void;
}

export function PageThumbnails({
  pages,
  currentPageIndex,
  onSelectPage,
  onAddPage,
}: PageThumbnailsProps) {
  return (
    <div className="flex flex-col h-full p-2 gap-2 overflow-y-auto">
      <p className="text-xs font-medium text-muted-foreground px-2 mb-1">Pages</p>

      {pages.map((page, index) => (
        <button
          key={page.id}
          onClick={() => onSelectPage(index)}
          className={cn(
            'relative w-full aspect-[3/4] rounded-lg border-2 transition-smooth overflow-hidden',
            index === currentPageIndex
              ? 'border-primary shadow-md'
              : 'border-border hover:border-primary/50'
          )}
        >
          {/* Thumbnail content (simplified) */}
          <div className="w-full h-full bg-white flex items-center justify-center">
            <span className="text-xs text-muted-foreground">{page.page_number}</span>
          </div>

          {/* Page number badge */}
          <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-background/80 text-[10px] font-medium text-foreground">
            {page.page_number}
          </div>
        </button>
      ))}

      {/* Add page button */}
      <button
        onClick={onAddPage}
        className="w-full aspect-[3/4] rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center transition-smooth"
      >
        <Plus className="w-6 h-6 text-muted-foreground" />
      </button>
    </div>
  );
}
