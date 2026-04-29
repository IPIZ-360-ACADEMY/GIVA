-- ============================================================
-- GIVA IPIZ — Patch incremental (produção)
-- Objetivo: adicionar campos de documentos do aluno
-- Escopo: students + job_applications
-- Seguro para múltiplas execuções (IF NOT EXISTS)
-- ============================================================

begin;

-- 1) Campos no perfil académico do aluno
alter table if exists public.students
  add column if not exists cv_url text,
  add column if not exists cover_letter_url text,
  add column if not exists internship_letter_url text;

comment on column public.students.cv_url is 'URL pública do CV do aluno';
comment on column public.students.cover_letter_url is 'URL da carta de apresentação do aluno';
comment on column public.students.internship_letter_url is 'URL da carta de estágio do aluno';

-- 2) Snapshot de anexos na candidatura
alter table if exists public.job_applications
  add column if not exists cv_url text,
  add column if not exists cover_letter_url text,
  add column if not exists internship_letter_url text;

comment on column public.job_applications.cv_url is 'Snapshot do CV no momento da candidatura';
comment on column public.job_applications.cover_letter_url is 'Snapshot da carta de apresentação no momento da candidatura';
comment on column public.job_applications.internship_letter_url is 'Snapshot da carta de estágio no momento da candidatura';

commit;

-- Verificação rápida
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'students'
  and column_name in ('cv_url', 'cover_letter_url', 'internship_letter_url')
order by column_name;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'job_applications'
  and column_name in ('cv_url', 'cover_letter_url', 'internship_letter_url')
order by column_name;
