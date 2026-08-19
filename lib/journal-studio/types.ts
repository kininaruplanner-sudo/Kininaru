// =====================================================================
// Kininaru Planner — Journal Studio Types
// =====================================================================

// ---------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------
export interface Journal {
  id: string;
  user_id: string;
  title: string;
  subtitle?: string;
  cover_type: CoverType;
  cover_color: string;
  cover_gradient_from?: string;
  cover_gradient_to?: string;
  cover_image_url?: string;
  paper_style: PaperStyle;
  is_favorite: boolean;
  is_archived: boolean;
  page_count: number;
  created_at: string;
  updated_at: string;
}

export type CoverType = 
  | 'minimal' 
  | 'pastel' 
  | 'gradient' 
  | 'paper' 
  | 'notebook' 
  | 'floral' 
  | 'geometric' 
  | 'dark' 
  | 'colorful' 
  | 'custom';

export type PaperStyle = 
  | 'blank' 
  | 'lined' 
  | 'dotted' 
  | 'grid' 
  | 'cream' 
  | 'white' 
  | 'pastel' 
  | 'dark';

// ---------------------------------------------------------------------
// Journal Page
// ---------------------------------------------------------------------
export interface JournalPage {
  id: string;
  journal_id: string;
  user_id: string;
  page_number: number;
  paper_style: PaperStyle;
  background_color?: string;
  created_at: string;
  updated_at: string;
  elements?: JournalElement[];
}

// ---------------------------------------------------------------------
// Journal Element
// ---------------------------------------------------------------------
export type ElementType = 'text' | 'shape' | 'sticker' | 'image' | 'drawing';

export interface JournalElement {
  id: string;
  page_id: string;
  user_id: string;
  element_type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z_index: number;
  opacity: number;
  properties: TextProperties | ShapeProperties | StickerProperties | ImageProperties | DrawingProperties;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------
// Element Properties
// ---------------------------------------------------------------------
export interface TextProperties {
  content: string;
  font_family?: string;
  font_size?: number;
  font_weight?: 'normal' | 'bold';
  font_style?: 'normal' | 'italic';
  text_decoration?: 'none' | 'underline';
  text_align?: 'left' | 'center' | 'right';
  color?: string;
  background_color?: string;
  line_height?: number;
  letter_spacing?: number;
}

export interface ShapeProperties {
  shape_type: 'rectangle' | 'rounded-rectangle' | 'circle' | 'ellipse' | 'line' | 'arrow' | 'triangle' | 'star' | 'heart' | 'speech-bubble';
  fill?: string;
  stroke?: string;
  stroke_width?: number;
  points?: [number, number][]; // For line/arrow
}

export interface StickerProperties {
  sticker_id: string;
  category: StickerCategory;
}

export type StickerCategory = 
  | 'cute' 
  | 'study' 
  | 'productivity' 
  | 'emotions' 
  | 'nature' 
  | 'stars' 
  | 'plants' 
  | 'food' 
  | 'travel' 
  | 'celebration' 
  | 'minimal';

export interface ImageProperties {
  url: string;
  alt?: string;
  object_fit?: 'cover' | 'contain' | 'fill';
}

export interface DrawingProperties {
  points: [number, number, number][]; // [x, y, pressure]
  stroke_color: string;
  stroke_width: number;
  opacity: number;
  tool: 'pen' | 'pencil' | 'highlighter' | 'eraser';
}

// ---------------------------------------------------------------------
// Journal Theme
// ---------------------------------------------------------------------
export interface JournalTheme {
  id: string;
  name: string;
  paper: PaperStyle;
  accent_color: string;
  typography: {
    heading?: string;
    body?: string;
  };
  default_stickers?: string[];
}

// ---------------------------------------------------------------------
// Color Palette
// ---------------------------------------------------------------------
export interface ColorPalette {
  name: string;
  colors: string[];
}

// ---------------------------------------------------------------------
// Undo/Redo
// ---------------------------------------------------------------------
export interface HistoryEntry {
  id: string;
  type: 'add' | 'remove' | 'update' | 'move' | 'resize' | 'rotate' | 'reorder';
  element_id?: string;
  page_id?: string;
  previous_state?: Partial<JournalElement>;
  new_state?: Partial<JournalElement>;
  timestamp: number;
}

// ---------------------------------------------------------------------
// Drawing State
// ---------------------------------------------------------------------
export interface DrawingState {
  is_drawing: boolean;
  tool: DrawingTool;
  color: string;
  size: number;
  opacity: number;
  points: [number, number, number][];
}

export type DrawingTool = 'pen' | 'pencil' | 'highlighter' | 'eraser';

// ---------------------------------------------------------------------
// Selection State
// ---------------------------------------------------------------------
export interface SelectionState {
  selected_ids: string[];
  multi_select: boolean;
}

// ---------------------------------------------------------------------
// Editor State
// ---------------------------------------------------------------------
export interface EditorState {
  current_journal: Journal | null;
  current_page: JournalPage | null;
  pages: JournalPage[];
  elements: JournalElement[];
  selected_element: JournalElement | null;
  selection: SelectionState;
  drawing: DrawingState;
  zoom: number;
  is_editing: boolean;
  is_saving: boolean;
  save_status: 'idle' | 'saving' | 'saved' | 'error' | 'offline';
  history: HistoryEntry[];
  history_index: number;
}

// ---------------------------------------------------------------------
// Page Background Patterns (for CSS)
// ---------------------------------------------------------------------
export const PAPER_PATTERNS: Record<PaperStyle, string> = {
  blank: '',
  lined: 'repeating-linear-gradient(transparent, transparent 31px, #e5e5e5 31px, #e5e5e5 32px)',
  dotted: 'radial-gradient(circle, #d1d1d1 1px, transparent 1px)',
  grid: 'linear-gradient(#e5e5e5 1px, transparent 1px), linear-gradient(90deg, #e5e5e5 1px, transparent 1px)',
  cream: 'linear-gradient(135deg, #fdf6e3 0%, #f5e6d3 100%)',
  white: 'linear-gradient(135deg, #ffffff 0%, #f8f8f8 100%)',
  pastel: 'linear-gradient(135deg, #f0e6ff 0%, #e6f0ff 100%)',
  dark: 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)',
};

