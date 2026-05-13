-- SUPABASE STUDENT PETITIONS: Tabela e RLS para pedidos de cartas de alunos

create table if not exists public.student_petitions (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null,
  area_id uuid not null references public.training_area(id),
  petition_type varchar(32) not null check (petition_type in ('estagio-profissional', 'estagio-curricular', 'recomendacao', 'emprego')),
  full_name varchar(140) not null,
  email varchar(160) not null,
  course varchar(120) not null,
  target_area varchar(120) not null,
  start_date date,
  end_date date,
  purpose text not null,
  status varchar(32) not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_petitions_area_created_at on public.student_petitions(area_id, created_at desc);
create index if not exists idx_student_petitions_requester on public.student_petitions(requester_id);

create or replace function public.update_student_petitions_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_student_petitions_updated_at on public.student_petitions;
create trigger update_student_petitions_updated_at
before update on public.student_petitions
for each row
execute function public.update_student_petitions_updated_at_column();

alter table public.student_petitions enable row level security;

drop policy if exists "student_petitions_select_scoped" on public.student_petitions;
drop policy if exists "student_petitions_insert_scoped" on public.student_petitions;
drop policy if exists "student_petitions_update_scoped" on public.student_petitions;
drop policy if exists "student_petitions_delete_scoped" on public.student_petitions;

create policy "student_petitions_select_scoped" on public.student_petitions
for select
to authenticated
using (
  public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
  or public.has_cross_area_scope()
  or area_id = public.current_area_id()
  or requester_id = auth.uid()
);

create policy "student_petitions_insert_scoped" on public.student_petitions
for insert
to authenticated
with check (
  (
    public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
    or public.has_cross_area_scope()
    or area_id = public.current_area_id()
  )
  and requester_id = auth.uid()
);

create policy "student_petitions_update_scoped" on public.student_petitions
for update
to authenticated
using (
  public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
  or public.has_cross_area_scope()
  or requester_id = auth.uid()
)
with check (
  public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
  or public.has_cross_area_scope()
  or requester_id = auth.uid()
);

create policy "student_petitions_delete_scoped" on public.student_petitions
for delete
to authenticated
using (
  public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
  or public.has_cross_area_scope()
);
