// =====================================================================
// /journal — Journal Studio Library → Editor (with canvas/document detection)
// =====================================================================

'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { JournalLibrary } from '@/components/journal-studio/journal-library';
import { JournalEditor } from '@/components/journal-studio/journal-editor';
import { DocumentEditor } from '@/components/journal-studio/document-editor';
import type { Journal } from '@/lib/journal-studio/types';
import { getJournalPages } from '@/lib/journal-studio/supabase';
import { getPageElements } from '@/lib/journal-studio/supabase';

export default function JournalPage() {
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [journalType, setJournalType] = useState<'document' | 'canvas' | 'detecting'>('detecting');
  const detectedRef = useRef<string | null>(null);

  // Detect journal type: document vs legacy canvas
  useEffect(() => {
    if (!selectedJournal) { setJournalType('detecting'); return; }
    if (detectedRef.current === selectedJournal.id) return;
    detectedRef.current = selectedJournal.id;

    let cancelled = false;
    (async () => {
      try {
        const pages = await getJournalPages(selectedJournal.id);
        if (cancelled || pages.length === 0) {
          if (!cancelled) setJournalType('document');
          return;
        }
        // Check the first page for canvas elements
        const firstPage = pages[0];
        const elements = await getPageElements(firstPage.id);
        if (cancelled) return;

        // If the page has positioned canvas elements (x, y), it's a legacy journal
        const hasCanvasElements = elements.length > 0 && elements.some((el) => {
          return typeof (el as unknown as Record<string, unknown>).x === 'number';
        });
        setJournalType(hasCanvasElements ? 'canvas' : 'document');
      } catch {
        if (!cancelled) setJournalType('document');
      }
    })();
    return () => { cancelled = true; };
  }, [selectedJournal]);

  // Reset detection when user goes back
  const handleBack = () => {
    detectedRef.current = null;
    setJournalType('detecting');
    setSelectedJournal(null);
  };

  if (selectedJournal) {
    if (journalType === 'detecting') {
      return (
        <div className="flex items-center justify-center h-full bg-background">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }

    if (journalType === 'canvas') {
      return (
        <JournalEditor
          journalId={selectedJournal.id}
          onBack={handleBack}
        />
      );
    }

    return (
      <DocumentEditor
        journalId={selectedJournal.id}
        onBack={handleBack}
      />
    );
  }

  return <JournalLibrary onOpenJournal={setSelectedJournal} />;
}