// ---------------------------------------------------------------------
// Cover Presets
// ---------------------------------------------------------------------
export interface CoverPreset {
  type: CoverType;
  name: string;
  color: string;
  gradient_from?: string;
  gradient_to?: string;
  preview: string; // CSS gradient or background
}

export const COVER_PRESETS: CoverPreset[] = [
  { type: 'minimal', name: 'Minimaliste', color: '#E8D5C4', preview: 'linear-gradient(135deg, #E8D5C4 0%, #D4C4B4 100%)' },
  { type: 'pastel', name: 'Pastel', color: '#E8D4F2', gradient_from: '#E8D4F2', gradient_to: '#D4E8F2', preview: 'linear-gradient(135deg, #E8D4F2 0%, #D4E8F2 100%)' },
  { type: 'gradient', name: 'Dégradé', color: '#667eea', gradient_from: '#667eea', gradient_to: '#764ba2', preview: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { type: 'paper', name: 'Papier', color: '#F5E6D3', preview: 'linear-gradient(135deg, #F5E6D3 0%, #E8D5C4 100%)' },
  { type: 'notebook', name: 'Carnet', color: '#2C3E50', preview: 'linear-gradient(135deg, #2C3E50 0%, #34495E 100%)' },
  { type: 'floral', name: 'Floral', color: '#FFB7C5', gradient_from: '#FFB7C5', gradient_to: '#FFDAB9', preview: 'linear-gradient(135deg, #FFB7C5 0%, #FFDAB9 100%)' },
  { type: 'geometric', name: 'Géométrique', color: '#5B86E5', gradient_from: '#5B86E5', gradient_to: '#36D1DC', preview: 'linear-gradient(135deg, #5B86E5 0%, #36D1DC 100%)' },
  { type: 'dark', name: 'Sombre', color: '#1A1A2E', gradient_from: '#1A1A2E', gradient_to: '#16213E', preview: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)' },
  { type: 'colorful', name: 'Coloré', color: '#FF6B6B', gradient_from: '#FF6B6B', gradient_to: '#4ECDC4', preview: 'linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%)' },
  { type: 'custom', name: 'Personnalisé', color: '#9CA3AF', preview: 'linear-gradient(135deg, #9CA3AF 0%, #6B7280 100%)' },
];

// ---------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------
export const FONT_FAMILIES = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Courier New', label: 'Courier New' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Verdana', label: 'Verdana' },
] as const;

