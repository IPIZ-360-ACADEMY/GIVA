-- ============================================================
-- GIVA IPIZ - RLS Audit (students + student_portfolio)
-- Purpose: quick, repeatable verification after migrations.
-- Notes:
-- 1) This script is READ-ONLY.
-- 2) Running from a privileged channel may bypass RLS.
--    Therefore we validate both:
--    - active policies in pg_policies
--    - policy predicate logic against real data
-- ============================================================

-- ------------------------------------------------------------
-- A) Check required policies are present
-- ------------------------------------------------------------
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('students', 'student_portfolio')
order by tablename, policyname;

-- ------------------------------------------------------------
-- B) Build sample contexts (student, company, admin)
-- ------------------------------------------------------------
with
student_ctx as (
  select
    sa.id as user_id,
    coalesce(sa.student_id, s.id) as own_student_id
  from public.student_accounts sa
  left join public.students s on s.process_number = sa.process_number
  where coalesce(sa.student_id, s.id) is not null
  limit 1
),
other_student as (
  select st.id as student_id
  from public.students st
  join student_ctx sc on true
  where st.id <> sc.own_student_id
  limit 1
),
company_ctx as (
  select distinct p.created_by as user_id
  from public.partners p
  where p.created_by is not null
  limit 1
),
company_linked_student as (
  select ja.student_id
  from public.job_applications ja
  join public.partners p on p.id = ja.partner_id
  join company_ctx cc on cc.user_id = p.created_by
  where ja.student_id is not null
  limit 1
),
company_unlinked_student as (
  select st.id as student_id
  from public.students st
  where not exists (
    select 1
    from public.job_applications ja
    join public.partners p on p.id = ja.partner_id
    join company_ctx cc on cc.user_id = p.created_by
    where ja.student_id = st.id
  )
  limit 1
),
admin_ctx as (
  select up.id as user_id
  from public.user_profiles up
  where up.type = 'admin'
  limit 1
),
checks as (
  select
    sc.user_id as student_user_id,
    sc.own_student_id,
    os.student_id as other_student_id,
    cc.user_id as company_user_id,
    cls.student_id as company_linked_student_id,
    cus.student_id as company_unlinked_student_id,
    ac.user_id as admin_user_id,

    -- Expected TRUE
    (
      exists (
        select 1
        from public.student_accounts sa
        where sa.id = sc.user_id
          and (
            sa.student_id = sc.own_student_id
            or sa.process_number = (
              select process_number from public.students where id = sc.own_student_id
            )
          )
      )
    ) as student_can_see_own,

    -- Expected FALSE
    (
      exists (
        select 1
        from public.student_accounts sa
        where sa.id = sc.user_id
          and (
            sa.student_id = os.student_id
            or sa.process_number = (
              select process_number from public.students where id = os.student_id
            )
          )
      )
      or exists (
        select 1
        from public.job_applications ja
        join public.partners p on p.id = ja.partner_id
        where ja.student_id = os.student_id
          and p.created_by = sc.user_id
      )
      or exists (
        select 1
        from public.company_progress cp
        join public.partners p on p.id = cp.partner_id
        where cp.student_id = os.student_id
          and p.created_by = sc.user_id
      )
      or exists (
        select 1
        from public.user_profiles up
        where up.id = sc.user_id
          and up.type = 'admin'
      )
    ) as student_can_see_other,

    -- Expected TRUE when linked student exists, otherwise NULL
    (
      case
        when cls.student_id is null then null
        else (
          exists (
            select 1
            from public.job_applications ja
            join public.partners p on p.id = ja.partner_id
            where ja.student_id = cls.student_id
              and p.created_by = cc.user_id
          )
          or exists (
            select 1
            from public.company_progress cp
            join public.partners p on p.id = cp.partner_id
            where cp.student_id = cls.student_id
              and p.created_by = cc.user_id
          )
        )
      end
    ) as company_can_see_linked,

    -- Expected FALSE
    (
      exists (
        select 1
        from public.job_applications ja
        join public.partners p on p.id = ja.partner_id
        where ja.student_id = cus.student_id
          and p.created_by = cc.user_id
      )
      or exists (
        select 1
        from public.company_progress cp
        join public.partners p on p.id = cp.partner_id
        where cp.student_id = cus.student_id
          and p.created_by = cc.user_id
      )
      or exists (
        select 1
        from public.user_profiles up
        where up.id = cc.user_id
          and up.type = 'admin'
      )
    ) as company_can_see_unlinked,

    -- Expected TRUE
    exists (
      select 1
      from public.user_profiles up
      where up.id = ac.user_id
        and up.type = 'admin'
    ) as admin_can_see_all

  from student_ctx sc
  left join other_student os on true
  left join company_ctx cc on true
  left join company_linked_student cls on true
  left join company_unlinked_student cus on true
  left join admin_ctx ac on true
)
select * from checks;

-- ------------------------------------------------------------
-- C) Optional smoke checks for portfolio ownership references
-- ------------------------------------------------------------
select
  count(*) filter (where sa.id is null) as portfolio_without_student_account_link,
  count(*) as total_portfolio_rows
from public.student_portfolio sp
left join public.student_accounts sa on sa.student_id = sp.student_id;
