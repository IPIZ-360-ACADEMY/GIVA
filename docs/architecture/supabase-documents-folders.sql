-- =====================================================
-- SUPABASE DOCUMENTS: PASTAS E SUB-PASTAS
-- Data: 2026-04-18
-- Objetivo:
-- 1) Permitir organização lógica de documentos por pasta
-- 2) Permitir sub-organização por sub-pasta
-- =====================================================

begin;

alter table if exists public.documents
  add column if not exists folder_name text null,
  add column if not exists subfolder_name text null;

create index if not exists idx_documents_folder_listing
  on public.documents (folder_name, subfolder_name, updated_at desc);

commit;
