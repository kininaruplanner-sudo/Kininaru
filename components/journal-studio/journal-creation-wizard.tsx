'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Palette,
  FileText,
  Hash,
  Check,
  Upload,
  X,
  Pen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  createJournal,
  initializeJournalPages,
  uploadJournalCover,
  updateJournal,
} from '@/lib/journal-studio/supabase';
import type { Journal, CoverType, PaperStyle } from '@/lib/journal-studio/types';
import { COVER_PRESETS, PAPER_PATTERNS, PAPER_BACKGROUND_COLORS } from '@/lib/journal-studio/types';
import { devLog } from '@/lib/journal-studio/sync/indexed-db';
import { JOURNAL_TEMPLATES, getTemplateById, type JournalTemplate } from '@/lib/journal-studio/templates';

interface JournalCreationWizardProps {
  onComplete: (journal: Journal) => void;
  onCancel: () => void;
}

const STEPS = [
  { id: 'template', label: 'Modèle', icon: FileText },
  { id: 'title', label: 'Titre', icon: BookOpen },
  { id: 'cover', label: 'Couverture', icon: Palette },
  { id: 'paper', label: 'Papier', icon: FileText },
  { id: 'pages', label: 'Pages', icon: Hash },
  { id: 'confirm', label: 'Créer', icon: Check },
];

const PAPER_STYLES: { value: PaperStyle; label: string; preview: string; bg: string }[] = [
  { value: 'blank', label: 'Blanc', preview: '', bg: '#ffffff' },
  { value: 'lined', label: 'Ligné', preview: 'repeating-linear-gradient(transparent, transparent 31px, #e5e5e5 31px, #e5e5e5 32px)', bg: '#ffffff' },
  { value: 'dotted', label: 'Pointillé', preview: 'radial-gradient(circle, #d1d1d1 1px, transparent 1px)', bg: '#ffffff' },
  { value: 'grid', label: 'Grillé', preview: 'linear-gradient(#e5e5e5 1px, transparent 1px), linear-gradient(90deg, #e5e5e5 1px, transparent 1px)', bg: '#ffffff' },
  { value: 'cream', label: 'Crème', preview: '', bg: '#fdf6e3' },
  { value: 'white', label: 'Blanc cassé', preview: '', bg: '#f8f8f8' },
  { value: 'pastel', label: 'Pastel', preview: '', bg: '#f0e6ff' },
  { value: 'dark', label: 'Sombre', preview: '', bg: '#1a202c' },
  { value: 'kraft', label: 'Kraft', preview: '', bg: '#c4a882' },
  { value: 'rose', label: 'Rose', preview: '', bg: '#fff0f3' },
  { value: 'sky', label: 'Ciel', preview: '', bg: '#f0f9ff' },
  { value: 'lavender', label: 'Lavande', preview: '', bg: '#f5f0ff' },
];

const PAGE_COUNTS = [5, 10, 20, 30, 50];

const COVER_COLORS = [
  '#E8D5C4', '#D4C4B4', '#E8D4F2', '#D4E8F2', '#667eea',
  '#F5E6D3', '#2C3E50', '#FFB7C5', '#5B86E5', '#1A1A2E',
  '#FF6B6B', '#38a169', '#805ad5', '#d69e2e', '#e53e3e',
];

