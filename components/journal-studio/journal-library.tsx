'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Plus,
  Star,
  Trash2,
  Copy,
  Archive,
  MoreVertical,
  Search,
  Grid3X3,
  List,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  getJournals,
  deleteJournal,
  updateJournal,
} from '@/lib/journal-studio/supabase';
import type { Journal, CoverType } from '@/lib/journal-studio/types';
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
  const [contextMenu, setContextMenu] = useState<{
    journal: Journal;
    x: number;
    y: number;
  } | null>(null);

  const loadJournals = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getJournals();
      setJournals(data);
    } catch (err) {
      console.error('Failed to load journals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJournals();
  }, [loadJournals]);

  const filteredJournals = journals.filter((j) =>
    j.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFavorite = async (journal: Journal) => {
    try {
      await updateJournal(journal.id, { is_favorite: !journal.is_favorite });
      setJournals((prev) =>
        prev.map((j) =>
          j.id === journal.id ? { ...j, is_favorite: !j.is_favorite } : j
        )
      );
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleDuplicate = async (journal: Journal) => {
    // TODO: Implement duplication
    console.log('Duplicate journal:', journal.id);
  };

  const handleArchive = async (journal: Journal) => {
    try {
      await updateJournal(journal.id, { is_archived: true });
      setJournals((prev) => prev.filter((j) => j.id !== journal.id));
    } catch (err) {
      console.error('Failed to archive journal:', err);
    }
  };

  const handleDelete = async (journal: Journal) => {
    if (!window.confirm(`Supprimer "${journal.title}" ? Cette action est irréversible.`)) {
      return;
    }
    try {
      await deleteJournal(journal.id);
      setJournals((prev) => prev.filter((j) => j.id !== journal.id));
    } catch (err) {
      console.error('Failed to delete journal:', err);
    }
  };

  const handleContextMenu = (journal: Journal, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ journal, x: e.clientX, y: e.clientY });
  };

  const getCoverBackground = (journal: Journal) => {
    const preset = COVER_PRESETS.find((p) => p.type === journal.cover_type);
    if (journal.cover_type === 'custom' && journal.cover_image_url) {
      return `url(${journal.cover_image_url}) center/cover`;
    }
    if (journal.cover_gradient_from && journal.cover_gradient_to) {
      return `linear-gradient(135deg, ${journal.cover_gradient_from} 0%, ${journal.cover_gradient_to} 100%)`;
    }
    return preset?.preview ?? `linear-gradient(135deg, ${journal.cover_color} 0%, ${journal.cover_color}dd 100%)`;
  };

  if (showWizard) {
    return (
      <JournalCreationWizard
        onComplete={(journal) => {
          setShowWizard(false);
          setJournals((prev) => [journal, ...prev]);
          onOpenJournal(journal);
        }}
        onCancel={() => setShowWizard(false)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Mes Journaux</h1>
            <p className="text-xs text-muted-foreground">
              {journals.length} journal{journals.length > 1 ? 'x' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-2 w-48 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* View mode */}
          <div className="hidden sm:flex items-center gap-1 p-1 rounded-lg bg-muted">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-1.5 rounded-md transition-smooth',
                viewMode === 'grid' ? 'bg-background shadow-sm' : 'text-muted-foreground'
              )}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-1.5 rounded-md transition-smooth',
                viewMode === 'list' ? 'bg-background shadow-sm' : 'text-muted-foreground'
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* New journal button */}
          <Button onClick={() => setShowWizard(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nouveau journal</span>
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground mt-3">Chargement...</p>
            </div>
          </div>
        ) : filteredJournals.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center max-w-sm">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchQuery ? 'Aucun résultat' : 'Crée ton premier journal'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery
                  ? 'Aucun journal ne correspond à ta recherche.'
                  : 'Un espace à toi pour écrire, dessiner, réfléchir et créer.'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setShowWizard(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Nouveau journal
                </Button>
              )}
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredJournals.map((journal) => (
              <motion.div
                key={journal.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <button
                  onClick={() => onOpenJournal(journal)}
                  onContextMenu={(e) => handleContextMenu(journal, e)}
                  className="w-full text-left group"
                >
                  <Card
                    padding="sm"
                    className="overflow-hidden transition-smooth hover:shadow-lg hover:scale-[1.02] cursor-pointer p-0"
                  >
                    {/* Cover */}
                    <div
                      className="aspect-[3/4] relative"
                      style={{ background: getCoverBackground(journal) }}
                    >
                      {/* Favorite badge */}
                      {journal.is_favorite && (
                        <div className="absolute top-2 right-2">
                          <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                        </div>
                      )}

                      {/* Title overlay */}
                      <div className="absolute inset-0 flex flex-col justify-end p-3 bg-gradient-to-t from-black/50 to-transparent">
                        <h3 className="text-sm font-semibold text-white line-clamp-2">
                          {journal.title}
                        </h3>
                        {journal.subtitle && (
                          <p className="text-xs text-white/80 line-clamp-1 mt-0.5">
                            {journal.subtitle}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="p-3">
                      <p className="text-xs text-muted-foreground">
                        {journal.page_count} page{journal.page_count > 1 ? 's' : ''} ·{' '}
                        {new Date(journal.updated_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </Card>
                </button>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredJournals.map((journal) => (
              <motion.div
                key={journal.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <button
                  onClick={() => onOpenJournal(journal)}
                  onContextMenu={(e) => handleContextMenu(journal, e)}
                  className="w-full text-left group"
                >
                  <Card
                    padding="sm"
                    className="flex items-center gap-4 transition-smooth hover:shadow-md cursor-pointer"
                  >
                    {/* Mini cover */}
                    <div
                      className="w-12 h-16 rounded-lg flex-shrink-0"
                      style={{ background: getCoverBackground(journal) }}
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground truncate">
                          {journal.title}
                        </h3>
                        {journal.is_favorite && (
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {journal.page_count} page{journal.page_count > 1 ? 'x' : ''} ·{' '}
                        {new Date(journal.updated_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-smooth">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFavorite(journal);
                        }}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                      >
                        <Star
                          className={cn(
                            'w-4 h-4',
                            journal.is_favorite && 'fill-yellow-400 text-yellow-400'
                          )}
                        />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleContextMenu(journal, e);
                        }}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
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
            <div
              className="fixed inset-0 z-40"
              onClick={() => setContextMenu(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="fixed z-50 w-48 rounded-xl border border-border bg-card shadow-lg p-1"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <button
                onClick={() => {
                  handleFavorite(contextMenu.journal);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-smooth"
              >
                <Star className="w-4 h-4" />
                {contextMenu.journal.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              </button>
              <button
                onClick={() => {
                  handleDuplicate(contextMenu.journal);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-smooth"
              >
                <Copy className="w-4 h-4" />
                Dupliquer
              </button>
              <button
                onClick={() => {
                  handleArchive(contextMenu.journal);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-smooth"
              >
                <Archive className="w-4 h-4" />
                Archiver
              </button>
              <div className="my-1 border-t border-border" />
              <button
                onClick={() => {
                  handleDelete(contextMenu.journal);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-smooth"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
