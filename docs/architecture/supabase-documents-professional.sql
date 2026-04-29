-- Upgrade do modulo de documentos para fluxo profissional (CRUD + publicacao + arquivo)
-- Corre no Supabase SQL Editor apos supabase-partners.sql

alter table public.documents add column if not exists categoria text not null default 'geral';
alter table public.documents add column if not exists descricao text not null default '';
alter table public.documents add column if not exists arquivo_url text;
alter table public.documents add column if not exists arquivo_path text;
alter table public.documents add column if not exists updated_at timestamptz not null default now();
alter table public.documents add column if not exists updated_by uuid;

alter table public.documents
  drop constraint if exists documents_estado_check;

alter table public.documents
  add constraint documents_estado_check
  check (estado in ('review', 'published', 'pending', 'archived'));

create index if not exists idx_documents_area_estado_updated_at
  on public.documents(area_id, estado, updated_at desc);

drop policy if exists "documents_update_scoped" on public.documents;
drop policy if exists "documents_delete_scoped" on public.documents;

create policy "documents_update_scoped" on public.documents
for update
to authenticated
using (
  public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
  or public.has_cross_area_scope()
  or area_id = public.current_area_id()
)
with check (
  public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
  or public.has_cross_area_scope()
  or area_id = public.current_area_id()
);

create policy "documents_delete_scoped" on public.documents
for delete
to authenticated
using (
  public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
  or public.has_cross_area_scope()
  or area_id = public.current_area_id()
);

-- Opcional: preencher updated_at para documentos antigos
update public.documents
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;
