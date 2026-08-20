// =====================================================================
// Kininaru Planner — Journal Studio Supabase Helpers (Hardened v2)
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
import { devLog } from './sync/indexed-db';

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
  devLog('SUPABASE', `Created journal ${data.id}`);
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
  // First delete all storage files for this journal
  await cleanupJournalStorage(id);
  const { error } = await supabase.from('journals').delete().eq('id', id);
  if (error) throw error;
  devLog('SUPABASE', `Deleted journal ${id}`);
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
  }

  devLog('SUPABASE', `Duplicated journal ${journalId} → ${newJournal.id}`);
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
  devLog('SUPABASE', `Created page ${pageNumber} in journal ${journalId}`);
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
  // Delete all elements on this page first (for storage cleanup)
  const elements = await getPageElements(id);
  for (const el of elements) {
    if (el.element_type === 'image') {
      const props = el.properties as { url?: string };
      if (props.url) {
        await cleanupStorageFile(props.url).catch(() => {});
      }
    }
  }
  const { error } = await supabase.from('journal_pages').delete().eq('id', id);
  if (error) throw error;
  devLog('SUPABASE', `Deleted page ${id}`);
}

/**
 * Atomic reindex page numbers using temporary offsets to avoid unique constraint violations.
 * Strategy: move all pages to temporary negative numbers, then reassign proper numbers.
 */
export async function reindexJournalPages(journalId: string): Promise<void> {
  const supabase = getClient();
  const pages = await getJournalPages(journalId);

  if (pages.length === 0) return;

  // Step 1: Move all pages to temporary negative numbers
  for (let i = 0; i < pages.length; i++) {
    const tempNumber = -(i + 1000); // Negative to avoid collisions
    const { error } = await supabase
      .from('journal_pages')
      .update({ page_number: tempNumber })
      .eq('id', pages[i].id);
    if (error) throw error;
  }

  // Step 2: Reassign proper numbers
  for (let i = 0; i < pages.length; i++) {
    const { error } = await supabase
      .from('journal_pages')
      .update({ page_number: i + 1 })
      .eq('id', pages[i].id);
    if (error) throw error;
  }

  devLog('SUPABASE', `Reindexed ${pages.length} pages for journal ${journalId}`);
}

// ---------------------------------------------------------------------
// Page Reorder (atomic swap via temporary negative)
// ---------------------------------------------------------------------
export async function reorderJournalPages(
  journalId: string,
  pageIds: string[]
): Promise<void> {
  const supabase = getClient();

  // Step 1: Assign temporary negatives
  for (let i = 0; i < pageIds.length; i++) {
    const { error } = await supabase
      .from('journal_pages')
      .update({ page_number: -(i + 1000) })
      .eq('id', pageIds[i]);
    if (error) throw error;
  }

  // Step 2: Assign final numbers
  for (let i = 0; i < pageIds.length; i++) {
    const { error } = await supabase
      .from('journal_pages')
      .update({ page_number: i + 1 })
      .eq('id', pageIds[i]);
    if (error) throw error;
  }

  devLog('SUPABASE', `Reordered ${pageIds.length} pages`);
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

  devLog('SUPABASE', `Duplicated page ${pageId}`);
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
  // Cleanup storage if it's an image element
  try {
    const el = await getElement(id);
    if (el?.element_type === 'image') {
      const props = el.properties as { url?: string };
      if (props.url) {
        await cleanupStorageFile(props.url).catch(() => {});
      }
    }
  } catch { /* best effort cleanup */ }

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

/**
 * Batch persist all element changes in a single logical operation.
 * Deletes → Updates → Inserts (order matters for consistency).
 */
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
    // Cleanup storage for image elements
    for (const id of deletes) {
      try {
        const el = await getElement(id);
        if (el?.element_type === 'image') {
          const props = el.properties as { url?: string };
          if (props.url) {
            await cleanupStorageFile(props.url).catch(() => {});
          }
        }
      } catch { /* best effort */ }
    }
    const { error } = await supabase.from('journal_elements').delete().in('id', deletes);
    if (error) throw error;
    devLog('SUPABASE', `Batch deleted ${deletes.length} elements`);
  }

  // Updates — use Promise.all for parallel execution
  if (updates.length > 0) {
    const updatePromises = updates.map(({ id, updates: u }) =>
      supabase.from('journal_elements').update(u).eq('id', id)
    );
    const results = await Promise.all(updatePromises);
    const firstError = results.find((r) => r.error);
    if (firstError?.error) throw firstError.error;
    devLog('SUPABASE', `Batch updated ${updates.length} elements`);
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
    devLog('SUPABASE', `Batch inserted ${inserts.elements.length} elements`);
  }

  // Touch journal updated_at via page's journal
  if (updates.length > 0 || deletes.length > 0 || inserts.elements.length > 0) {
    try {
      const page = await getJournalPage(inserts.page_id);
      if (page) {
        await supabase
          .from('journals')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', page.journal_id);
      }
    } catch { /* best effort */ }
  }
}

