'use client';

import { useState, useMemo } from 'react';
import { Search, X, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { JournalPage, JournalElement } from '@/lib/journal-studio/types';

interface SearchResult {
  pageIndex: number;
  pageNumber: number;
  elementId: string;
  snippet: string;
  elementType: string;
}

interface JournalSearchProps {
  pages: JournalPage[];
  pagesElements: Map<string, JournalElement[]>;
  onGoToPage: (pageIndex: number) => void;
  onClose: () => void;
}

export function JournalSearch({ pages, pagesElements, onGoToPage, onClose }: JournalSearchProps) {
  const [query, setQuery] = useState('');

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    const found: SearchResult[] = [];

    pages.forEach((page, pageIndex) => {
      const els = pagesElements.get(page.id) ?? [];
      for (const el of els) {
        if (el.element_type === 'text') {
          const props = el.properties as { content?: string };
          const content = props.content ?? '';
          if (content.toLowerCase().includes(q)) {
            const idx = content.toLowerCase().indexOf(q);
            const start = Math.max(0, idx - 30);
            const end = Math.min(content.length, idx + q.length + 30);
            const snippet = (start > 0 ? '...' : '') + content.slice(start, end).replace(/\n/g, ' ') + (end < content.length ? '...' : '');
            found.push({
              pageIndex,
              pageNumber: page.page_number,
              elementId: el.id,
              snippet,
              elementType: el.element_type,
            });
          }
        } else if (el.element_type === 'sticker') {
          const props = el.properties as { sticker_id?: string; category?: string };
          if ((props.sticker_id ?? '').toLowerCase().includes(q) || (props.category ?? '').toLowerCase().includes(q)) {
            found.push({
              pageIndex,
              pageNumber: page.page_number,
              elementId: el.id,
              snippet: `Sticker: ${props.category ?? ''} ${props.sticker_id ?? ''}`,
              elementType: 'sticker',
            });
          }
        }
      }
    });

    return found.slice(0, 50); // Limit to 50 results
  }, [query, pages, pagesElements]);

  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-3">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher dans le journal..."
          className="flex-1 text-sm bg-background border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
          autoFocus
          aria-label="Rechercher dans le journal"
        />
        <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Fermer la recherche">
          <X className="w-4 h-4" />
        </button>
      </div>

      {query.length >= 2 && (
        <div className="max-h-64 overflow-y-auto">
          {results.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Aucun résultat pour &ldquo;{query}&rdquo;</p>
          ) : (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground mb-2">{results.length} résultat{results.length > 1 ? 's' : ''}</p>
              {results.map((r) => (
                <button
                  key={`${r.elementId}-${r.pageIndex}`}
                  onClick={() => { onGoToPage(r.pageIndex); onClose(); }}
                  className={cn(
                    'w-full text-left p-2 rounded-lg hover:bg-muted transition-smooth',
                    'border border-transparent hover:border-border'
                  )}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <FileText className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] font-medium text-primary">Page {r.pageNumber}</span>
                  </div>
                  <p className="text-xs text-foreground/80 line-clamp-2">{r.snippet}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
