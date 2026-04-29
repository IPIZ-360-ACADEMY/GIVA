-- Seed inicial para a tabela public.internships
-- Corre no Supabase SQL Editor APÓS ter aplicado supabase-partners.sql
--
-- Notas:
--   • area_id usa o UUID do SUPER_ADMIN (admin@giva.ao) — ajusta se necessário.
--   • created_by é resolvido em runtime via subquery ao email do admin.
--   • photo fica vazio; preenche com URLs reais (Supabase Storage ou CDN).

do $$
declare
  v_admin_id  uuid;
  v_area_id   uuid := '11111111-1111-1111-1111-111111111111';
begin
  select id into v_admin_id
  from auth.users
  where email = 'admin@giva.ao'
  limit 1;

  if v_admin_id is null then
    raise exception 'Utilizador admin@giva.ao não encontrado. Corre provision-users.mjs primeiro.';
  end if;

  insert into public.internships
    (aluno, turma, ano_letivo, curso, empresa, supervisor, status, inicio, ultima_atualizacao, nota, photo, area_id, created_by)
  values
    ('Ana Melo',          '11-TI-A',    '2025/2026', 'TI',   'Novasoft',    'Eng. Pedro Dias',       'active',     'Fev 2026', '29 Mar 2026',  9.1, '', v_area_id, v_admin_id),
    ('Osvaldo Mane',      '12-EIE-B',   '2025/2026', 'EIE',  'TecnoRed',    'Eng. Marta Chissano',   'monitoring', 'Mar 2026', '27 Mar 2026',  7.8, '', v_area_id, v_admin_id),
    ('Laura Pires',       '11-TLQB-C',  '2025/2026', 'TLQB', 'BioHealth',   'Dra. Ana Furtado',      'risk',       'Jan 2026', '25 Mar 2026',  5.9, '', v_area_id, v_admin_id),
    ('Mateus Simango',    '12-TI-A',    '2025/2026', 'TI',   'Infotech Hub','Eng. Carla Teixeira',   'active',     'Fev 2026', '30 Mar 2026',  8.7, '', v_area_id, v_admin_id),
    ('Catarina Goncalves','12-EIE-B',   '2025/2026', 'EIE',  'Energix',     'Eng. Marta Chissano',   'monitoring', 'Mar 2026', '28 Mar 2026',  7.3, '', v_area_id, v_admin_id),
    ('Joel Francisco',    '11-TLQB-C',  '2025/2026', 'TLQB', 'MediLab',     'Dra. Ana Furtado',      'risk',       'Jan 2026', '24 Mar 2026',  6.1, '', v_area_id, v_admin_id)
  on conflict do nothing;

  raise notice 'Seed de internships concluído (% linhas inseridas)', 6;
end;
$$;
