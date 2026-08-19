// =====================================================================
// /journal — Journal Studio (replaces the old daily journal entry view)
//
// The old journal (journal_entries table, JournalClient component) is
// still available at /journal/daily for backward compatibility.
// The primary /journal route now shows the Journal Studio Library.
// =====================================================================

'use client';

import { useState } from 'react';
import { JournalLibrary } from '@/components/journal-studio/journal-library';
import { JournalEditor } from '@/components/journal-studio/journal-editor';
import type { Journal } from '@/lib/journal-studio/types';

export default function JournalPage() {
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);

  if (selectedJournal) {
    return (
      <JournalEditor
        journalId={selectedJournal.id}
        onBack={() => setSelectedJournal(null)}
      />
    );
  }

  return <JournalLibrary onOpenJournal={setSelectedJournal} />;
}
