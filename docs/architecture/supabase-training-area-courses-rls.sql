-- ============================================================
-- GIVA IPIZ - Training Area & Courses RLS Fix
-- Objetivo: tornar funcional a seleção/criação no painel Ferramentas.
-- ============================================================

alter table if exists public.training_area enable row level security;
alter table if exists public.courses enable row level security;

-- training_area

drop policy if exists "training_area_select_scoped" on public.training_area;
drop policy if exists "training_area_insert_admin" on public.training_area;
drop policy if exists "training_area_update_admin" on public.training_area;
drop policy if exists "training_area_delete_admin" on public.training_area;

create policy "training_area_select_scoped"
  on public.training_area
  for select
  to authenticated
  using (
    current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
    or has_cross_area_scope()
    or id = current_area_id()
  );

create policy "training_area_insert_admin"
  on public.training_area
  for insert
  to authenticated
  with check (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', 'authenticated')
    in ('SUPER_ADMIN', 'ADMIN_1')
    or exists (
      select 1
      from public.user_profiles up
      where up.id = auth.uid()
        and up.type = 'admin'
    )
  );

create policy "training_area_update_admin"
  on public.training_area
  for update
  to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', 'authenticated')
    in ('SUPER_ADMIN', 'ADMIN_1')
    or exists (
      select 1
      from public.user_profiles up
      where up.id = auth.uid()
        and up.type = 'admin'
    )
  )
  with check (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', 'authenticated')
    in ('SUPER_ADMIN', 'ADMIN_1')
    or exists (
      select 1
      from public.user_profiles up
      where up.id = auth.uid()
        and up.type = 'admin'
    )
  );

create policy "training_area_delete_admin"
  on public.training_area
  for delete
  to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', 'authenticated')
    in ('SUPER_ADMIN', 'ADMIN_1')
    or exists (
      select 1
      from public.user_profiles up
      where up.id = auth.uid()
        and up.type = 'admin'
    )
  );

-- courses

drop policy if exists "courses_select_scoped" on public.courses;
drop policy if exists "courses_insert_admin" on public.courses;
drop policy if exists "courses_update_admin" on public.courses;
drop policy if exists "courses_delete_admin" on public.courses;

create policy "courses_select_scoped"
  on public.courses
  for select
  to authenticated
  using (
    current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
    or has_cross_area_scope()
    or training_area_id = current_area_id()
  );

create policy "courses_insert_admin"
  on public.courses
  for insert
  to authenticated
  with check (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', 'authenticated')
    in ('SUPER_ADMIN', 'ADMIN_1')
    or exists (
      select 1
      from public.user_profiles up
      where up.id = auth.uid()
        and up.type = 'admin'
    )
  );

create policy "courses_update_admin"
  on public.courses
  for update
  to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', 'authenticated')
    in ('SUPER_ADMIN', 'ADMIN_1')
    or exists (
      select 1
      from public.user_profiles up
      where up.id = auth.uid()
        and up.type = 'admin'
    )
  )
  with check (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', 'authenticated')
    in ('SUPER_ADMIN', 'ADMIN_1')
    or exists (
      select 1
      from public.user_profiles up
      where up.id = auth.uid()
        and up.type = 'admin'
    )
  );

create policy "courses_delete_admin"
  on public.courses
  for delete
  to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', 'authenticated')
    in ('SUPER_ADMIN', 'ADMIN_1')
    or exists (
      select 1
      from public.user_profiles up
      where up.id = auth.uid()
        and up.type = 'admin'
    )
  );
