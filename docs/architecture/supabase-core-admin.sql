-- Tabelas adicionais para remover mocks e usar dados reais no frontend
-- Corre no Supabase SQL Editor apos supabase-partners.sql

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  aluno text not null,
  curso text not null,
  nota numeric(5,2) not null default 0,
  area_id uuid not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists idx_evaluations_area_created_at on public.evaluations(area_id, created_at desc);

alter table public.evaluations enable row level security;

drop policy if exists "evaluations_select_scoped" on public.evaluations;
drop policy if exists "evaluations_insert_scoped" on public.evaluations;

create policy "evaluations_select_scoped" on public.evaluations
for select
to authenticated
using (
  public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
  or public.has_cross_area_scope()
  or area_id = public.current_area_id()
);

create policy "evaluations_insert_scoped" on public.evaluations
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

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  prioridade text not null default 'medium',
  lida boolean not null default false,
  area_id uuid not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists idx_app_notifications_area_created_at on public.app_notifications(area_id, created_at desc);

alter table public.app_notifications enable row level security;

drop policy if exists "app_notifications_select_scoped" on public.app_notifications;
drop policy if exists "app_notifications_update_scoped" on public.app_notifications;

drop policy if exists "app_notifications_insert_scoped" on public.app_notifications;

create policy "app_notifications_select_scoped" on public.app_notifications
for select
to authenticated
using (
  public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
  or public.has_cross_area_scope()
  or area_id = public.current_area_id()
);

create policy "app_notifications_insert_scoped" on public.app_notifications
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

create policy "app_notifications_update_scoped" on public.app_notifications
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
