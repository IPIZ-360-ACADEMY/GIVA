-- ============================================================
-- GIVA IPIZ - Company RLS Hardening (Phase 1)
-- Objetivo: garantir acesso de empresa apenas aos seus proprios dados
-- Execucao: apos supabase-partners.sql e supabase-phase1-structure.sql
-- ============================================================

-- Helpers idempotentes
create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', 'authenticated');
$$;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
as $$
  select
    public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
    or exists (
      select 1
      from public.user_profiles up
      where up.id = auth.uid()
        and up.type = 'admin'
    );
$$;

-- ============================================================
-- 1) JOB APPLICATIONS
-- ============================================================
alter table if exists public.job_applications enable row level security;

drop policy if exists "job_applications_select_scoped" on public.job_applications;
drop policy if exists "job_applications_insert_student" on public.job_applications;
drop policy if exists "job_applications_update_company_or_admin" on public.job_applications;
drop policy if exists "job_applications_update_student_withdraw" on public.job_applications;

create policy "job_applications_select_scoped"
  on public.job_applications
  for select
  to authenticated
  using (
    public.is_admin_user()
    or student_id = auth.uid()
    or exists (
      select 1
      from public.partners p
      where p.id = public.job_applications.partner_id
        and p.created_by = auth.uid()
    )
  );

create policy "job_applications_insert_student"
  on public.job_applications
  for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and status = 'PENDING'
  );

-- Empresa dona do parceiro (ou admin) pode rever candidaturas.
create policy "job_applications_update_company_or_admin"
  on public.job_applications
  for update
  to authenticated
  using (
    public.is_admin_user()
    or exists (
      select 1
      from public.partners p
      where p.id = public.job_applications.partner_id
        and p.created_by = auth.uid()
    )
  )
  with check (
    public.is_admin_user()
    or exists (
      select 1
      from public.partners p
      where p.id = public.job_applications.partner_id
        and p.created_by = auth.uid()
    )
  );

-- Aluno pode apenas retirar a propria candidatura.
create policy "job_applications_update_student_withdraw"
  on public.job_applications
  for update
  to authenticated
  using (student_id = auth.uid())
  with check (
    student_id = auth.uid()
    and status = 'WITHDRAWN'
  );

-- ============================================================
-- 2) COMPANY PROGRESS
-- ============================================================
alter table if exists public.company_progress enable row level security;

drop policy if exists "company_progress_select_scoped" on public.company_progress;
drop policy if exists "company_progress_insert_company_or_admin" on public.company_progress;
drop policy if exists "company_progress_update_company_or_admin" on public.company_progress;

create policy "company_progress_select_scoped"
  on public.company_progress
  for select
  to authenticated
  using (
    public.is_admin_user()
    or student_id = auth.uid()
    or exists (
      select 1
      from public.partners p
      where p.id = public.company_progress.partner_id
        and p.created_by = auth.uid()
    )
  );

create policy "company_progress_insert_company_or_admin"
  on public.company_progress
  for insert
  to authenticated
  with check (
    public.is_admin_user()
    or exists (
      select 1
      from public.partners p
      where p.id = public.company_progress.partner_id
        and p.created_by = auth.uid()
    )
  );

create policy "company_progress_update_company_or_admin"
  on public.company_progress
  for update
  to authenticated
  using (
    public.is_admin_user()
    or exists (
      select 1
      from public.partners p
      where p.id = public.company_progress.partner_id
        and p.created_by = auth.uid()
    )
  )
  with check (
    public.is_admin_user()
    or exists (
      select 1
      from public.partners p
      where p.id = public.company_progress.partner_id
        and p.created_by = auth.uid()
    )
  );

-- ============================================================
-- 3) COMPANY ACCOUNTS (hardening complementar)
-- ============================================================
alter table if exists public.company_accounts enable row level security;

drop policy if exists "company_select_own_or_active" on public.company_accounts;
drop policy if exists "company_insert_own" on public.company_accounts;
drop policy if exists "company_update_own_or_admin" on public.company_accounts;

create policy "company_select_own_or_active"
  on public.company_accounts
  for select
  to authenticated
  using (
    id = auth.uid()
    or public.is_admin_user()
    or exists (
      select 1
      from public.user_profiles up
      where up.id = public.company_accounts.id
        and up.type = 'company'
        and up.moderation = 'active'
    )
  );

create policy "company_insert_own"
  on public.company_accounts
  for insert
  to authenticated
  with check (id = auth.uid());

create policy "company_update_own_or_admin"
  on public.company_accounts
  for update
  to authenticated
  using (id = auth.uid() or public.is_admin_user())
  with check (id = auth.uid() or public.is_admin_user());

-- ============================================================
-- Fim
-- ============================================================
