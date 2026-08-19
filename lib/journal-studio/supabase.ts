// =====================================================================
// Kininaru Planner — Journal Studio Supabase Helpers
// =====================================================================

import { createClient } from '@/lib/supabase/client';
import type {
  Journal,
  JournalPage,
  JournalElement,
  JournalRow,
  JournalPageRow,
  JournalElementRow,
  CoverType,
  PaperStyle,
} from './types';
import {
  rowToJournal,
  rowToPage,
  rowToElement,
} from './types';

const supabase = createClient();

// ---------------------------------------------------------------------
// Journals CRUD
// ---------------------------------------------------------------------

export async function getJournals(): Promise<Journal[]> {
  const { data, error } = await supabase
    .from('journals')
    .select('*')
    .eq('is_archived', false)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data as JournalRow[]).map(rowToJournal);
}

export async function getJournal(id: string): Promise<Journal | null> {
  const { data, error } = await supabase
    .from('journals')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return rowToJournal(data as JournalRow);
}

export async function createJournal(journal: {
  title: string;
  subtitle?: string;
  cover_type?: CoverType;
  cover_color?: string;
  cover_gradient_from?: string;
  cover_gradient_to?: string;
  paper_style?: PaperStyle;
}): Promise<Journal> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('journals')
    .insert({
      user_id: user.id,
      title: journal.title,
      subtitle: journal.subtitle,
      cover_type: journal.cover_type ?? 'minimal',
      cover_color: journal.cover_color ?? '#E8D5C4',
      cover_gradient_from: journal.cover_gradient_from,
      cover_gradient_to: journal.cover_gradient_to,
      paper_style: journal.paper_style ?? 'blank',
      page_count: 1,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToJournal(data as JournalRow);
}

export async function updateJournal(
  id: string,
  updates: Partial<{
    title: string;
    subtitle: string;
    cover_type: CoverType;
    cover_color: string;
    cover_gradient_from: string;
    cover_gradient_to: string;
    cover_image_url: string;
    paper_style: PaperStyle;
    is_favorite: boolean;
    is_archived: boolean;
  }>
): Promise<Journal> {
  const { data, error } = await supabase
    .from('journals')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return rowToJournal(data as JournalRow);
}

export async function deleteJournal(id: string): Promise<void> {
  const { error } = await supabase
    .from('journals')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ---------------------------------------------------------------------
// Journal Pages CRUD
// ---------------------------------------------------------------------

export async function getJournalPages(journalId: string): Promise<JournalPage[]> {
  const { data, error } = await supabase
    .from('journal_pages')
    .select('*')
    .eq('journal_id', journalId)
    .order('page_number', { ascending: true });

  if (error) throw error;
  return (data as JournalPageRow[]).map(rowToPage);
}

export async function getJournalPage(id: string): Promise<JournalPage | null> {
  const { data, error } = await supabase
    .from('journal_pages')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return rowToPage(data as JournalPageRow);
}

export async function createJournalPage(journalId: string, pageNumber: number, paperStyle?: PaperStyle): Promise<JournalPage> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('journal_pages')
    .insert({
      journal_id: journalId,
      user_id: user.id,
      page_number: pageNumber,
      paper_style: paperStyle ?? 'blank',
    })
    .select()
    .single();

  if (error) throw error;
  return rowToPage(data as JournalPageRow);
}

export async function updateJournalPage(
  id: string,
  updates: Partial<{
    paper_style: PaperStyle;
    background_color: string;
  }>
): Promise<JournalPage> {
  const { data, error } = await supabase
    .from('journal_pages')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return rowToPage(data as JournalPageRow);
}

export async function deleteJournalPage(id: string): Promise<void> {
  const { error } = await supabase
    .from('journal_pages')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ---------------------------------------------------------------------
// Journal Elements CRUD
// ---------------------------------------------------------------------

export async function getPageElements(pageId: string): Promise<JournalElement[]> {
  const { data, error } = await supabase
    .from('journal_elements')
    .select('*')
    .eq('page_id', pageId)
    .order('z_index', { ascending: true });

  if (error) throw error;
  return (data as JournalElementRow[]).map(rowToElement);
}

export async function getElement(id: string): Promise<JournalElement | null> {
  const { data, error } = await supabase
    .from('journal_elements')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return rowToElement(data as JournalElementRow);
}

export async function createElement(element: {
  page_id: string;
  element_type: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  z_index?: number;
  opacity?: number;
  properties: Record<string, unknown>;
}): Promise<JournalElement> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('journal_elements')
    .insert({
      page_id: element.page_id,
      user_id: user.id,
      element_type: element.element_type,
      x: element.x ?? 0,
      y: element.y ?? 0,
      width: element.width ?? 100,
      height: element.height ?? 100,
      rotation: element.rotation ?? 0,
      z_index: element.z_index ?? 0,
      opacity: element.opacity ?? 1,
      properties: element.properties,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToElement(data as JournalElementRow);
}

export async function updateElement(
  id: string,
  updates: Partial<{
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    z_index: number;
    opacity: number;
    properties: Record<string, unknown>;
  }>
): Promise<JournalElement> {
  const { data, error } = await supabase
    .from('journal_elements')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return rowToElement(data as JournalElementRow);
}

export async function deleteElement(id: string): Promise<void> {
  const { error } = await supabase
    .from('journal_elements')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function batchUpdateElements(items: { id: string; updates: Partial<{ x: number; y: number; width: number; height: number; rotation: number; z_index: number; opacity: number; properties: Record<string, unknown> }> }[]): Promise<void> {
  for (const { id, updates: itemUpdates } of items) {
    const { error } = await supabase
      .from('journal_elements')
      .update(itemUpdates)
      .eq('id', id);

    if (error) throw error;
  }
}

// ---------------------------------------------------------------------
// Image Upload
// ---------------------------------------------------------------------

export async function uploadJournalImage(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const fileExt = file.name.split('.').pop();
  const fileName = `${user.id}/${Date.now()}.${fileExt}`;
  const filePath = `journal-images/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('journal-images')
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('journal-images')
    .getPublicUrl(filePath);

  return publicUrl;
}

// ---------------------------------------------------------------------
// Batch Operations
// ---------------------------------------------------------------------

export async function initializeJournalPages(journalId: string, pageCount: number, paperStyle: PaperStyle): Promise<JournalPage[]> {
  const pages: JournalPage[] = [];
  
  for (let i = 1; i <= pageCount; i++) {
    const page = await createJournalPage(journalId, i, paperStyle);
    pages.push(page);
  }
  
  return pages;
}