// ---------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------
export const SHAPES = [
  { type: 'rectangle' as const, name: 'Rectangle', icon: '⬜' },
  { type: 'rounded-rectangle' as const, name: 'Rectangle arrondi', icon: '▢' },
  { type: 'circle' as const, name: 'Cercle', icon: '⭕' },
  { type: 'ellipse' as const, name: 'Ellipse', icon: '⬭' },
  { type: 'line' as const, name: 'Ligne', icon: '➖' },
  { type: 'arrow' as const, name: 'Flèche', icon: '➡️' },
  { type: 'triangle' as const, name: 'Triangle', icon: '△' },
  { type: 'star' as const, name: 'Étoile', icon: '⭐' },
  { type: 'heart' as const, name: 'Cœur', icon: '❤️' },
  { type: 'speech-bubble' as const, name: 'Bulle', icon: '💬' },
];

// ---------------------------------------------------------------------
// Default Element Properties
// ---------------------------------------------------------------------
export const DEFAULT_TEXT_PROPERTIES: TextProperties = {
  content: 'Double-cliquez pour écrire',
  font_family: 'Inter',
  font_size: 16,
  font_weight: 'normal',
  font_style: 'normal',
  text_decoration: 'none',
  text_align: 'left',
  color: '#1a1a1a',
  line_height: 1.5,
  letter_spacing: 0,
};

export const DEFAULT_SHAPE_PROPERTIES: ShapeProperties = {
  shape_type: 'rectangle',
  fill: '#E8D5C4',
  stroke: '#1a1a1a',
  stroke_width: 2,
};

export const DEFAULT_STICKER_PROPERTIES: StickerProperties = {
  sticker_id: 'star',
  category: 'minimal',
};

export const DEFAULT_IMAGE_PROPERTIES: ImageProperties = {
  url: '',
  alt: 'Image',
  object_fit: 'cover',
};

export const DEFAULT_DRAWING_PROPERTIES: DrawingProperties = {
  points: [],
  stroke_color: '#1a1a1a',
  stroke_width: 3,
  opacity: 1,
  tool: 'pen',
};

// ---------------------------------------------------------------------
// Supabase Types (matching database schema)
// ---------------------------------------------------------------------
export interface JournalRow {
  id: string;
  user_id: string;
  title: string;
  subtitle: string | null;
  cover_type: string;
  cover_color: string;
  cover_gradient_from: string | null;
  cover_gradient_to: string | null;
  cover_image_url: string | null;
  paper_style: string;
  is_favorite: boolean;
  is_archived: boolean;
  page_count: number;
  created_at: string;
  updated_at: string;
}

export interface JournalPageRow {
  id: string;
  journal_id: string;
  user_id: string;
  page_number: number;
  paper_style: string;
  background_color: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalElementRow {
  id: string;
  page_id: string;
  user_id: string;
  element_type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z_index: number;
  opacity: number;
  properties: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------
// Helper: Convert Supabase row to app type
// ---------------------------------------------------------------------
export function rowToJournal(row: JournalRow): Journal {
  return {
    ...row,
    cover_type: row.cover_type as CoverType,
    paper_style: row.paper_style as PaperStyle,
    cover_gradient_from: row.cover_gradient_from ?? undefined,
    cover_gradient_to: row.cover_gradient_to ?? undefined,
    cover_image_url: row.cover_image_url ?? undefined,
    subtitle: row.subtitle ?? undefined,
  };
}

export function rowToPage(row: JournalPageRow): JournalPage {
  return {
    ...row,
    paper_style: row.paper_style as PaperStyle,
    background_color: row.background_color ?? undefined,
    elements: [],
  };
}

export function rowToElement(row: JournalElementRow): JournalElement {
  return {
    ...row,
    element_type: row.element_type as ElementType,
    properties: row.properties as unknown as TextProperties | ShapeProperties | StickerProperties | ImageProperties | DrawingProperties,
  };
}
