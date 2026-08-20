// =====================================================================
// Kininaru — Journal Templates
// =====================================================================
// Each template defines cover, paper, palette, and optional starter elements.
// All elements use standard JournalElement types — no parallel rendering system.

import type { PaperStyle, CoverType, TextPreset, ShapeType } from './types';

export interface JournalTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  cover_type: CoverType;
  cover_color: string;
  cover_gradient_from?: string;
  cover_gradient_to?: string;
  paper_style: PaperStyle;
  palette: {
    text: string;
    accent: string;
    background: string;
  };
  /** Starter elements for the first page */
  starter_elements?: Array<{
    type: 'text' | 'shape';
    x: number;
    y: number;
    width: number;
    height: number;
    properties: Record<string, unknown>;
  }>;
}

export const JOURNAL_TEMPLATES: JournalTemplate[] = [
  {
    id: 'daily',
    name: 'Journal quotidien',
    description: 'Pour écrire chaque jour',
    icon: '📔',
    cover_type: 'notebook',
    cover_color: '#2C3E50',
    cover_gradient_from: '#2C3E50',
    cover_gradient_to: '#34495E',
    paper_style: 'lined',
    palette: { text: '#1a1a1a', accent: '#3182ce', background: '#ffffff' },
    starter_elements: [
      { type: 'text', x: 40, y: 40, width: 515, height: 50, properties: { content: "Aujourd'hui", preset: 'title', font_size: 28, font_weight: 'bold', color: '#1a1a1a', font_family: 'Playfair Display' } },
      { type: 'text', x: 40, y: 100, width: 515, height: 30, properties: { content: new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), preset: 'caption', font_size: 14, color: '#718096', font_family: 'Inter' } },
    ],
  },
  {
    id: 'study',
    name: 'Journal d\'étude',
    description: 'Pour organiser ses révisions',
    icon: '📚',
    cover_type: 'gradient',
    cover_color: '#3182ce',
    cover_gradient_from: '#3182ce',
    cover_gradient_to: '#2b6cb0',
    paper_style: 'grid',
    palette: { text: '#1a365d', accent: '#3182ce', background: '#ffffff' },
    starter_elements: [
      { type: 'text', x: 40, y: 40, width: 515, height: 50, properties: { content: 'Mes révisions', preset: 'title', font_size: 24, font_weight: 'bold', color: '#1a365d', font_family: 'Inter' } },
      { type: 'text', x: 40, y: 100, width: 515, height: 200, properties: { content: '• Thème 1\n• Thème 2\n• Thème 3\n\nNotes :\n\n', preset: 'body', font_size: 14, color: '#1a1a1a', font_family: 'Inter', text_align: 'left' } },
    ],
  },
  {
    id: 'travel',
    name: 'Journal de voyage',
    description: 'Pour garder le souvenir de ses voyages',
    icon: '✈️',
    cover_type: 'gradient',
    cover_color: '#ed8936',
    cover_gradient_from: '#ed8936',
    cover_gradient_to: '#dd6b20',
    paper_style: 'cream',
    palette: { text: '#744210', accent: '#dd6b20', background: '#fdf6e3' },
    starter_elements: [
      { type: 'text', x: 40, y: 40, width: 515, height: 50, properties: { content: 'Mon voyage', preset: 'title', font_size: 28, font_weight: 'bold', color: '#744210', font_family: 'Playfair Display' } },
      { type: 'text', x: 40, y: 100, width: 515, height: 250, properties: { content: '📍 Lieu :\n📅 Date :\n🌤 Météo :\n\n', preset: 'body', font_size: 14, color: '#744210', font_family: 'Inter' } },
    ],
  },
  {
    id: 'mood',
    name: 'Journal d\'humeur',
    description: 'Pour suivre son état d\'esprit',
    icon: '🌸',
    cover_type: 'pastel',
    cover_color: '#E8D4F2',
    cover_gradient_from: '#E8D4F2',
    cover_gradient_to: '#D4E8F2',
    paper_style: 'pastel',
    palette: { text: '#553c9a', accent: '#805ad5', background: '#f0e6ff' },
    starter_elements: [
      { type: 'text', x: 40, y: 40, width: 515, height: 50, properties: { content: 'Comment me sens-je ?', preset: 'title', font_size: 24, font_weight: 'bold', color: '#553c9a', font_family: 'Playfair Display' } },
      { type: 'text', x: 40, y: 100, width: 515, height: 30, properties: { content: '😊  😐  😢  😤  🥰  😴', preset: 'body', font_size: 28, color: '#553c9a', text_align: 'center', font_family: 'Inter' } },
      { type: 'text', x: 40, y: 160, width: 515, height: 200, properties: { content: 'Aujourd\'hui je me sens...\n\n', preset: 'journal', font_size: 15, color: '#553c9a', font_family: 'Georgia', line_height: 1.8 } },
    ],
  },
  {
    id: 'reading',
    name: 'Journal de lecture',
    description: 'Pour noter ses lectures',
    icon: '📖',
    cover_type: 'paper',
    cover_color: '#F5E6D3',
    paper_style: 'cream',
    palette: { text: '#744210', accent: '#9b2c2c', background: '#fdf6e3' },
    starter_elements: [
      { type: 'text', x: 40, y: 40, width: 515, height: 50, properties: { content: 'Ma lecture', preset: 'title', font_size: 28, font_weight: 'bold', color: '#744210', font_family: 'Playfair Display' } },
      { type: 'text', x: 40, y: 100, width: 515, height: 250, properties: { content: '📖 Titre :\n✍️ Auteur :\n⭐ Note : /5\n\nRésumé :\n\n\n\n\nImpressions :\n\n\n', preset: 'body', font_size: 14, color: '#744210', font_family: 'Inter' } },
    ],
  },
  {
    id: 'gratitude',
    name: 'Journal de gratitude',
    description: 'Pour cultiver la reconnaissance',
    icon: '🙏',
    cover_type: 'gradient',
    cover_color: '#d69e2e',
    cover_gradient_from: '#d69e2e',
    cover_gradient_to: '#ecc94b',
    paper_style: 'cream',
    palette: { text: '#744210', accent: '#d69e2e', background: '#fdf6e3' },
    starter_elements: [
      { type: 'text', x: 40, y: 40, width: 515, height: 50, properties: { content: 'Je suis reconnaissant(e) pour...', preset: 'title', font_size: 24, font_weight: 'bold', color: '#744210', font_family: 'Playfair Display' } },
      { type: 'text', x: 40, y: 100, width: 515, height: 300, properties: { content: '1. \n\n2. \n\n3. \n\n', preset: 'body', font_size: 16, color: '#744210', font_family: 'Inter', line_height: 2.0 } },
    ],
  },
  {
    id: 'ideas',
    name: 'Carnet d\'idées',
    description: 'Pour capturer ses idées',
    icon: '💡',
    cover_type: 'colorful',
    cover_color: '#FF6B6B',
    cover_gradient_from: '#FF6B6B',
    cover_gradient_to: '#4ECDC4',
    paper_style: 'dotted',
    palette: { text: '#1a1a1a', accent: '#FF6B6B', background: '#ffffff' },
    starter_elements: [
      { type: 'text', x: 40, y: 40, width: 515, height: 50, properties: { content: '💡 Idée du jour', preset: 'title', font_size: 24, font_weight: 'bold', color: '#1a1a1a', font_family: 'Inter' } },
      { type: 'text', x: 40, y: 100, width: 515, height: 300, properties: { content: '', preset: 'body', font_size: 16, color: '#1a1a1a', font_family: 'Inter' } },
    ],
  },
  {
    id: 'dream',
    name: 'Journal de rêves',
    description: 'Pour se souvenir de ses rêves',
    icon: '🌙',
    cover_type: 'gradient',
    cover_color: '#553c9a',
    cover_gradient_from: '#2d3748',
    cover_gradient_to: '#553c9a',
    paper_style: 'dark',
    palette: { text: '#e2e8f0', accent: '#805ad5', background: '#1a202c' },
    starter_elements: [
      { type: 'text', x: 40, y: 40, width: 515, height: 50, properties: { content: '🌙 Mon rêve', preset: 'title', font_size: 24, font_weight: 'bold', color: '#e2e8f0', font_family: 'Playfair Display' } },
      { type: 'text', x: 40, y: 100, width: 515, height: 30, properties: { content: new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), preset: 'caption', font_size: 13, color: '#a0aec0', font_family: 'Inter' } },
      { type: 'text', x: 40, y: 150, width: 515, height: 250, properties: { content: '', preset: 'body', font_size: 15, color: '#e2e8f0', font_family: 'Georgia', line_height: 1.8 } },
    ],
  },
  {
    id: 'minimal',
    name: 'Minimaliste',
    description: 'Simple et épuré',
    icon: '◻️',
    cover_type: 'minimal',
    cover_color: '#E8D5C4',
    paper_style: 'blank',
    palette: { text: '#1a1a1a', accent: '#718096', background: '#ffffff' },
  },
  {
    id: 'kawaii',
    name: 'Kawaii',
    description: 'Doux et mignon',
    icon: '🎀',
    cover_type: 'pastel',
    cover_color: '#FFB7C5',
    cover_gradient_from: '#FFB7C5',
    cover_gradient_to: '#FFDAB9',
    paper_style: 'rose',
    palette: { text: '#97266d', accent: '#d53f8c', background: '#fff0f3' },
    starter_elements: [
      { type: 'text', x: 40, y: 40, width: 515, height: 50, properties: { content: '💕 Mon journal kawaii', preset: 'title', font_size: 24, font_weight: 'bold', color: '#97266d', font_family: 'Playfair Display' } },
    ],
  },
  {
    id: 'project',
    name: 'Journal de projet',
    description: 'Pour suivre un projet',
    icon: '🎯',
    cover_type: 'gradient',
    cover_color: '#2b6cb0',
    cover_gradient_from: '#2b6cb0',
    cover_gradient_to: '#2c5282',
    paper_style: 'lined',
    palette: { text: '#1a365d', accent: '#2b6cb0', background: '#ffffff' },
    starter_elements: [
      { type: 'text', x: 40, y: 40, width: 515, height: 50, properties: { content: '🎯 Nom du projet', preset: 'title', font_size: 24, font_weight: 'bold', color: '#1a365d', font_family: 'Inter' } },
      { type: 'text', x: 40, y: 100, width: 515, height: 250, properties: { content: 'Objectif :\n\nÉtapes :\n1. \n2. \n3. \n\n\nDeadline :\n\n', preset: 'body', font_size: 14, color: '#1a1a1a', font_family: 'Inter' } },
    ],
  },
  {
    id: 'soft',
    name: 'Soft',
    description: 'Doux et élégant',
    icon: '🫧',
    cover_type: 'gradient',
    cover_color: '#c4b5fd',
    cover_gradient_from: '#e9d5ff',
    cover_gradient_to: '#dbeafe',
    paper_style: 'lavender',
    palette: { text: '#4c1d95', accent: '#7c3aed', background: '#f5f0ff' },
  },
];

/** Find template by ID */
export function getTemplateById(id: string): JournalTemplate | undefined {
  return JOURNAL_TEMPLATES.find((t) => t.id === id);
}
