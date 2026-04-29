-- =====================================================
-- SUPABASE DOCUMENTS: CONTEXTO POR TURMA/EMPRESA + PRIORIDADE
-- Data: 2026-04-17
-- Objetivo:
-- 1) Organizar documentos por escopo (geral, turma, empresa)
-- 2) Permitir destaque de documentos fixados (pin)
-- 3) Suportar arquivamento com carimbo temporal
-- =====================================================

begin;

alter table if exists public.documents
  add column if not exists context_type text not null default 'general',
  add column if not exists class_group_id uuid null,
  add column if not exists partner_id uuid null,
  add column if not exists is_pinned boolean not null default false,
  add column if not exists archived_at timestamptz null;

-- Integridade do escopo contextual
alter table if exists public.documents
  drop constraint if exists documents_context_type_check;

alter table if exists public.documents
  add constraint documents_context_type_check
  check (context_type in ('general', 'class', 'company'));

-- Regra: turma exige class_group_id; empresa exige partner_id.
alter table if exists public.documents
  drop constraint if exists documents_context_scope_integrity_check;

alter table if exists public.documents
  add constraint documents_context_scope_integrity_check
  check (
    (context_type = 'general' and class_group_id is null and partner_id is null)
    or (context_type = 'class' and class_group_id is not null and partner_id is null)
    or (context_type = 'company' and class_group_id is null and partner_id is not null)
  );

-- Chaves estrangeiras opcionais, se as tabelas existirem no projeto.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'class_groups'
  ) then
    alter table public.documents
      drop constraint if exists documents_class_group_id_fkey;

    alter table public.documents
      add constraint documents_class_group_id_fkey
      foreign key (class_group_id) references public.class_groups(id)
      on update cascade on delete set null;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'partners'
  ) then
    alter table public.documents
      drop constraint if exists documents_partner_id_fkey;

    alter table public.documents
      add constraint documents_partner_id_fkey
      foreign key (partner_id) references public.partners(id)
      on update cascade on delete set null;
  end if;
end $$;

-- Índices para listagem profissional (fixados primeiro + atualização)
create index if not exists idx_documents_priority_listing
  on public.documents (is_pinned desc, updated_at desc, created_at desc);

create index if not exists idx_documents_context_listing
  on public.documents (context_type, class_group_id, partner_id);

commit;
