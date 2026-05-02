-- ============================================================
-- Tabela: manual_classes
-- Turmas registadas manualmente (Gestão de Turmas)
-- Migração: create_manual_classes_table
-- ============================================================

create table if not exists public.manual_classes (
  id            uuid primary key default gen_random_uuid(),
  ano_letivo    text not null,
  curso         text not null,
  turma         text not null,
  supervisor    text,
  total         integer not null default 0,
  ativos        integer not null default 0,
  monitoramento integer not null default 0,
  risco         integer not null default 0,
  media_nota    text not null default '0.0',
  area_id       uuid references public.training_area(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Índices
create index if not exists idx_manual_classes_area_id     on public.manual_classes(area_id);
create index if not exists idx_manual_classes_ano_letivo  on public.manual_classes(ano_letivo);
create unique index if not exists idx_manual_classes_unique
  on public.manual_classes(ano_letivo, curso, turma);

-- Trigger updated_at
create or replace function public._update_manual_classes_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_manual_classes_updated_at on public.manual_classes;
create trigger trg_manual_classes_updated_at
  before update on public.manual_classes
  for each row execute function public._update_manual_classes_updated_at();

-- RLS
alter table public.manual_classes enable row level security;

-- Leitura: qualquer autenticado
create policy "manual_classes_select" on public.manual_classes
  for select using (auth.role() = 'authenticated');

-- Escrita: apenas SUPER_ADMIN e ADMIN_1
create policy "manual_classes_insert" on public.manual_classes
  for insert with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('SUPER_ADMIN', 'ADMIN_1')
  );

create policy "manual_classes_update" on public.manual_classes
  for update using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('SUPER_ADMIN', 'ADMIN_1')
  );

create policy "manual_classes_delete" on public.manual_classes
  for delete using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'SUPER_ADMIN'
  );
