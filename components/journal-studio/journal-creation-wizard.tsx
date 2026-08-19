'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Palette,
  FileText,
  Hash,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  createJournal,
  initializeJournalPages,
} from '@/lib/journal-studio/supabase';
import type { Journal, CoverType, PaperStyle } from '@/lib/journal-studio/types';
import { COVER_PRESETS, PAPER_PATTERNS } from '@/lib/journal-studio/types';

interface JournalCreationWizardProps {
  onComplete: (journal: Journal) => void;
  onCancel: () => void;
}

const STEPS = [
  { id: 'title', label: 'Titre', icon: BookOpen },
  { id: 'cover', label: 'Couverture', icon: Palette },
  { id: 'paper', label: 'Papier', icon: FileText },
  { id: 'pages', label: 'Pages', icon: Hash },
  { id: 'confirm', label: 'Créer', icon: Check },
];

const PAPER_STYLES: { value: PaperStyle; label: string; preview: string }[] = [
  { value: 'blank', label: 'Blanc', preview: '' },
  { value: 'lined', label: 'Ligné', preview: 'repeating-linear-gradient(transparent, transparent 31px, #e5e5e5 31px, #e5e5e5 32px)' },
  { value: 'dotted', label: 'Pointillé', preview: 'radial-gradient(circle, #d1d1d1 1px, transparent 1px)' },
  { value: 'grid', label: 'Grillé', preview: 'linear-gradient(#e5e5e5 1px, transparent 1px), linear-gradient(90deg, #e5e5e5 1px, transparent 1px)' },
  { value: 'cream', label: 'Crème', preview: 'linear-gradient(135deg, #fdf6e3 0%, #f5e6d3 100%)' },
  { value: 'white', label: 'Blanc cassé', preview: 'linear-gradient(135deg, #ffffff 0%, #f8f8f8 100%)' },
  { value: 'pastel', label: 'Pastel', preview: 'linear-gradient(135deg, #f0e6ff 0%, #e6f0ff 100%)' },
  { value: 'dark', label: 'Sombre', preview: 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)' },
];

const PAGE_COUNTS = [1, 5, 10, 20, 50];

