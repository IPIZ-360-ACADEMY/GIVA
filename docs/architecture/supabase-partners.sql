-- Run in Supabase SQL Editor
create extension if not exists pgcrypto;

create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', 'authenticated');
$$;

create or replace function public.current_area_id()
returns uuid
language sql
stable
as $$
  select nullif(coalesce(auth.jwt() -> 'app_metadata' ->> 'area_id', auth.jwt() -> 'user_metadata' ->> 'area_id', ''), '')::uuid;
$$;

create or replace function public.has_cross_area_scope()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' -> 'scopes', '[]'::jsonb) ? 'cross_area';
$$;

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  nif text not null default '',
  setor text not null default 'tech',
  areas text[] not null default '{}',
  vagas integer not null default 0,
  sla text not null default '',
  responsavel text not null default '',
  telefone text not null default '',
  email text not null default '',
  website text not null default '',
  endereco text not null default '',
  photo_preview text,
  area_id uuid not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.partners add column if not exists area_id uuid;
alter table public.partners add column if not exists created_by uuid;

-- If this table already exists with legacy rows, backfill area_id and created_by
-- explicitly before enforcing NOT NULL at database level.
alter table public.partners alter column created_by set default auth.uid();

create index if not exists idx_partners_area_created_at on public.partners(area_id, created_at desc);

alter table public.partners enable row level security;

drop policy if exists "partners_select_dev" on public.partners;
drop policy if exists "partners_insert_dev" on public.partners;
drop policy if exists "partners_update_dev" on public.partners;
drop policy if exists "partners_delete_dev" on public.partners;
drop policy if exists "partners_select_scoped" on public.partners;
drop policy if exists "partners_insert_scoped" on public.partners;
drop policy if exists "partners_update_scoped" on public.partners;
drop policy if exists "partners_delete_scoped" on public.partners;

create policy "partners_select_scoped" on public.partners
for select
to authenticated
using (
  public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
  or public.has_cross_area_scope()
  or created_by = auth.uid()
  or area_id = public.current_area_id()
);

create policy "partners_insert_scoped" on public.partners
for insert
to authenticated
with check (
  (
    public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
    or public.has_cross_area_scope()
    or area_id = public.current_area_id()
  )
  and created_by = auth.uid()
);

create policy "partners_update_scoped" on public.partners
for update
to authenticated
using (
  public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
  or public.has_cross_area_scope()
  or created_by = auth.uid()
  or area_id = public.current_area_id()
)
with check (
  public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
  or public.has_cross_area_scope()
  or created_by = auth.uid()
  or area_id = public.current_area_id()
);

create policy "partners_delete_scoped" on public.partners
for delete
to authenticated
using (
  public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
  or public.has_cross_area_scope()
  or created_by = auth.uid()
  or area_id = public.current_area_id()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo text not null default 'PDF',
  versao text not null default 'v1.0',
  estado text not null default 'review',
  area_id uuid not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists idx_documents_area_created_at on public.documents(area_id, created_at desc);

alter table public.documents enable row level security;

drop policy if exists "documents_select_scoped" on public.documents;
drop policy if exists "documents_insert_scoped" on public.documents;

create policy "documents_select_scoped" on public.documents
for select
to authenticated
using (
  public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
  or public.has_cross_area_scope()
  or area_id = public.current_area_id()
);

create policy "documents_insert_scoped" on public.documents
for insert
to authenticated
with check (
  (
    public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
    or public.has_cross_area_scope()
    or area_id = public.current_area_id()
  )
  and created_by = auth.uid()
);

create table if not exists public.student_notes (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  note text not null,
  area_id uuid not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists idx_student_notes_area_created_at on public.student_notes(area_id, created_at desc);

alter table public.student_notes enable row level security;

drop policy if exists "student_notes_select_scoped" on public.student_notes;
drop policy if exists "student_notes_insert_scoped" on public.student_notes;

create policy "student_notes_select_scoped" on public.student_notes
for select
to authenticated
using (
  public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
  or public.has_cross_area_scope()
  or area_id = public.current_area_id()
);

create policy "student_notes_insert_scoped" on public.student_notes
for insert
to authenticated
with check (
  (
    public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
    or public.has_cross_area_scope()
    or area_id = public.current_area_id()
  )
  and created_by = auth.uid()
);

create table if not exists public.internships (
  id uuid primary key default gen_random_uuid(),
  aluno text not null,
  turma text not null,
  ano_letivo text not null,
  curso text not null,
  empresa text not null,
  inicio text not null,
  nota numeric(5,2) not null default 0,
  status text not null default 'active',
  supervisor text not null default '',
  ultima_atualizacao text not null default '',
  photo text not null default '',
  area_id uuid not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists idx_internships_area_created_at on public.internships(area_id, created_at desc);

alter table public.internships enable row level security;

drop policy if exists "internships_select_scoped" on public.internships;

create policy "internships_select_scoped" on public.internships
for select
to authenticated
using (
  public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
  or public.has_cross_area_scope()
  or area_id = public.current_area_id()
);