export function JournalCreationWizard({ onComplete, onCancel }: JournalCreationWizardProps) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<JournalTemplate | null>(null);
  const [coverType, setCoverType] = useState<CoverType>('minimal');
  const [coverColor, setCoverColor] = useState('#E8D5C4');
  const [coverGradientFrom, setCoverGradientFrom] = useState<string | undefined>();
  const [coverGradientTo, setCoverGradientTo] = useState<string | undefined>();
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [paperStyle, setPaperStyle] = useState<PaperStyle>('blank');
  const [pageCount, setPageCount] = useState(10);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<File | null>(null);

  const applyTemplate = (template: JournalTemplate) => {
    setSelectedTemplate(template);
    setCoverType(template.cover_type);
    setCoverColor(template.cover_color);
    setCoverGradientFrom(template.cover_gradient_from);
    setCoverGradientTo(template.cover_gradient_to);
    setPaperStyle(template.paper_style);
  };

  const canProceed = () => {
    switch (step) {
      case 0: return title.trim().length > 0;
      case 1: return true;
      case 2: return true;
      case 3: return pageCount > 0;
      case 4: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1 && canProceed()) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleCoverImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    coverFileRef.current = file;
    const previewUrl = URL.createObjectURL(file);
    setCoverImageUrl(previewUrl);
    setCoverType('custom');
  }, []);

  const handleCreate = async () => {
    try {
      setCreating(true);
      setError(null);

      const journal = await createJournal({
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        cover_type: coverType,
        cover_color: coverColor,
        cover_gradient_from: coverGradientFrom,
        cover_gradient_to: coverGradientTo,
        paper_style: paperStyle,
      });

      await initializeJournalPages(journal.id, pageCount, paperStyle);

      // Upload cover image to storage if user selected one
      if (coverFileRef.current && journal.id) {
        try {
          const coverUrl = await uploadJournalCover(coverFileRef.current, journal.id);
          await updateJournal(journal.id, { cover_image_url: coverUrl });
          journal.cover_image_url = coverUrl;
        } catch {
          devLog('WIZARD', 'Cover upload failed, journal created without image');
        }
      }

      onComplete(journal);
    } catch {
      setError('Impossible de créer le journal. Réessaie.');
    } finally {
      setCreating(false);
    }
  };

  const getCoverStyle = (): React.CSSProperties => {
    if (coverImageUrl) {
      return {
        backgroundImage: `url(${coverImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    if (coverGradientFrom && coverGradientTo) {
      return { background: `linear-gradient(135deg, ${coverGradientFrom} 0%, ${coverGradientTo} 100%)` };
    }
    return { background: `linear-gradient(135deg, ${coverColor} 0%, ${coverColor}dd 100%)` };
  };

  const getPaperStyle = (): React.CSSProperties => {
    const s = PAPER_STYLES.find((p) => p.value === paperStyle);
    return {
      backgroundColor: s?.bg ?? '#ffffff',
      backgroundImage: s?.preview || undefined,
      backgroundSize: paperStyle === 'grid' ? '20px 20px, 20px 20px' : undefined,
    };
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-smooth" aria-label="Annuler">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Nouveau journal</h1>
        </div>

        {/* Step indicator */}
        <div className="hidden sm:flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-smooth',
                i === step ? 'bg-primary text-primary-foreground' : i < step ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              )}>
                {i < step ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
              </div>
              {i < STEPS.length - 1 && <div className={cn('w-8 h-0.5 rounded-full transition-smooth', i < step ? 'bg-primary' : 'bg-muted')} />}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-auto">
        {/* Left: Form */}
        <div className="flex-1 p-6 overflow-auto">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="title" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <h2 className="text-xl font-semibold text-foreground mb-2">Quel est le nom de ton journal ?</h2>
                <p className="text-sm text-muted-foreground mb-6">Choisis un titre qui te plaît.</p>
                <div className="space-y-4 max-w-md">
                  <div>
                    <label htmlFor="journal-title" className="text-sm font-medium text-foreground mb-1 block">Titre *</label>
                    <input
                      id="journal-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Mon journal 2026"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-lg placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      autoFocus
                      maxLength={60}
                    />
                  </div>
                  <div>
                    <label htmlFor="journal-subtitle" className="text-sm font-medium text-foreground mb-1 block">Sous-titre <span className="text-muted-foreground">(optionnel)</span></label>
                    <input
                      id="journal-subtitle"
                      type="text"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      placeholder="Mes pensées, mes idées..."
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      maxLength={100}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="cover" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <h2 className="text-xl font-semibold text-foreground mb-2">Choisis ta couverture</h2>
                <p className="text-sm text-muted-foreground mb-6">C&apos;est la première chose qu&apos;on voit de ton journal.</p>

                {/* Upload custom cover */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full max-w-md p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/30 hover:bg-muted/50 transition-smooth mb-6 flex items-center justify-center gap-3"
                >
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Importer ma propre image</span>
                </button>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleCoverImageUpload} className="sr-only" />

                {/* Color picker */}
                <div className="mb-6">
                  <p className="text-sm font-medium text-muted-foreground mb-3">Ou choisir une couleur :</p>
                  <div className="flex flex-wrap gap-2">
                    {COVER_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => { setCoverColor(c); setCoverType('minimal'); setCoverImageUrl(null); }}
                        className={cn(
                          'w-10 h-10 rounded-full border-2 transition-smooth',
                          coverColor === c && !coverImageUrl ? 'border-primary scale-110 shadow-md' : 'border-transparent hover:scale-110'
                        )}
                        style={{ backgroundColor: c }}
                        aria-label={`Couleur ${c}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Gradient presets */}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3">Ou un dégradé :</p>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {COVER_PRESETS.filter((p) => p.gradient_from && p.gradient_to).map((preset) => (
                      <button
                        key={preset.type}
                        onClick={() => {
                          setCoverType(preset.type);
                          setCoverColor(preset.color);
                          setCoverGradientFrom(preset.gradient_from);
                          setCoverGradientTo(preset.gradient_to);
                          setCoverImageUrl(null);
                        }}
                        className={cn(
                          'h-16 rounded-lg border-2 transition-smooth',
                          coverType === preset.type && !coverImageUrl ? 'border-primary shadow-md' : 'border-border hover:border-primary/50'
                        )}
                        style={{ background: preset.preview }}
                      />
                    ))}
                  </div>
                </div>

                {coverImageUrl && (
                  <button onClick={() => { setCoverImageUrl(null); coverFileRef.current = null; setCoverType('minimal'); }} className="mt-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" /> Retirer l&apos;image
                  </button>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="paper" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <h2 className="text-xl font-semibold text-foreground mb-2">Choisis ton papier</h2>
                <p className="text-sm text-muted-foreground mb-6">Le papier sur lequel tu écriras.</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-w-xl">
                  {PAPER_STYLES.map((paper) => (
                    <button
                      key={paper.value}
                      onClick={() => setPaperStyle(paper.value)}
                      className={cn(
                        'group relative h-28 rounded-xl border-2 transition-smooth overflow-hidden',
                        paperStyle === paper.value ? 'border-primary shadow-md ring-2 ring-primary/20' : 'border-border hover:border-primary/50'
                      )}
                    >
                      <div className="absolute inset-0" style={{ backgroundColor: paper.bg, backgroundImage: paper.preview || undefined, backgroundSize: paper.value === 'grid' ? '20px 20px, 20px 20px' : undefined }} />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/40 to-transparent p-2 pt-6">
                        <span className="text-xs font-medium text-white">{paper.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="pages" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <h2 className="text-xl font-semibold text-foreground mb-2">Combien de pages ?</h2>
                <p className="text-sm text-muted-foreground mb-6">Tu pourras toujours en ajouter plus tard.</p>
                <div className="flex flex-wrap gap-3">
                  {PAGE_COUNTS.map((count) => (
                    <button
                      key={count}
                      onClick={() => setPageCount(count)}
                      className={cn(
                        'px-6 py-3 rounded-xl text-lg font-medium border-2 transition-smooth',
                        pageCount === count ? 'border-primary bg-primary text-primary-foreground shadow-md' : 'border-border bg-card hover:border-primary/50 text-foreground'
                      )}
                    >
                      {count}
                    </button>
                  ))}
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  {pageCount} pages × {paperStyle === 'lined' ? 'ligné' : paperStyle === 'grid' ? 'grillé' : paperStyle === 'dotted' ? 'pointillé' : paperStyle} = {pageCount} feuilles
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="confirm" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <h2 className="text-xl font-semibold text-foreground mb-2">Prêt à créer ton journal ?</h2>
                <p className="text-sm text-muted-foreground mb-6">Récapitulatif :</p>
                <div className="space-y-3 max-w-md">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                    <BookOpen className="w-5 h-5 text-primary" />
                    <div>
                      <div className="text-sm font-medium text-foreground">{title}</div>
                      {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                    <Palette className="w-5 h-5 text-primary" />
                    <div className="w-8 h-8 rounded-lg" style={getCoverStyle()} />
                    <span className="text-sm text-foreground">Couverture</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="text-sm text-foreground">{PAPER_STYLES.find((p) => p.value === paperStyle)?.label ?? paperStyle}</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                    <Hash className="w-5 h-5 text-primary" />
                    <span className="text-sm text-foreground">{pageCount} pages</span>
                  </div>
                </div>

                {error && (
                  <div className="mt-4 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
                    {error}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: Live preview */}
        <div className="hidden lg:flex w-[340px] flex-col items-center justify-center p-8 border-l border-border bg-muted/20">
          <p className="text-xs text-muted-foreground mb-4 font-medium">Aperçu</p>

          {/* Book with shadow and spine */}
          <div className="relative" style={{ perspective: '800px' }}>
            {/* Shadow */}
            <div className="absolute -inset-4 bg-black/10 rounded-2xl blur-xl" />

            {/* Book body */}
            <div className="relative flex">
              {/* Spine */}
              <div className="w-4 rounded-l-lg" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.05) 100%)' }} />

              {/* Cover */}
              <div
                className="relative w-[200px] h-[280px] rounded-r-lg overflow-hidden border border-black/5"
                style={{
                  ...getCoverStyle(),
                  boxShadow: '4px 4px 12px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                {/* Title overlay */}
                <div className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-black/30 to-transparent">
                  <h3 className="text-white text-lg font-bold leading-tight drop-shadow-md">{title || 'Mon journal'}</h3>
                  {subtitle && <p className="text-white/80 text-xs mt-1 drop-shadow-md">{subtitle}</p>}
                </div>
              </div>

              {/* Page edges */}
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="absolute rounded-r-sm bg-white/90 border-l border-black/5"
                  style={{
                    width: 200 - (i + 1) * 2,
                    height: 280 - (i + 1) * 2,
                    right: -(i + 1) * 3,
                    top: (i + 1) * 1,
                    boxShadow: '1px 0 3px rgba(0,0,0,0.05)',
                  }}
                />
              ))}
            </div>

            {/* Page count badge */}
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full shadow-md">
              {pageCount} pages
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-4 border-t border-border">
        <button onClick={step === 0 ? onCancel : handleBack} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth">
          <ChevronLeft className="w-4 h-4" />
          {step === 0 ? 'Annuler' : 'Retour'}
        </button>

        <div className="flex items-center gap-2">
          {/* Mobile step indicator */}
          <span className="text-xs text-muted-foreground sm:hidden">{step + 1}/{STEPS.length}</span>

          {step < STEPS.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-smooth',
                canProceed()
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              Suivant
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-smooth"
            >
              {creating ? (
                <>
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Pen className="w-4 h-4" />
                  Créer mon journal
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