export function JournalCreationWizard({
  onComplete,
  onCancel,
}: JournalCreationWizardProps) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [coverType, setCoverType] = useState<CoverType>('minimal');
  const [coverColor, setCoverColor] = useState('#E8D5C4');
  const [paperStyle, setPaperStyle] = useState<PaperStyle>('blank');
  const [pageCount, setPageCount] = useState(5);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canProceed = () => {
    switch (step) {
      case 0:
        return title.trim().length > 0;
      case 1:
        return true;
      case 2:
        return true;
      case 3:
        return pageCount > 0;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1 && canProceed()) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleCreate = async () => {
    try {
      setCreating(true);
      setError(null);

      // Create journal
      const journal = await createJournal({
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        cover_type: coverType,
        cover_color: coverColor,
        cover_gradient_from: COVER_PRESETS.find((p) => p.type === coverType)?.gradient_from,
        cover_gradient_to: COVER_PRESETS.find((p) => p.type === coverType)?.gradient_to,
        paper_style: paperStyle,
      });

      // Create pages
      await initializeJournalPages(journal.id, pageCount, paperStyle);

      onComplete(journal);
    } catch (err) {
      console.error('Failed to create journal:', err);
      setError('Impossible de créer le journal. Réessaie.');
    } finally {
      setCreating(false);
    }
  };

  const getCoverBackground = () => {
    const preset = COVER_PRESETS.find((p) => p.type === coverType);
    if (preset?.gradient_from && preset?.gradient_to) {
      return `linear-gradient(135deg, ${preset.gradient_from} 0%, ${preset.gradient_to} 100%)`;
    }
    return `linear-gradient(135deg, ${coverColor} 0%, ${coverColor}dd 100%)`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-smooth"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Nouveau journal</h1>
        </div>

        {/* Step indicator */}
        <div className="hidden sm:flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-smooth',
                  i === step
                    ? 'bg-primary text-primary-foreground'
                    : i < step
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {i < step ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <s.icon className="w-4 h-4" />
                )}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    'w-8 h-0.5 rounded-full transition-smooth',
                    i < step ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="max-w-2xl mx-auto"
          >
            {/* Step 0: Title */}
            {step === 0 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-foreground mb-2">
                    Comment veux-tu appeler ton journal ?
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Tu pourras modifier le titre plus tard.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Titre *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Mon journal"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 text-lg"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Sous-titre (optionnel)
                    </label>
                    <input
                      type="text"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      placeholder="Mes réflexions, idées, etc."
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Cover */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-foreground mb-2">
                    Choisis une couverture
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Tu pourras la changer plus tard.
                  </p>
                </div>

                {/* Preview */}
                <div className="flex justify-center">
                  <div
                    className="w-48 h-64 rounded-2xl shadow-lg flex flex-col justify-end p-4"
                    style={{ background: getCoverBackground() }}
                  >
                    <h3 className="text-lg font-semibold text-white line-clamp-2">
                      {title || 'Mon journal'}
                    </h3>
                    {subtitle && (
                      <p className="text-sm text-white/80 line-clamp-1 mt-1">
                        {subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {/* Cover options */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {COVER_PRESETS.map((preset) => (
                    <button
                      key={preset.type}
                      onClick={() => {
                        setCoverType(preset.type);
                        setCoverColor(preset.color);
                      }}
                      className={cn(
                        'p-3 rounded-xl border-2 transition-smooth text-center',
                        coverType === preset.type
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <div
                        className="w-full aspect-[3/4] rounded-lg mb-2"
                        style={{ background: preset.preview }}
                      />
                      <p className="text-xs font-medium text-foreground">{preset.name}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Paper */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-foreground mb-2">
                    Choisis le style de papier
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    C&apos;est l&apos;apparence de tes pages.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {PAPER_STYLES.map((paper) => (
                    <button
                      key={paper.value}
                      onClick={() => setPaperStyle(paper.value)}
                      className={cn(
                        'p-3 rounded-xl border-2 transition-smooth text-center',
                        paperStyle === paper.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <div
                        className="w-full aspect-square rounded-lg mb-2 bg-white"
                        style={{
                          backgroundImage: paper.preview,
                          backgroundSize: paper.value === 'grid' ? '20px 20px, 20px 20px' : undefined,
                        }}
                      />
                      <p className="text-xs font-medium text-foreground">{paper.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Pages */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-foreground mb-2">
                    Combien de pages ?
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Tu pourras en ajouter plus tard.
                  </p>
                </div>

                <div className="flex flex-wrap justify-center gap-3">
                  {PAGE_COUNTS.map((count) => (
                    <button
                      key={count}
                      onClick={() => setPageCount(count)}
                      className={cn(
                        'px-6 py-4 rounded-xl border-2 transition-smooth text-center min-w-[80px]',
                        pageCount === count
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <p className="text-2xl font-bold text-foreground">{count}</p>
                      <p className="text-xs text-muted-foreground">
                        page{count > 1 ? 's' : ''}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Confirm */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-foreground mb-2">
                    Récapitulatif
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Vérifie que tout est bon avant de créer.
                  </p>
                </div>

                <Card padding="md" className="max-w-sm mx-auto">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-20 h-28 rounded-xl flex-shrink-0"
                        style={{ background: getCoverBackground() }}
                      />
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">
                          {title}
                        </h3>
                        {subtitle && (
                          <p className="text-sm text-muted-foreground">{subtitle}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Couverture</p>
                        <p className="font-medium text-foreground">
                          {COVER_PRESETS.find((p) => p.type === coverType)?.name}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Papier</p>
                        <p className="font-medium text-foreground">
                          {PAPER_STYLES.find((p) => p.value === paperStyle)?.label}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Pages</p>
                        <p className="font-medium text-foreground">{pageCount}</p>
                      </div>
                    </div>
                  </div>
                </Card>

                {error && (
                  <p className="text-sm text-destructive text-center">{error}</p>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-4 border-t border-border">
        <Button
          variant="ghost"
          onClick={step === 0 ? onCancel : handleBack}
          className="gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          {step === 0 ? 'Annuler' : 'Retour'}
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={handleNext} disabled={!canProceed()} className="gap-2">
            Suivant
            <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={handleCreate}
            disabled={creating}
            className="gap-2 min-w-[120px]"
          >
            {creating ? (
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4" />
                Créer mon journal
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
