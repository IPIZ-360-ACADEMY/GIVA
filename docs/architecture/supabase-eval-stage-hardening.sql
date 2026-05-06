-- ============================================================
-- GIVA IPIZ - Hardening: validação de fase para avaliações
-- Objetivo: impedir via trigger (DB-level) que avaliações
--           intercalares ou finais sejam registadas numa fase
--           errada do ciclo de progressão, mesmo que a chamada
--           seja feita directamente à API / bypassing da UI.
--
-- Regras enforçadas:
--   MIDTERM → só permitida em INTERNSHIP | FIXED_TERM_CONTRACT | PERMANENT_CONTRACT
--   FINAL   → só permitida em COMPLETED  | TERMINATED
--
-- Depende de: supabase-intern-followup.sql (tabela intern_evaluations)
--             supabase-company-rls-hardening.sql (tabela company_progress)
-- ============================================================

-- ============================================================
-- 1. Função de validação de fase (trigger BEFORE INSERT OR UPDATE)
-- ============================================================
create or replace function public.validate_eval_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stage text;
begin
  -- Obter a fase actual do processo de progressão associado
  select progression_stage
    into v_stage
    from public.company_progress
   where id = new.company_progress_id;

  if not found then
    raise exception
      'Processo de progressão % não encontrado.',
      new.company_progress_id
      using errcode = 'P0001';
  end if;

  -- Validar avaliação intercalar (MIDTERM)
  if new.eval_type = 'MIDTERM'
     and v_stage not in ('INTERNSHIP', 'FIXED_TERM_CONTRACT', 'PERMANENT_CONTRACT')
  then
    raise exception
      'Avaliação intercalar (MIDTERM) não é permitida na fase "%" do processo. '
      'Só é possível durante INTERNSHIP, FIXED_TERM_CONTRACT ou PERMANENT_CONTRACT.',
      v_stage
      using errcode = 'P0002';
  end if;

  -- Validar avaliação final (FINAL)
  if new.eval_type = 'FINAL'
     and v_stage not in ('COMPLETED', 'TERMINATED')
  then
    raise exception
      'Avaliação final (FINAL) não é permitida na fase "%" do processo. '
      'Só é possível após COMPLETED ou TERMINATED.',
      v_stage
      using errcode = 'P0003';
  end if;

  return new;
end;
$$;

-- ============================================================
-- 2. Trigger na tabela intern_evaluations
-- ============================================================
drop trigger if exists trg_ie_validate_stage on public.intern_evaluations;
create trigger trg_ie_validate_stage
  before insert or update of eval_type, company_progress_id
  on public.intern_evaluations
  for each row
  execute function public.validate_eval_stage();

-- ============================================================
-- 3. RLS adicional: endurecimento das políticas de insert/update
--    para intern_evaluations — adicionamos o mesmo check
--    directamente na WITH CHECK para que o RLS também rejeite
--    em vez de apenas o trigger.
--    (dupla camada: RLS bloqueia a query, trigger bloqueia o row)
-- ============================================================

-- Revogar e recriar ie_insert com validação de fase inline
drop policy if exists "ie_insert" on public.intern_evaluations;
create policy "ie_insert" on public.intern_evaluations
  for insert to authenticated
  with check (
    (
      -- Admins sempre podem
      public.is_admin_user()
      or
      -- Empresa dona do parceiro pode
      exists (
        select 1
          from public.partners p
         where p.id = public.intern_evaluations.partner_id
           and p.created_by = auth.uid()
      )
    )
    and
    -- Validação de fase duplicada a nível de RLS (MIDTERM)
    (
      public.intern_evaluations.eval_type <> 'MIDTERM'
      or exists (
        select 1
          from public.company_progress cp
         where cp.id  = public.intern_evaluations.company_progress_id
           and cp.progression_stage in ('INTERNSHIP', 'FIXED_TERM_CONTRACT', 'PERMANENT_CONTRACT')
      )
    )
    and
    -- Validação de fase duplicada a nível de RLS (FINAL)
    (
      public.intern_evaluations.eval_type <> 'FINAL'
      or exists (
        select 1
          from public.company_progress cp
         where cp.id  = public.intern_evaluations.company_progress_id
           and cp.progression_stage in ('COMPLETED', 'TERMINATED')
      )
    )
  );

-- Revogar e recriar ie_update com validação de fase inline
drop policy if exists "ie_update" on public.intern_evaluations;
create policy "ie_update" on public.intern_evaluations
  for update to authenticated
  using (
    public.is_admin_user()
    or exists (
      select 1
        from public.partners p
       where p.id = public.intern_evaluations.partner_id
         and p.created_by = auth.uid()
    )
  )
  with check (
    (
      public.is_admin_user()
      or exists (
        select 1
          from public.partners p
         where p.id = public.intern_evaluations.partner_id
           and p.created_by = auth.uid()
      )
    )
    and
    (
      public.intern_evaluations.eval_type <> 'MIDTERM'
      or exists (
        select 1
          from public.company_progress cp
         where cp.id  = public.intern_evaluations.company_progress_id
           and cp.progression_stage in ('INTERNSHIP', 'FIXED_TERM_CONTRACT', 'PERMANENT_CONTRACT')
      )
    )
    and
    (
      public.intern_evaluations.eval_type <> 'FINAL'
      or exists (
        select 1
          from public.company_progress cp
         where cp.id  = public.intern_evaluations.company_progress_id
           and cp.progression_stage in ('COMPLETED', 'TERMINATED')
      )
    )
  );

-- ============================================================
-- Fim
-- ============================================================
