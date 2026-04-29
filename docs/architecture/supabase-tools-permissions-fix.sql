-- ============================================================
-- GIVA IPIZ - Tools Permissions Fix
-- Objetivo: permitir criação/edição no painel Ferramentas para
-- ADMIN_1 e SUPER_ADMIN (consistente com o frontend).
-- ============================================================

-- internships
alter table if exists public.internships enable row level security;

drop policy if exists "internships_insert_admin" on public.internships;
drop policy if exists "internships_update_admin" on public.internships;
drop policy if exists "internships_delete_admin" on public.internships;

create policy "internships_insert_admin"
  on public.internships
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

create policy "internships_update_admin"
  on public.internships
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

create policy "internships_delete_admin"
  on public.internships
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

-- internship_vacancies
alter table if exists public.internship_vacancies enable row level security;

drop policy if exists "vacancies_insert_admin" on public.internship_vacancies;
drop policy if exists "vacancies_update_admin" on public.internship_vacancies;
drop policy if exists "vacancies_delete_admin" on public.internship_vacancies;

create policy "vacancies_insert_admin"
  on public.internship_vacancies
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

create policy "vacancies_update_admin"
  on public.internship_vacancies
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

create policy "vacancies_delete_admin"
  on public.internship_vacancies
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