// ---------------------------------------------------------------------
// Image Upload (private bucket with signed URLs)
// ---------------------------------------------------------------------

export async function uploadJournalImage(file: File, journalId: string): Promise<string> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Validate MIME type
  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(file.type)) {
    throw new Error('Format non supporté. Utilise PNG, JPEG ou WebP.');
  }

  // Validate size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('L\'image ne doit pas dépasser 10 Mo.');
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${user.id}/${journalId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('journal-images')
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) throw uploadError;

  // Try signed URL first (private bucket)
  const { data: signedData, error: signedError } = await supabase.storage
    .from('journal-images')
    .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days

  if (!signedError && signedData?.signedUrl) {
    devLog('SUPABASE', `Uploaded image ${path} (signed URL)`);
    return signedData.signedUrl;
  }

  // Fallback to public URL if bucket is public
  const { data: urlData } = supabase.storage
    .from('journal-images')
    .getPublicUrl(path);

  devLog('SUPABASE', `Uploaded image ${path} (public URL fallback)`);
  return urlData.publicUrl;
}

/**
 * Refresh a signed URL if it's expired or about to expire.
 */
export async function refreshSignedUrl(url: string): Promise<string> {
  // If it's not a signed URL, return as-is
  if (!url.includes('token=')) return url;

  try {
    const supabase = getClient();
    // Extract the path from the signed URL
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/\/object\/sign\/journal-images\/(.+)/);
    if (!pathMatch) return url;

    const path = decodeURIComponent(pathMatch[1]);
    const { data, error } = await supabase.storage
      .from('journal-images')
      .createSignedUrl(path, 60 * 60 * 24 * 7);

    if (error || !data?.signedUrl) return url;
    return data.signedUrl;
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------
// Storage Cleanup
// ---------------------------------------------------------------------

async function cleanupStorageFile(url: string): Promise<void> {
  try {
    const supabase = getClient();

    // Try to extract path from signed URL
    if (url.includes('token=')) {
      const urlObj = new URL(url);
      const pathMatch = urlObj.pathname.match(/\/object\/sign\/journal-images\/(.+)/);
      if (pathMatch) {
        const path = decodeURIComponent(pathMatch[1]);
        await supabase.storage.from('journal-images').remove([path]);
        return;
      }
    }

    // Try to extract path from public URL
    const publicMatch = url.match(/\/object\/public\/journal-images\/(.+)/);
    if (publicMatch) {
      const path = decodeURIComponent(publicMatch[1]);
      await supabase.storage.from('journal-images').remove([path]);
    }
  } catch (err) {
    devLog('SUPABASE', 'Storage cleanup failed (non-critical)', err);
  }
}

/**
 * Clean up all storage files for a journal.
 * Called before journal deletion.
 */
async function cleanupJournalStorage(journalId: string): Promise<void> {
  try {
    const supabase = getClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const path = `${user.id}/${journalId}`;
    const { data: files } = await supabase.storage
      .from('journal-images')
      .list(path);

    if (files && files.length > 0) {
      const filePaths = files.map((f) => `${path}/${f.name}`);
      await supabase.storage.from('journal-images').remove(filePaths);
      devLog('SUPABASE', `Cleaned ${filePaths.length} storage files for journal ${journalId}`);
    }
  } catch (err) {
    devLog('SUPABASE', 'Journal storage cleanup failed (non-critical)', err);
  }
}

// ---------------------------------------------------------------------
// Batch Operations
// ---------------------------------------------------------------------

export async function initializeJournalPages(
  journalId: string,
  pageCount: number,
  paperStyle: PaperStyle
): Promise<JournalPage[]> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Batch insert all pages at once instead of one-by-one
  const pages = Array.from({ length: pageCount }, (_, i) => ({
    journal_id: journalId,
    user_id: user.id,
    page_number: i + 1,
    paper_style: paperStyle,
  }));

  const { data, error } = await supabase
    .from('journal_pages')
    .insert(pages)
    .select();

  if (error) throw error;

  devLog('SUPABASE', `Created ${pageCount} pages for journal ${journalId}`);
  return (data as JournalPageRow[]).map(rowToPage);
}

// ---------------------------------------------------------------------
// Cover Upload (dedicated)
// ---------------------------------------------------------------------

export async function uploadJournalCover(file: File, journalId: string): Promise<string> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(file.type)) {
    throw new Error('Format non supporté. Utilise PNG, JPEG ou WebP.');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('La couverture ne doit pas dépasser 5 Mo.');
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${user.id}/${journalId}/cover/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('journal-images')
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) throw uploadError;

  // Try signed URL first
  const { data: signedData, error: signedError } = await supabase.storage
    .from('journal-images')
    .createSignedUrl(path, 60 * 60 * 24 * 30); // 30 days for covers

  if (!signedError && signedData?.signedUrl) {
    return signedData.signedUrl;
  }

  // Fallback
  const { data: urlData } = supabase.storage
    .from('journal-images')
    .getPublicUrl(path);

  return urlData.publicUrl;
}
