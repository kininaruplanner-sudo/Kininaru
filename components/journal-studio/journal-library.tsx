'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Plus, Star, Trash2, Copy, Archive, MoreVertical,
  Search, Grid3X3, List, X, Edit3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  getJournals, deleteJournal, updateJournal, duplicateJournal,
} from '@/lib/journal-studio/supabase';
import type { Journal } from '@/lib/journal-studio/types';
import { COVER_PRESETS } from '@/lib/journal-studio/types';
import { JournalCreationWizard } from './journal-creation-wizard';

interface JournalLibraryProps {
  onOpenJournal: (journal: Journal) => void;
}

export function JournalLibrary({ onOpenJournal }: JournalLibraryProps) {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showWizard, setShowWizard] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ journal: Journal; x: number; y: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const loadJournals = useCallback(async () => {
    try {
      setLoading(true);
      setJournals(await getJournals());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadJournals(); }, [loadJournals]);

  const filtered = journals.filter((j) => j.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleFavorite = async (j: Journal) => {
    await updateJournal(j.id, { is_favorite: !j.is_favorite });
    setJournals((prev) => prev.map((x) => x.id === j.id ? { ...x, is_favorite: !x.is_favorite } : x));
  };

  const handleDuplicate = async (j: Journal) => {
    try {
      const dup = await duplicateJournal(j.id);
      setJournals((prev) => [dup, ...prev]);
    } catch { /* silent */ }
  };

  const handleArchive = async (j: Journal) => {
    await updateJournal(j.id, { is_archived: true });
    setJournals((prev) => prev.filter((x) => x.id !== j.id));
  };

  const handleDelete = async (j: Journal) => {
    if (!window.confirm(`Supprimer "${j.title}" ? Cette action est irréversible.`)) return;
    await deleteJournal(j.id);
    setJournals((prev) => prev.filter((x) => x.id !== j.id));
  };

  const handleRename = async (j: Journal) => {
    if (!renameValue.trim() || renameValue.trim() === j.title) { setRenamingId(null); return; }
    await updateJournal(j.id, { title: renameValue.trim() });
    setJournals((prev) => prev.map((x) => x.id === j.id ? { ...x, title: renameValue.trim() } : x));
    setRenamingId(null);
  };

  const getCoverBg = (j: Journal) => {
    const preset = COVER_PRESETS.find((p) => p.type === j.cover_type);
    if (j.cover_type === 'custom' && j.cover_image_url) return `url(${j.cover_image_url}) center/cover`;
    if (j.cover_gradient_from && j.cover_gradient_to) return `linear-gradient(135deg, ${j.cover_gradient_from} 0%, ${j.cover_gradient_to} 100%)`;
    return preset?.preview ?? `linear-gradient(135deg, ${j.cover_color} 0%, ${j.cover_color}dd 100%)`;
  };

  if (showWizard) {
    return (
      <JournalCreationWizard
        onComplete={(journal) => { setShowWizard(false); setJournals((prev) => [journal, ...prev]); onOpenJournal(journal); }}
        onCancel={() => setShowWizard(false)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><BookOpen className="w-5 h-5 text-primary" /></div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Mes Journaux</h1>
            <p className="text-xs text-muted-foreground">{journals.length} journal{journals.length > 1 ? 'x' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Rechercher…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-3 py-2 w-48 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>}
          </div>
          <div className="hidden sm:flex items-center gap-1 p-1 rounded-lg bg-muted">
            <button onClick={() => setViewMode('grid')} className={cn('p-1.5 rounded-md', viewMode === 'grid' ? 'bg-background shadow-sm' : 'text-muted-foreground')}><Grid3X3 className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('list')} className={cn('p-1.5 rounded-md', viewMode === 'list' ? 'bg-background shadow-sm' : 'text-muted-foreground')}><List className="w-4 h-4" /></button>
          </div>
          <Button onClick={() => setShowWizard(true)} className="gap-2"><Plus className="w-4 h-4" /><span className="hidden sm:inline">Nouveau journal</span></Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center max-w-sm">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4"><BookOpen className="w-8 h-8 text-primary" /></div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{searchQuery ? 'Aucun résultat' : 'Crée ton premier journal'}</h3>
              <p className="text-sm text-muted-foreground mb-4">{searchQuery ? 'Aucun journal ne correspond.' : 'Un espace à toi pour écrire, dessiner, réfléchir et créer.'}</p>
              {!searchQuery && <Button onClick={() => setShowWizard(true)} className="gap-2"><Plus className="w-4 h-4" />Nouveau journal</Button>}
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map((j) => (
              <motion.div key={j.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
                <button onClick={() => onOpenJournal(j)} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ journal: j, x: e.clientX, y: e.clientY }); }} className="w-full text-left group">
                  <Card padding="sm" className="overflow-hidden transition-smooth hover:shadow-lg hover:scale-[1.02] p-0">
                    <div className="aspect-[3/4] relative" style={{ background: getCoverBg(j) }}>
                      {j.is_favorite && <div className="absolute top-2 right-2"><Star className="w-5 h-5 text-yellow-400 fill-yellow-400" /></div>}
                      <div className="absolute inset-0 flex flex-col justify-end p-3 bg-gradient-to-t from-black/50 to-transparent">
                        {renamingId === j.id ? (
                          <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onBlur={() => handleRename(j)} onKeyDown={(e) => { if (e.key === 'Enter') handleRename(j); if (e.key === 'Escape') setRenamingId(null); }} onClick={(e) => e.stopPropagation()} className="text-sm font-semibold text-white bg-transparent border-b border-white/50 focus:outline-none w-full" />
                        ) : (
                          <h3 className="text-sm font-semibold text-white line-clamp-2">{j.title}</h3>
                        )}
                        {j.subtitle && <p className="text-xs text-white/80 line-clamp-1 mt-0.5">{j.subtitle}</p>}
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-xs text-muted-foreground">{j.page_count} page{j.page_count > 1 ? 's' : ''} · {new Date(j.updated_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </Card>
                </button>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((j) => (
              <motion.div key={j.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
                <button onClick={() => onOpenJournal(j)} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ journal: j, x: e.clientX, y: e.clientY }); }} className="w-full text-left group">
                  <Card padding="sm" className="flex items-center gap-4 transition-smooth hover:shadow-md">
                    <div className="w-12 h-16 rounded-lg flex-shrink-0" style={{ background: getCoverBg(j) }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground truncate">{j.title}</h3>
                        {j.is_favorite && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{j.page_count} page{j.page_count > 1 ? 's' : ''} · {new Date(j.updated_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <button onClick={(e) => { e.stopPropagation(); handleFavorite(j); }} className="p-2 rounded-lg hover:bg-muted"><Star className={cn('w-4 h-4', j.is_favorite && 'fill-yellow-400 text-yellow-400')} /></button>
                      <button onClick={(e) => { e.stopPropagation(); setContextMenu({ journal: j, x: e.clientX, y: e.clientY }); }} className="p-2 rounded-lg hover:bg-muted"><MoreVertical className="w-4 h-4" /></button>
                    </div>
                  </Card>
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Context menu */}
      <AnimatePresence>
        {contextMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed z-50 w-48 rounded-xl border border-border bg-card shadow-lg p-1" style={{ left: Math.min(contextMenu.x, window.innerWidth - 200), top: Math.min(contextMenu.y, window.innerHeight - 250) }}>
              <button onClick={() => { setRenamingId(contextMenu.journal.id); setRenameValue(contextMenu.journal.title); setContextMenu(null); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted"><Edit3 className="w-4 h-4" />Renommer</button>
              <button onClick={() => { handleFavorite(contextMenu.journal); setContextMenu(null); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted"><Star className="w-4 h-4" />{contextMenu.journal.is_favorite ? 'Retirer favori' : 'Favori'}</button>
              <button onClick={() => { handleDuplicate(contextMenu.journal); setContextMenu(null); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted"><Copy className="w-4 h-4" />Dupliquer</button>
              <button onClick={() => { handleArchive(contextMenu.journal); setContextMenu(null); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-muted"><Archive className="w-4 h-4" />Archiver</button>
              <div className="my-1 border-t border-border" />
              <button onClick={() => { handleDelete(contextMenu.journal); setContextMenu(null); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" />Supprimer</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
