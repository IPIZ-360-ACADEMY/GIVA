-- ============================================================
-- GIVA IPIZ - Seed consolidado para perfis e dados base
-- Ordem recomendada:
--   1) npm run users:provision:demo
--   2) executar este SQL no Supabase SQL Editor
-- Idempotente: pode ser reexecutado sem duplicar os registros principais.
-- ============================================================

begin;

do $$
declare
  v_admin_id uuid;
  v_company_user_id uuid;
  v_student_user_id uuid;
  v_external_user_id uuid;

  v_area_info uuid;
  v_area_elec uuid;

  v_course_ti uuid;
  v_course_eie uuid;

  v_student_ana uuid;
  v_student_mateus uuid;

  v_partner_novasoft uuid;
  v_partner_tecnored uuid;

  v_application_ana uuid;
begin
  -- ---------------------------------
  -- 1) Utilizadores auth
  -- ---------------------------------
  select id into v_admin_id from auth.users where email = 'admin@giva.ao' limit 1;
  select id into v_company_user_id from auth.users where email = 'empresa.demo@giva.ao' limit 1;
  select id into v_student_user_id from auth.users where email = 'estudante.demo@giva.ao' limit 1;
  select id into v_external_user_id from auth.users where email = 'externo.demo@giva.ao' limit 1;

  if v_admin_id is null then
    raise exception 'admin@giva.ao nao encontrado. Execute npm run users:provision:demo antes.';
  end if;

  -- ---------------------------------
  -- 2) Areas
  -- ---------------------------------
  insert into public.training_area (code, name, color_hex, icon_name, display_order)
  values
    ('INFO', 'Informatica', '#4a4a4a', 'computer', 1),
    ('ELEC', 'Electricidade', '#f18f3b', 'bolt', 2),
    ('MECA', 'Mecanica', '#0f6d67', 'settings', 3),
    ('BIOQUIM', 'Bioquimica', '#6ba076', 'science', 4)
  on conflict (code) do update
    set name = excluded.name,
        color_hex = excluded.color_hex,
        icon_name = excluded.icon_name,
        display_order = excluded.display_order,
        is_active = true;

  select id into v_area_info from public.training_area where code = 'INFO' limit 1;
  select id into v_area_elec from public.training_area where code = 'ELEC' limit 1;

  if v_area_info is null then
    raise exception 'Area INFO nao encontrada apos seed.';
  end if;

  -- ---------------------------------
  -- 3) Cursos
  -- ---------------------------------
  insert into public.courses (training_area_id, code, name, description, is_active)
  values
    (v_area_info, 'TI', 'Tecnologias de Informacao', 'Curso tecnico de TI', true),
    (v_area_elec, 'EIE', 'Eletricidade e Instalacoes Eletricas', 'Curso tecnico de Eletricidade', true)
  on conflict (training_area_id, code) do update
    set name = excluded.name,
        description = excluded.description,
        is_active = true;

  select id into v_course_ti from public.courses where training_area_id = v_area_info and code = 'TI' limit 1;
  select id into v_course_eie from public.courses where training_area_id = v_area_elec and code = 'EIE' limit 1;

  -- ---------------------------------
  -- 4) Perfis base (user_profiles)
  -- ---------------------------------
  if v_admin_id is not null then
    insert into public.user_profiles (id, type, display_name, moderation)
    values (v_admin_id, 'admin', 'Administrador GIVA', 'active')
    on conflict (id) do update
      set type = excluded.type,
          display_name = excluded.display_name,
          moderation = excluded.moderation;
  end if;

  if v_company_user_id is not null then
    insert into public.user_profiles (id, type, display_name, moderation)
    values (v_company_user_id, 'company', 'Empresa Demo GIVA', 'active')
    on conflict (id) do update
      set type = excluded.type,
          display_name = excluded.display_name,
          moderation = excluded.moderation;
  end if;

  if v_student_user_id is not null then
    insert into public.user_profiles (id, type, display_name, moderation)
    values (v_student_user_id, 'student', 'Estudante Demo GIVA', 'active')
    on conflict (id) do update
      set type = excluded.type,
          display_name = excluded.display_name,
          moderation = excluded.moderation;
  end if;

  if v_external_user_id is not null then
    insert into public.user_profiles (id, type, display_name, moderation)
    values (v_external_user_id, 'external', 'Externo Demo GIVA', 'active')
    on conflict (id) do update
      set type = excluded.type,
          display_name = excluded.display_name,
          moderation = excluded.moderation;
  end if;

  -- ---------------------------------
  -- 5) Alunos
  -- ---------------------------------
  insert into public.students (full_name, email, training_area_id, course_id, status)
  values
    ('Ana Melo', 'ana.melo@giva.ao', v_area_info, v_course_ti, 'ACTIVE'),
    ('Mateus Simango', 'mateus.simango@giva.ao', v_area_info, v_course_ti, 'ACTIVE')
  on conflict (email) do update
    set full_name = excluded.full_name,
        training_area_id = excluded.training_area_id,
        course_id = excluded.course_id,
        status = excluded.status;

  select id into v_student_ana from public.students where email = 'ana.melo@giva.ao' limit 1;
  select id into v_student_mateus from public.students where email = 'mateus.simango@giva.ao' limit 1;

  -- ---------------------------------
  -- 6) Empresas (partners)
  -- ---------------------------------
  insert into public.partners (
    empresa, nif, setor, areas, vagas, sla,
    responsavel, telefone, email, website, endereco,
    area_id, created_by
  )
  select
    x.empresa, x.nif, x.setor, x.areas, x.vagas, x.sla,
    x.responsavel, x.telefone, x.email, x.website, x.endereco,
    x.area_id, v_admin_id
  from (
    values
      ('Novasoft', '500000001', 'tech', array['TI'], 8, '48h', 'Pedro Dias', '+244900000001', 'rh@novasoft.ao', 'https://novasoft.ao', 'Luanda', v_area_info),
      ('TecnoRed', '500000002', 'energy', array['EIE'], 6, '72h', 'Marta Chissano', '+244900000002', 'rh@tecnored.ao', 'https://tecnored.ao', 'Benguela', v_area_elec)
  ) as x(empresa, nif, setor, areas, vagas, sla, responsavel, telefone, email, website, endereco, area_id)
  where not exists (
    select 1
    from public.partners p
    where p.empresa = x.empresa
      and p.nif = x.nif
  );

  select id into v_partner_novasoft from public.partners where empresa = 'Novasoft' and nif = '500000001' limit 1;
  select id into v_partner_tecnored from public.partners where empresa = 'TecnoRed' and nif = '500000002' limit 1;

  -- ---------------------------------
  -- 7) Internships dashboard
  -- ---------------------------------
  insert into public.internships
    (aluno, turma, ano_letivo, curso, empresa, supervisor, status, inicio, ultima_atualizacao, nota, photo, area_id, created_by)
  select
    x.aluno, x.turma, x.ano_letivo, x.curso, x.empresa, x.supervisor, x.status, x.inicio, x.ultima_atualizacao, x.nota, '', x.area_id, v_admin_id
  from (
    values
      ('Ana Melo', '11-TI-A', '2025/2026', 'TI', 'Novasoft', 'Eng. Pedro Dias', 'active', 'Fev 2026', '29 Mar 2026', 9.1, v_area_info),
      ('Mateus Simango', '12-TI-A', '2025/2026', 'TI', 'Novasoft', 'Eng. Carla Teixeira', 'active', 'Fev 2026', '30 Mar 2026', 8.7, v_area_info),
      ('Osvaldo Mane', '12-EIE-B', '2025/2026', 'EIE', 'TecnoRed', 'Eng. Marta Chissano', 'monitoring', 'Mar 2026', '27 Mar 2026', 7.8, v_area_elec)
  ) as x(aluno, turma, ano_letivo, curso, empresa, supervisor, status, inicio, ultima_atualizacao, nota, area_id)
  where not exists (
    select 1
    from public.internships i
    where i.aluno = x.aluno
      and i.turma = x.turma
      and i.ano_letivo = x.ano_letivo
      and i.empresa = x.empresa
  );

  -- ---------------------------------
  -- 8) Candidaturas e progresso da empresa
  -- ---------------------------------
  if v_student_ana is not null and v_partner_novasoft is not null then
    insert into public.job_applications (student_id, partner_id, status)
    values (v_student_ana, v_partner_novasoft, 'PENDING')
    on conflict (student_id, partner_id) do update
      set status = excluded.status,
          updated_at = now()
    returning id into v_application_ana;

    if v_application_ana is null then
      select id into v_application_ana
      from public.job_applications
      where student_id = v_student_ana and partner_id = v_partner_novasoft
      limit 1;
    end if;

    if not exists (
      select 1
      from public.company_progress cp
      where cp.student_id = v_student_ana
        and cp.partner_id = v_partner_novasoft
    ) then
      insert into public.company_progress (
        student_id,
        partner_id,
        job_application_id,
        progression_stage,
        progress_status,
        interview_date,
        interview_result,
        company_contact_name,
        company_contact_email
      ) values (
        v_student_ana,
        v_partner_novasoft,
        v_application_ana,
        'INTERVIEW',
        'IN_PROGRESS',
        current_date + 7,
        null,
        'Pedro Dias',
        'rh@novasoft.ao'
      );
    end if;
  end if;

  raise notice 'Seed consolidado concluido com sucesso.';
end $$;

commit;
