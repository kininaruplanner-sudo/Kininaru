-- =====================================================================
-- Kininaru Planner — Journal Studio
-- Adds multi-journal support with pages, elements, and visual features.
-- Run in the Supabase SQL Editor (additive, safe to re-run).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. journals — a user can have multiple journals
-- ---------------------------------------------------------------------
create table if not exists public.journals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Mon journal',
  subtitle text,
  cover_type text not null default 'minimal' 
    check (cover_type in ('minimal', 'pastel', 'gradient', 'paper', 'notebook', 'floral', 'geometric', 'dark', 'colorful', 'custom')),
  cover_color text not null default '#E8D5C4',
  cover_gradient_from text,
  cover_gradient_to text,
  cover_image_url text,
  paper_style text not null default 'blank'
    check (paper_style in ('blank', 'lined', 'dotted', 'grid', 'cream', 'white', 'pastel', 'dark')),
  is_favorite boolean not null default false,
  is_archived boolean not null default false,
  page_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index journals_user_id_idx on public.journals(user_id);
create index journals_updated_at_idx on public.journals(updated_at desc);

alter table public.journals enable row level security;

create policy "journals: select own" on public.journals
  for select using (auth.uid() = user_id);
create policy "journals: insert own" on public.journals
  for insert with check (auth.uid() = user_id);
create policy "journals: update own" on public.journals
  for update using (auth.uid() = user_id);
create policy "journals: delete own" on public.journals
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 2. journal_pages — pages within a journal
-- ---------------------------------------------------------------------
create table if not exists public.journal_pages (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  page_number integer not null,
  paper_style text not null default 'blank'
    check (paper_style in ('blank', 'lined', 'dotted', 'grid', 'cream', 'white', 'pastel', 'dark')),
  background_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (journal_id, page_number)
);

create index journal_pages_journal_id_idx on public.journal_pages(journal_id);
create index journal_pages_user_id_idx on public.journal_pages(user_id);

alter table public.journal_pages enable row level security;

-- Users can only access pages of their own journals
create policy "journal_pages: select own" on public.journal_pages
  for select using (auth.uid() = user_id);
create policy "journal_pages: insert own" on public.journal_pages
  for insert with check (auth.uid() = user_id);
create policy "journal_pages: update own" on public.journal_pages
  for update using (auth.uid() = user_id);
create policy "journal_pages: delete own" on public.journal_pages
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 3. journal_elements — elements on a page (text, shape, sticker, image, drawing)
-- ---------------------------------------------------------------------
create table if not exists public.journal_elements (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.journal_pages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  element_type text not null
    check (element_type in ('text', 'shape', 'sticker', 'image', 'drawing')),
  x double precision not null default 0,
  y double precision not null default 0,
  width double precision not null default 100,
  height double precision not null default 100,
  rotation double precision not null default 0,
  z_index integer not null default 0,
  opacity double precision not null default 1,
  properties jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index journal_elements_page_id_idx on public.journal_elements(page_id);
create index journal_elements_user_id_idx on public.journal_elements(user_id);

alter table public.journal_elements enable row level security;

-- Users can only access elements of their own pages
create policy "journal_elements: select own" on public.journal_elements
  for select using (auth.uid() = user_id);
create policy "journal_elements: insert own" on public.journal_elements
  for insert with check (auth.uid() = user_id);
create policy "journal_elements: update own" on public.journal_elements
  for update using (auth.uid() = user_id);
create policy "journal_elements: delete own" on public.journal_elements
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 4. Function to update journal page_count automatically
-- ---------------------------------------------------------------------
create or replace function public.update_journal_page_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.journals
    set page_count = (
      select count(*) from public.journal_pages where journal_id = NEW.journal_id
    )
    where id = NEW.journal_id;
  elsif TG_OP = 'DELETE' then
    update public.journals
    set page_count = (
      select count(*) from public.journal_pages where journal_id = OLD.journal_id
    )
    where id = OLD.journal_id;
  end if;
  return null;
end;
$$;

create trigger on_journal_page_change
  after insert or delete on public.journal_pages
  for each row execute function public.update_journal_page_count();

-- ---------------------------------------------------------------------
-- 5. Function to update updated_at timestamps
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

create trigger journals_updated_at
  before update on public.journals
  for each row execute function public.set_updated_at();

create trigger journal_pages_updated_at
  before update on public.journal_pages
  for each row execute function public.set_updated_at();

create trigger journal_elements_updated_at
  before update on public.journal_elements
  for each row execute function public.set_updated_at();
