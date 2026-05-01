-- ============================================================
-- GIVA IPIZ - Acompanhamento Individual de Estagiários
-- Objetivo: registo detalhado de presenças, actividades,
--           avaliações periódicas e objectivos por estagiário
-- Depende de: supabase-company-rls-hardening.sql
-- ============================================================

-- ============================================================
-- 1. REGISTO DE ACOMPANHAMENTO SEMANAL (diário de bordo)
-- ============================================================
create table if not exists public.intern_followup_logs (
  id                    uuid primary key default gen_random_uuid(),
  company_progress_id   uuid not null references public.company_progress(id) on delete cascade,
  partner_id            uuid not null references public.partners(id) on delete cascade,
  student_id            uuid not null,
  period_start          date not null,
  period_end            date not null,
  -- Presenças
  attendance_present    smallint not null default 0 check (attendance_present >= 0),
  attendance_absent     smallint not null default 0 check (attendance_absent >= 0),
  attendance_justified  smallint not null default 0 check (attendance_justified >= 0),
  -- Actividades e notas
  activities            text,
  supervisor_notes      text,
  -- Desempenho (1=Mau, 2=Fraco, 3=Suficiente, 4=Bom, 5=Excelente)
  performance_rating    smallint check (performance_rating between 1 and 5),
  -- Metadados
  created_by            uuid references auth.users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- índice para listagem rápida por progresso
create index if not exists idx_ifl_progress on public.intern_followup_logs(company_progress_id, period_start desc);
create index if not exists idx_ifl_partner   on public.intern_followup_logs(partner_id);

-- trigger de updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ifl_updated_at on public.intern_followup_logs;
create trigger trg_ifl_updated_at
  before update on public.intern_followup_logs
  for each row execute function public.set_updated_at();

-- ============================================================
-- 2. OBJECTIVOS DO ESTÁGIO
-- ============================================================
create table if not exists public.intern_objectives (
  id                    uuid primary key default gen_random_uuid(),
  company_progress_id   uuid not null references public.company_progress(id) on delete cascade,
  partner_id            uuid not null references public.partners(id) on delete cascade,
  student_id            uuid not null,
  description           text not null,
  target_date           date,
  achieved              boolean not null default false,
  achievement_notes     text,
  created_by            uuid references auth.users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_io_progress on public.intern_objectives(company_progress_id);

drop trigger if exists trg_io_updated_at on public.intern_objectives;
create trigger trg_io_updated_at
  before update on public.intern_objectives
  for each row execute function public.set_updated_at();

-- ============================================================
-- 3. AVALIAÇÕES PERIÓDICAS (intercalar + final)
-- ============================================================
create table if not exists public.intern_evaluations (
  id                    uuid primary key default gen_random_uuid(),
  company_progress_id   uuid not null references public.company_progress(id) on delete cascade,
  partner_id            uuid not null references public.partners(id) on delete cascade,
  student_id            uuid not null,
  -- Tipo: MIDTERM | FINAL
  eval_type             text not null check (eval_type in ('MIDTERM', 'FINAL')),
  eval_date             date not null default current_date,
  -- Dimensões (1-5)
  rating_punctuality    smallint check (rating_punctuality between 1 and 5),
  rating_initiative     smallint check (rating_initiative between 1 and 5),
  rating_teamwork       smallint check (rating_teamwork between 1 and 5),
  rating_technical      smallint check (rating_technical between 1 and 5),
  rating_communication  smallint check (rating_communication between 1 and 5),
  -- Média calculada (trigger abaixo)
  rating_average        numeric(3,2),
  general_comments      text,
  recommendation        text check (recommendation in ('HIRE', 'EXTEND', 'NO_ACTION', 'TERMINATE')),
  signed_by_company     boolean not null default false,
  signed_by_student     boolean not null default false,
  created_by            uuid references auth.users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_ie_progress on public.intern_evaluations(company_progress_id, eval_type);

-- Trigger para calcular rating_average
create or replace function public.calc_eval_average()
returns trigger language plpgsql as $$
declare
  total numeric := 0;
  count int := 0;
begin
  if new.rating_punctuality   is not null then total := total + new.rating_punctuality;   count := count + 1; end if;
  if new.rating_initiative    is not null then total := total + new.rating_initiative;    count := count + 1; end if;
  if new.rating_teamwork      is not null then total := total + new.rating_teamwork;      count := count + 1; end if;
  if new.rating_technical     is not null then total := total + new.rating_technical;     count := count + 1; end if;
  if new.rating_communication is not null then total := total + new.rating_communication; count := count + 1; end if;
  new.rating_average := case when count > 0 then round(total / count, 2) else null end;
  return new;
end;
$$;

drop trigger if exists trg_ie_avg on public.intern_evaluations;
create trigger trg_ie_avg
  before insert or update on public.intern_evaluations
  for each row execute function public.calc_eval_average();

drop trigger if exists trg_ie_updated_at on public.intern_evaluations;
create trigger trg_ie_updated_at
  before update on public.intern_evaluations
  for each row execute function public.set_updated_at();

-- ============================================================
-- 4. RLS
-- ============================================================

-- intern_followup_logs
alter table public.intern_followup_logs enable row level security;

drop policy if exists "ifl_select" on public.intern_followup_logs;
create policy "ifl_select" on public.intern_followup_logs for select to authenticated
  using (
    public.is_admin_user()
    or student_id = auth.uid()
    or exists (select 1 from public.partners p where p.id = public.intern_followup_logs.partner_id and p.created_by = auth.uid())
  );

drop policy if exists "ifl_insert" on public.intern_followup_logs;
create policy "ifl_insert" on public.intern_followup_logs for insert to authenticated
  with check (
    public.is_admin_user()
    or exists (select 1 from public.partners p where p.id = public.intern_followup_logs.partner_id and p.created_by = auth.uid())
  );

drop policy if exists "ifl_update" on public.intern_followup_logs;
create policy "ifl_update" on public.intern_followup_logs for update to authenticated
  using (
    public.is_admin_user()
    or exists (select 1 from public.partners p where p.id = public.intern_followup_logs.partner_id and p.created_by = auth.uid())
  )
  with check (
    public.is_admin_user()
    or exists (select 1 from public.partners p where p.id = public.intern_followup_logs.partner_id and p.created_by = auth.uid())
  );

drop policy if exists "ifl_delete" on public.intern_followup_logs;
create policy "ifl_delete" on public.intern_followup_logs for delete to authenticated
  using (
    public.is_admin_user()
    or exists (select 1 from public.partners p where p.id = public.intern_followup_logs.partner_id and p.created_by = auth.uid())
  );

-- intern_objectives (idem)
alter table public.intern_objectives enable row level security;

drop policy if exists "io_select" on public.intern_objectives;
create policy "io_select" on public.intern_objectives for select to authenticated
  using (public.is_admin_user() or student_id = auth.uid()
    or exists (select 1 from public.partners p where p.id = public.intern_objectives.partner_id and p.created_by = auth.uid()));

drop policy if exists "io_insert" on public.intern_objectives;
create policy "io_insert" on public.intern_objectives for insert to authenticated
  with check (public.is_admin_user()
    or exists (select 1 from public.partners p where p.id = public.intern_objectives.partner_id and p.created_by = auth.uid()));

drop policy if exists "io_update" on public.intern_objectives;
create policy "io_update" on public.intern_objectives for update to authenticated
  using (public.is_admin_user()
    or exists (select 1 from public.partners p where p.id = public.intern_objectives.partner_id and p.created_by = auth.uid()))
  with check (public.is_admin_user()
    or exists (select 1 from public.partners p where p.id = public.intern_objectives.partner_id and p.created_by = auth.uid()));

drop policy if exists "io_delete" on public.intern_objectives;
create policy "io_delete" on public.intern_objectives for delete to authenticated
  using (public.is_admin_user()
    or exists (select 1 from public.partners p where p.id = public.intern_objectives.partner_id and p.created_by = auth.uid()));

-- intern_evaluations (idem)
alter table public.intern_evaluations enable row level security;

drop policy if exists "ie_select" on public.intern_evaluations;
create policy "ie_select" on public.intern_evaluations for select to authenticated
  using (public.is_admin_user() or student_id = auth.uid()
    or exists (select 1 from public.partners p where p.id = public.intern_evaluations.partner_id and p.created_by = auth.uid()));

drop policy if exists "ie_insert" on public.intern_evaluations;
create policy "ie_insert" on public.intern_evaluations for insert to authenticated
  with check (public.is_admin_user()
    or exists (select 1 from public.partners p where p.id = public.intern_evaluations.partner_id and p.created_by = auth.uid()));

drop policy if exists "ie_update" on public.intern_evaluations;
create policy "ie_update" on public.intern_evaluations for update to authenticated
  using (public.is_admin_user()
    or exists (select 1 from public.partners p where p.id = public.intern_evaluations.partner_id and p.created_by = auth.uid()))
  with check (public.is_admin_user()
    or exists (select 1 from public.partners p where p.id = public.intern_evaluations.partner_id and p.created_by = auth.uid()));

drop policy if exists "ie_delete" on public.intern_evaluations;
create policy "ie_delete" on public.intern_evaluations for delete to authenticated
  using (public.is_admin_user()
    or exists (select 1 from public.partners p where p.id = public.intern_evaluations.partner_id and p.created_by = auth.uid()));

-- ============================================================
-- Fim
-- ============================================================
