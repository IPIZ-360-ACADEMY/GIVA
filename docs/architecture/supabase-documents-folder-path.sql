-- =====================================================
-- SUPABASE DOCUMENTS: SUPORTE A CAMINHO HIERARQUICO DE PASTAS
-- Data: 2026-04-18
-- =====================================================

begin;

alter table if exists public.documents
  add column if not exists folder_path text null;

update public.documents
set folder_path = trim(both '/' from concat_ws('/', folder_name, subfolder_name))
where coalesce(folder_path, '') = ''
  and (coalesce(folder_name, '') <> '' or coalesce(subfolder_name, '') <> '');

create index if not exists idx_documents_folder_path_listing
  on public.documents (folder_path, updated_at desc);

commit;
