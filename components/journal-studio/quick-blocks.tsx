'use client';

import { Type, Quote, CheckSquare, Calendar, Camera, Minus, StickyNote, Heart, Target, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QuickBlock {
  id: string;
  label: string;
  icon: React.ElementType;
  type: 'text' | 'shape';
  properties: Record<string, unknown>;
}

export const QUICK_BLOCKS: QuickBlock[] = [
  {
    id: 'title',
    label: 'Titre',
    icon: Type,
    type: 'text',
    properties: { content: 'Titre', preset: 'title', font_size: 28, font_weight: 'bold', color: '#1a1a1a', font_family: 'Playfair Display', text_align: 'left' },
  },
  {
    id: 'subtitle',
    label: 'Sous-titre',
    icon: FileText,
    type: 'text',
    properties: { content: 'Sous-titre', preset: 'subtitle', font_size: 18, font_weight: 'bold', color: '#4a5568', font_family: 'Inter', text_align: 'left' },
  },
  {
    id: 'body',
    label: 'Texte',
    icon: FileText,
    type: 'text',
    properties: { content: '', preset: 'body', font_size: 15, color: '#1a1a1a', font_family: 'Inter', text_align: 'left', line_height: 1.6 },
  },
  {
    id: 'quote',
    label: 'Citation',
    icon: Quote,
    type: 'text',
    properties: { content: '"Citation..."', preset: 'quote', font_size: 16, font_style: 'italic', color: '#4a5568', font_family: 'Georgia', background_color: '#f7fafc', background_opacity: 0.8, padding: 16, border_radius: 8, text_align: 'left' },
  },
  {
    id: 'checklist',
    label: 'Checklist',
    icon: CheckSquare,
    type: 'text',
    properties: { content: '☐ Tâche 1\n☐ Tâche 2\n☐ Tâche 3', preset: 'body', font_size: 14, color: '#1a1a1a', font_family: 'Inter', text_align: 'left', line_height: 1.8 },
  },
  {
    id: 'date',
    label: 'Date',
    icon: Calendar,
    type: 'text',
    properties: { content: new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), preset: 'caption', font_size: 13, color: '#718096', font_family: 'Inter', text_align: 'center' },
  },
  {
    id: 'photo',
    label: 'Zone photo',
    icon: Camera,
    type: 'shape',
    properties: { shape_type: 'rectangle', fill: '#f7fafc', stroke: '#e2e8f0', stroke_width: 2 },
  },
  {
    id: 'separator',
    label: 'Séparation',
    icon: Minus,
    type: 'text',
    properties: { content: '———————————', preset: 'body', font_size: 12, color: '#cbd5e0', font_family: 'Inter', text_align: 'center' },
  },
  {
    id: 'note',
    label: 'Note',
    icon: StickyNote,
    type: 'text',
    properties: { content: '', preset: 'note', font_size: 14, color: '#744210', font_family: 'Inter', background_color: '#fefcbf', background_opacity: 0.6, padding: 12, border_radius: 6, text_align: 'left' },
  },
  {
    id: 'card',
    label: 'Carte',
    icon: Heart,
    type: 'shape',
    properties: { shape_type: 'rounded-rectangle', fill: '#fff5f5', stroke: '#feb2b2', stroke_width: 1 },
  },
  {
    id: 'goals',
    label: 'Objectifs',
    icon: Target,
    type: 'text',
    properties: { content: '🎯 Mes objectifs :\n\n1. \n2. \n3. ', preset: 'body', font_size: 14, color: '#1a1a1a', font_family: 'Inter', text_align: 'left', line_height: 1.8 },
  },
];

interface QuickBlocksPanelProps {
  onAddBlock: (block: QuickBlock) => void;
  onClose: () => void;
}

export function QuickBlocksPanel({ onAddBlock, onClose }: QuickBlocksPanelProps) {
  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium text-muted-foreground">Blocs rapides</span>
        <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground text-xs">✕</button>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {QUICK_BLOCKS.map((block) => {
          const Icon = block.icon;
          return (
            <button
              key={block.id}
              onClick={() => { onAddBlock(block); onClose(); }}
              className={cn(
                'flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border',
                'bg-card hover:bg-primary/5 hover:border-primary/30 transition-smooth',
                'text-center group'
              )}
              aria-label={`Ajouter ${block.label}`}
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-smooth">
                <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground leading-tight">{block.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
