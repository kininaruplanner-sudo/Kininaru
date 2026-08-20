// =====================================================================
// /journal — Journal Studio Library → Editor
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
