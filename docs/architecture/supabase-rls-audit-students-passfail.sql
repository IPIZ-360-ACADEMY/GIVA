-- ============================================================
-- GIVA IPIZ - RLS Audit (PASS/FAIL)
-- Scope: public.students + public.student_portfolio
-- Output: one row with overall_status + detailed checks.
-- ============================================================

with
required_policies as (
  select *
  from (values
    ('students','students_select_scoped','SELECT'),
    ('students','students_insert_scoped','INSERT'),
    ('students','students_update_scoped','UPDATE'),
    ('student_portfolio','student_portfolio_select_scoped','SELECT'),
    ('student_portfolio','student_portfolio_insert_scoped','INSERT'),
    ('student_portfolio','student_portfolio_update_scoped','UPDATE'),
    ('student_portfolio','student_portfolio_delete_scoped','DELETE')
  ) as t(tablename, policyname, cmd)
),
policy_check as (
  select
    count(*) = 7 as policies_ok,
    count(*) as matched_policy_count
  from required_policies rp
  join pg_policies p
    on p.schemaname = 'public'
   and p.tablename = rp.tablename
   and p.policyname = rp.policyname
   and upper(p.cmd) = rp.cmd
),
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
logic_check as (
  select
    sc.user_id is not null as has_student_context,
    cc.user_id is not null as has_company_context,
    ac.user_id is not null as has_admin_context,

    -- expected TRUE
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
    ) as student_can_see_own,

    -- expected FALSE
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

    -- expected TRUE when linked candidate exists, otherwise treated as N/A
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
    end as company_can_see_linked,

    -- expected FALSE
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

    -- expected TRUE
    exists (
      select 1
      from public.user_profiles up
      where up.id = ac.user_id
        and up.type = 'admin'
    ) as admin_can_see_all,

    cls.student_id is not null as has_linked_company_student

  from student_ctx sc
  left join other_student os on true
  left join company_ctx cc on true
  left join company_linked_student cls on true
  left join company_unlinked_student cus on true
  left join admin_ctx ac on true
),
portfolio_link_check as (
  select
    count(*) filter (where sa.id is null) = 0 as portfolio_links_ok,
    count(*) filter (where sa.id is null) as portfolio_without_student_account_link,
    count(*) as total_portfolio_rows
  from public.student_portfolio sp
  left join public.student_accounts sa on sa.student_id = sp.student_id
)
select
  case
    when
      pc.policies_ok
      and lc.has_student_context
      and lc.has_company_context
      and lc.has_admin_context
      and lc.student_can_see_own
      and not lc.student_can_see_other
      and (not lc.has_linked_company_student or lc.company_can_see_linked)
      and not lc.company_can_see_unlinked
      and lc.admin_can_see_all
      and plc.portfolio_links_ok
    then 'PASS'
    else 'FAIL'
  end as overall_status,

  pc.policies_ok,
  pc.matched_policy_count,
  lc.has_student_context,
  lc.has_company_context,
  lc.has_admin_context,
  lc.student_can_see_own,
  lc.student_can_see_other,
  lc.has_linked_company_student,
  lc.company_can_see_linked,
  lc.company_can_see_unlinked,
  lc.admin_can_see_all,
  plc.portfolio_links_ok,
  plc.portfolio_without_student_account_link,
  plc.total_portfolio_rows
from policy_check pc
cross join logic_check lc
cross join portfolio_link_check plc;
