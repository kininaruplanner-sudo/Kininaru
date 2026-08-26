-- =====================================================================
-- Kininaru — Journal Studio: Document Model Migration
-- =====================================================================
-- Adds content_blocks JSONB column to journal_pages for the new
-- block-based document editor. Existing canvas data is untouched.
-- Idempotent: safe to run multiple times.

-- 1. Add content_blocks column (nullable — existing pages keep working)
ALTER TABLE public.journal_pages
  ADD COLUMN IF NOT EXISTS content_blocks jsonb DEFAULT NULL;

-- 2. Index for document model queries (partial — only pages with content_blocks)
CREATE INDEX IF NOT EXISTS journal_pages_content_blocks_idx
  ON public.journal_pages USING gin (content_blocks)
  WHERE content_blocks IS NOT NULL;

-- 3. Update the page count trigger to also handle content_blocks updates
-- (the existing updated_at trigger already fires on any update)

-- 4. RLS: no new policies needed — existing journal_pages policies
--    already cover SELECT/INSERT/UPDATE/DELETE based on user_id + journal ownership.
--    content_blocks is just another column on the same row.

-- 5. Verify (optional — run manually)
-- SELECT id, journal_id, content_blocks IS NOT NULL AS has_document_model
-- FROM journal_pages LIMIT 10;
