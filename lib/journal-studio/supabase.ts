// =====================================================================
// Kininaru Planner — Journal Studio Supabase Helpers (Hardened)
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

function getClient() {
  return createClient();
}

// ---------------------------------------------------------------------
// Journals CRUD
// ---------------------------------------------------------------------

export async function getJournals(): Promise<Journal[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('journals')
    .select('*')
    .eq('is_archived', false)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data as JournalRow[]).map(rowToJournal);
}

export async function getJournal(id: string): Promise<Journal | null> {
  const supabase = getClient();
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
  cover_image_url?: string;
  paper_style?: PaperStyle;
}): Promise<Journal> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('journals')
    .insert({
      user_id: user.id,
      title: journal.title,
      subtitle: journal.subtitle ?? null,
      cover_type: journal.cover_type ?? 'minimal',
      cover_color: journal.cover_color ?? '#E8D5C4',
      cover_gradient_from: journal.cover_gradient_from ?? null,
      cover_gradient_to: journal.cover_gradient_to ?? null,
      cover_image_url: journal.cover_image_url ?? null,
      paper_style: journal.paper_style ?? 'blank',
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
  const supabase = getClient();
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
  const supabase = getClient();
  const { error } = await supabase.from('journals').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Journal Duplication
// ---------------------------------------------------------------------

export async function duplicateJournal(journalId: string): Promise<Journal> {
  const supabase = getClient();

  // 1. Get source journal
  const srcJournal = await getJournal(journalId);
  if (!srcJournal) throw new Error('Journal not found');

  // 2. Create new journal
  const newJournal = await createJournal({
    title: `${srcJournal.title} (copie)`,
    subtitle: srcJournal.subtitle,
    cover_type: srcJournal.cover_type,
    cover_color: srcJournal.cover_color,
    cover_gradient_from: srcJournal.cover_gradient_from,
    cover_gradient_to: srcJournal.cover_gradient_to,
    cover_image_url: srcJournal.cover_image_url,
    paper_style: srcJournal.paper_style,
  });

  // 3. Copy pages + elements
  const srcPages = await getJournalPages(journalId);
  for (const srcPage of srcPages) {
    const newPage = await createJournalPage(newJournal.id, srcPage.page_number, srcPage.paper_style);

    const srcElements = await getPageElements(srcPage.id);
    if (srcElements.length > 0) {
      const insertPayload = srcElements.map((el) => ({
        page_id: newPage.id,
        user_id: srcPage.user_id,
        element_type: el.element_type,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        rotation: el.rotation,
        z_index: el.z_index,
        opacity: el.opacity,
        properties: el.properties as unknown as Record<string, unknown>,
      }));

      const { error } = await supabase.from('journal_elements').insert(insertPayload);
      if (error) throw error;
    }
  }

  return newJournal;
}

// ---------------------------------------------------------------------
// Journal Pages CRUD
// ---------------------------------------------------------------------

export async function getJournalPages(journalId: string): Promise<JournalPage[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('journal_pages')
    .select('*')
    .eq('journal_id', journalId)
    .order('page_number', { ascending: true });

  if (error) throw error;
  return (data as JournalPageRow[]).map(rowToPage);
}

export async function getJournalPage(id: string): Promise<JournalPage | null> {
  const supabase = getClient();
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
  const supabase = getClient();
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
  updates: Partial<{ paper_style: PaperStyle; background_color: string }>
): Promise<JournalPage> {
  const supabase = getClient();
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
  const supabase = getClient();
  const { error } = await supabase.from('journal_pages').delete().eq('id', id);
  if (error) throw error;
}

// Reindex page numbers after deletion to avoid gaps
export async function reindexJournalPages(journalId: string): Promise<void> {
  const supabase = getClient();
  const pages = await getJournalPages(journalId);

  const updates = pages.map((p, i) => ({
    id: p.id,
    page_number: i + 1,
  }));

  for (const u of updates) {
    const { error } = await supabase
      .from('journal_pages')
      .update({ page_number: u.page_number })
      .eq('id', u.id);
    if (error) throw error;
  }
}

// Duplicate a page with all its elements
export async function duplicateJournalPage(pageId: string, newPageNumber: number): Promise<JournalPage> {
  const supabase = getClient();
  const srcPage = await getJournalPage(pageId);
  if (!srcPage) throw new Error('Page not found');

  const newPage = await createJournalPage(srcPage.journal_id, newPageNumber, srcPage.paper_style);

  const srcElements = await getPageElements(pageId);
  if (srcElements.length > 0) {
    const insertPayload = srcElements.map((el) => ({
      page_id: newPage.id,
      user_id: el.user_id,
      element_type: el.element_type,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      rotation: el.rotation,
      z_index: el.z_index,
      opacity: el.opacity,
      properties: el.properties as unknown as Record<string, unknown>,
    }));

    const { error } = await supabase.from('journal_elements').insert(insertPayload);
    if (error) throw error;
  }

  return newPage;
}

// ---------------------------------------------------------------------
// Journal Elements CRUD
// ---------------------------------------------------------------------

export async function getPageElements(pageId: string): Promise<JournalElement[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('journal_elements')
    .select('*')
    .eq('page_id', pageId)
    .order('z_index', { ascending: true });

  if (error) throw error;
  return (data as JournalElementRow[]).map(rowToElement);
}

export async function getElement(id: string): Promise<JournalElement | null> {
  const supabase = getClient();
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
  const supabase = getClient();
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
  updates: Record<string, unknown>
): Promise<JournalElement> {
  const supabase = getClient();
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
  const supabase = getClient();
  const { error } = await supabase.from('journal_elements').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteElements(ids: string[]): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from('journal_elements').delete().in('id', ids);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Batch Save — single network call for all element changes
// ---------------------------------------------------------------------

export type ElementUpdate = {
  id: string;
  updates: Record<string, unknown>;
};

export type ElementInsert = {
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
};

export async function batchPersistElements(
  updates: ElementUpdate[],
  inserts: { page_id: string; elements: Omit<ElementInsert, 'page_id' | 'user_id'>[] },
  deletes: string[]
): Promise<void> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Deletes first
  if (deletes.length > 0) {
    const { error } = await supabase.from('journal_elements').delete().in('id', deletes);
    if (error) throw error;
  }

  // Updates — use RPC or sequential (Supabase doesn't support bulk update natively)
  for (const { id, updates: u } of updates) {
    const { error } = await supabase.from('journal_elements').update(u).eq('id', id);
    if (error) throw error;
  }

  // Inserts
  if (inserts.elements.length > 0) {
    const payload = inserts.elements.map((el) => ({
      ...el,
      page_id: inserts.page_id,
      user_id: user.id,
    }));
    const { error } = await supabase.from('journal_elements').insert(payload);
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------
// Image Upload
// ---------------------------------------------------------------------

export async function uploadJournalImage(file: File, journalId: string): Promise<string> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Validate
  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(file.type)) {
    throw new Error('Format non supporté. Utilise PNG, JPEG ou WebP.');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('L\'image ne doit pas dépasser 10 Mo.');
  }

  const ext = file.name.split('.').pop() ?? 'png';
  const path = `${user.id}/${journalId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('journal-images')
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('journal-images')
    .getPublicUrl(path);

  return urlData.publicUrl;
}

// ---------------------------------------------------------------------
// Batch Operations
// ---------------------------------------------------------------------

export async function initializeJournalPages(
  journalId: string,
  pageCount: number,
  paperStyle: PaperStyle
): Promise<JournalPage[]> {
  const pages: JournalPage[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await createJournalPage(journalId, i, paperStyle);
    pages.push(page);
  }
  return pages;
}
