// =====================================================================
// Kininaru Planner — Journal Studio Colors
// =====================================================================

import type { ColorPalette } from './types';

export const COLOR_PALETTES: ColorPalette[] = [
  {
    name: 'Neutre',
    colors: [
      '#1a1a1a', '#4a4a4a', '#7a7a7a', '#aaaaaa', '#d5d5d5', '#f5f5f5',
      '#ffffff', '#000000', '#1a1a2e', '#2d3748', '#4a5568', '#718096',
      '#a0aec0', '#cbd5e0', '#e2e8f0', '#f7fafc',
    ],
  },
  {
    name: 'Pastel',
    colors: [
      '#FFE4E1', '#FFDAB9', '#FFE4B5', '#FFF8DC', '#F5F5DC', '#FAEBD7',
      '#E6E6FA', '#D8BFD8', '#DDA0DD', '#EE82EE', '#F0E6FF', '#E6F0FF',
      '#E6FFFF', '#E6FFE6', '#FFFFF0', '#FFF5EE',
    ],
  },
  {
    name: 'Études',
    colors: [
      '#2C3E50', '#3498DB', '#1ABC9C', '#27AE60', '#F39C12', '#E74C3C',
      '#9B59B6', '#1F77B4', '#2CA02C', '#FF7F0E', '#D62728', '#9467BD',
      '#8C564B', '#E377C2', '#7F7F7F', '#BCBD22',
    ],
  },
  {
    name: 'Nature',
    colors: [
      '#2D5016', '#4A7C29', '#6B8E23', '#8FBC8F', '#90EE90', '#98FB98',
      '#006400', '#228B22', '#2E8B57', '#3CB371', '#66CDAA', '#8FBC8F',
      '#556B2F', '#6B8E23', '#808000', '#9ACD32',
    ],
  },
  {
    name: 'Chaud',
    colors: [
      '#FF4500', '#FF6347', '#FF7F50', '#FF8C00', '#FFA500', '#FFD700',
      '#FFDAB9', '#FFE4B5', '#FFEBCD', '#FFDEAD', '#F4A460', '#D2691E',
      '#CD853F', '#DAA520', '#B8860B', '#8B4513',
    ],
  },
  {
    name: 'Froid',
    colors: [
      '#0000FF', '#0000CD', '#00008B', '#000080', '#191970', '#4169E1',
      '#6495ED', '#4682B4', '#5F9EA0', '#00CED1', '#48D1CC', '#40E0D0',
      '#7FFFD4', '#66CDAA', '#20B2AA', '#00FA9A',
    ],
  },
  {
    name: 'Sombre',
    colors: [
      '#0d1117', '#161b22', '#21262d', '#30363d', '#484f58', '#6e7681',
      '#8b949e', '#c9d1d9', '#0d1117', '#161b22', '#21262d', '#30363d',
      '#484f58', '#6e7681', '#8b949e', '#c9d1d9',
    ],
  },
  {
    name: 'Coloré',
    colors: [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA',
      '#F1948A', '#85929E', '#73C6B6', '#F0B27A',
    ],
  },
];

export function getColorPalette(name: string): ColorPalette | undefined {
  return COLOR_PALETTES.find(p => p.name === name);
}

export function getAllColors(): string[] {
  return COLOR_PALETTES.flatMap(p => p.colors);
}

// Theme presets
export interface ThemePreset {
  id: string;
  name: string;
  paper: 'blank' | 'lined' | 'dotted' | 'grid' | 'cream' | 'white' | 'pastel' | 'dark';
  accent_color: string;
  default_fonts: {
    heading: string;
    body: string;
  };
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'minimal',
    name: 'Minimaliste',
    paper: 'blank',
    accent_color: '#1a1a1a',
    default_fonts: { heading: 'Inter', body: 'Inter' },
  },
  {
    id: 'academic',
    name: 'Académique',
    paper: 'lined',
    accent_color: '#2C3E50',
    default_fonts: { heading: 'Georgia', body: 'Georgia' },
  },
  {
    id: 'pastel',
    name: 'Pastel',
    paper: 'pastel',
    accent_color: '#9B59B6',
    default_fonts: { heading: 'Inter', body: 'Inter' },
  },
  {
    id: 'nature',
    name: 'Nature',
    paper: 'cream',
    accent_color: '#27AE60',
    default_fonts: { heading: 'Georgia', body: 'Inter' },
  },
  {
    id: 'creative',
    name: 'Créatif',
    paper: 'blank',
    accent_color: '#E74C3C',
    default_fonts: { heading: 'Inter', body: 'Inter' },
  },
  {
    id: 'midnight',
    name: 'Minuit',
    paper: 'dark',
    accent_color: '#3498DB',
    default_fonts: { heading: 'Inter', body: 'Inter' },
  },
  {
    id: 'vintage',
    name: 'Vintage',
    paper: 'cream',
    accent_color: '#8B4513',
    default_fonts: { heading: 'Georgia', body: 'Georgia' },
  },
  {
    id: 'clean',
    name: 'Net',
    paper: 'white',
    accent_color: '#2C3E50',
    default_fonts: { heading: 'Inter', body: 'Inter' },
  },
];
