-- ============================================================
-- GIVA IPIZ - RLS de Coordenação por Área e Curso
-- Objetivo: tratar COORDINATOR (e legado ADMIN_1) como papel
-- escopado a area_id + course_ids atribuídos no JWT.
--
-- Metadados esperados no token (app_metadata ou user_metadata):
--   role: 'COORDINATOR' (ou legado 'ADMIN_1')
--   area_id: <uuid>
--   course_ids: [<uuid>, ...] (opcional, mas recomendado)
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) Funções auxiliares de escopo
-- ------------------------------------------------------------
create or replace function public.current_app_role_v2()
returns text
language sql
stable
as $$
  select upper(
    coalesce(
      auth.jwt() -> 'app_metadata' ->> 'role',
      auth.jwt() -> 'user_metadata' ->> 'role',
      'authenticated'
    )
  );
$$;

create or replace function public.current_area_id_v2()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      auth.jwt() -> 'app_metadata' ->> 'area_id',
      auth.jwt() -> 'user_metadata' ->> 'area_id',
      ''
    ),
    ''
  )::uuid;
$$;

create or replace function public.current_course_ids_v2()
returns uuid[]
language sql
stable
as $$
  with raw as (
    select coalesce(
      auth.jwt() -> 'app_metadata' -> 'course_ids',
      auth.jwt() -> 'user_metadata' -> 'course_ids',
      '[]'::jsonb
    ) as value
  )
  select coalesce(array_agg((entry)::uuid), '{}'::uuid[])
  from raw,
  lateral jsonb_array_elements_text(
    case
      when jsonb_typeof(raw.value) = 'array' then raw.value
      else '[]'::jsonb
    end
  ) as entry;
$$;

create or replace function public.is_super_admin_v2()
returns boolean
language sql
stable
as $$
  select public.current_app_role_v2() = 'SUPER_ADMIN';
$$;

create or replace function public.is_coordinator_v2()
returns boolean
language sql
stable
as $$
  select public.current_app_role_v2() in ('COORDINATOR', 'ADMIN_1');
$$;

create or replace function public.can_access_area_v2(p_area_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.is_super_admin_v2()
    or (
      public.is_coordinator_v2()
      and p_area_id is not null
      and p_area_id = public.current_area_id_v2()
    );
$$;

create or replace function public.can_access_course_v2(p_course_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.is_super_admin_v2()
    or (
      public.is_coordinator_v2()
      and p_course_id is not null
      and p_course_id = any(public.current_course_ids_v2())
    );
$$;

-- ------------------------------------------------------------
-- 2) Policies: students
-- ------------------------------------------------------------
alter table if exists public.students enable row level security;

drop policy if exists "students_select_coord_scope_v2" on public.students;
create policy "students_select_coord_scope_v2"
on public.students
for select
using (
  public.is_super_admin_v2()
  or id = auth.uid()
  or (
    public.is_coordinator_v2()
    and public.can_access_area_v2(training_area_id)
    and (
      course_id is null
      or cardinality(public.current_course_ids_v2()) = 0
      or public.can_access_course_v2(course_id)
    )
  )
);

drop policy if exists "students_update_coord_scope_v2" on public.students;
create policy "students_update_coord_scope_v2"
on public.students
for update
using (
  public.is_super_admin_v2()
  or (
    public.is_coordinator_v2()
    and public.can_access_area_v2(training_area_id)
    and (
      course_id is null
      or cardinality(public.current_course_ids_v2()) = 0
      or public.can_access_course_v2(course_id)
    )
  )
)
with check (
  public.is_super_admin_v2()
  or (
    public.is_coordinator_v2()
    and public.can_access_area_v2(training_area_id)
    and (
      course_id is null
      or cardinality(public.current_course_ids_v2()) = 0
      or public.can_access_course_v2(course_id)
    )
  )
);

-- ------------------------------------------------------------
-- 3) Policies: internships
-- ------------------------------------------------------------
alter table if exists public.internships enable row level security;

drop policy if exists "internships_select_coord_scope_v2" on public.internships;
create policy "internships_select_coord_scope_v2"
on public.internships
for select
using (
  public.is_super_admin_v2()
  or public.can_access_area_v2(area_id)
);

drop policy if exists "internships_update_coord_scope_v2" on public.internships;
create policy "internships_update_coord_scope_v2"
on public.internships
for update
using (
  public.is_super_admin_v2()
  or public.can_access_area_v2(area_id)
)
with check (
  public.is_super_admin_v2()
  or public.can_access_area_v2(area_id)
);

-- ------------------------------------------------------------
-- 4) Policies: partners/company_accounts
-- ------------------------------------------------------------
alter table if exists public.partners enable row level security;

drop policy if exists "partners_select_coord_scope_v2" on public.partners;
create policy "partners_select_coord_scope_v2"
on public.partners
for select
using (
  public.is_super_admin_v2()
  or public.can_access_area_v2(area_id)
);

drop policy if exists "partners_update_coord_scope_v2" on public.partners;
create policy "partners_update_coord_scope_v2"
on public.partners
for update
using (
  public.is_super_admin_v2()
  or public.can_access_area_v2(area_id)
)
with check (
  public.is_super_admin_v2()
  or public.can_access_area_v2(area_id)
);

commit;
