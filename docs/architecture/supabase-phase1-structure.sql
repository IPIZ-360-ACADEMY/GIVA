-- ============================================================================
-- FASE 1: Estrutura de Base para Áreas, Candidaturas, Progresso e Perfil
-- ============================================================================
-- Executar no Supabase SQL Editor como admin
-- Dependências: supabase-partners.sql, supabase-core-admin.sql já aplicados

-- ============================================================================
-- 1. Expandir AREA com identificação visual e cores
-- ============================================================================
-- Se a tabela já existe, adicionar colunas. Senão, criar nova.
create table if not exists public.training_area (
  id uuid primary key default gen_random_uuid(),
  code varchar(32) unique not null,
  name varchar(120) not null,
  color_hex varchar(7) not null default '#4a4a4a',
  icon_name varchar(64) default 'school',
  display_order int default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.training_area is 'Áreas de formação: Informatica, Electricidade, Mecanica, Bioquimica';
comment on column public.training_area.code is 'Código único: INFO, ELEC, MECA, BIOQUIM';
comment on column public.training_area.color_hex is 'Cor de identificação (ex: #f18f3b para laranja)';

-- Índices
create index if not exists idx_training_area_code on public.training_area(code);
create index if not exists idx_training_area_active on public.training_area(is_active, display_order);

-- ============================================================================
-- 2. Expandir COURSE com referência a training_area
-- ============================================================================
-- Se courses já existe, adicionar coluna training_area_id
alter table if exists public.courses 
  add column if not exists training_area_id uuid references public.training_area(id);

-- Se courses não existe, criar:
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  training_area_id uuid not null references public.training_area(id),
  code varchar(32) not null,
  name varchar(120) not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(training_area_id, code)
);

-- ============================================================================
-- 3. Expandir STUDENT com perfil completo
-- ============================================================================
-- Adicionar campos ao student existente ou criar versão expandida
alter table if exists public.students add column if not exists phone_number varchar(20);
alter table if exists public.students add column if not exists address text;
alter table if exists public.students add column if not exists city varchar(100);
alter table if exists public.students add column if not exists postal_code varchar(20);
alter table if exists public.students add column if not exists profile_photo_url text;
alter table if exists public.students add column if not exists professional_summary text;
alter table if exists public.students add column if not exists bio text;
alter table if exists public.students add column if not exists skills text[] default '{}';
alter table if exists public.students add column if not exists languages jsonb default '[]'::jsonb;
alter table if exists public.students add column if not exists portfolio_url text;
alter table if exists public.students add column if not exists linkedin_url text;
alter table if exists public.students add column if not exists cv_url text;
alter table if exists public.students add column if not exists cover_letter_url text;
alter table if exists public.students add column if not exists internship_letter_url text;
alter table if exists public.students add column if not exists updated_at timestamptz default now();

-- Se a tabela não existe, criar completa:
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  training_area_id uuid not null references public.training_area(id),
  course_id uuid references public.courses(id),
  class_group_id uuid,
  full_name varchar(140) not null,
  email varchar(160) unique,
  phone_number varchar(20),
  address text,
  city varchar(100),
  postal_code varchar(20),
  profile_photo_url text,
  professional_summary text,
  bio text,
  skills text[] default '{}',
  languages jsonb default '[{"language":"Português","level":"Native"}]'::jsonb,
  portfolio_url text,
  linkedin_url text,
  academic_year int,
  status varchar(24) not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE', 'GRADUATED', 'DROPPED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.students.skills is 'Array de competências: [''React'', ''SQL'', ''Web Design'']';
comment on column public.students.languages is 'JSON: [{language: "Português", level: "Native"}, {language: "English", level: "B2"}]';

-- ============================================================================
-- 4. Tabela STUDENT_PORTFOLIO para projetos/certificações/eventos
-- ============================================================================
create table if not exists public.student_portfolio (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  type varchar(32) not null check (type in ('PROJECT', 'CERTIFICATION', 'COMPETITION', 'VOLUNTEER', 'AWARD')),
  title varchar(200) not null,
  description text,
  start_date date,
  end_date date,
  organization varchar(120),
  url text,
  image_url text,
  tags text[] default '{}',
  is_featured boolean default false,
  created_at timestamptz not null default now()
);

comment on table public.student_portfolio is 'Portfólio do aluno: Projetos, Certificações, Competições, Voluntariado, Prémios';

create index if not exists idx_student_portfolio_student_id on public.student_portfolio(student_id);
create index if not exists idx_student_portfolio_type on public.student_portfolio(type);

-- ============================================================================
-- 5. Tabela JOB_APPLICATION para candidaturas
-- ============================================================================
create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  partner_id uuid not null references public.partners(id),
  status varchar(32) not null default 'PENDING' check (
    status in ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'COMPLETED')
  ),
  applied_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_company_user_id uuid,
  rejection_reason text,
  acceptance_notes text,
  cv_url text,
  cover_letter_url text,
  internship_letter_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, partner_id)
);

alter table if exists public.job_applications add column if not exists cv_url text;
alter table if exists public.job_applications add column if not exists cover_letter_url text;
alter table if exists public.job_applications add column if not exists internship_letter_url text;

comment on table public.job_applications is 'Candidaturas de alunos a empresas parceiras';
comment on column public.job_applications.status is 'PENDING: Aguardando revisão | ACCEPTED: Aceite | REJECTED: Recusado | WITHDRAWN: Retirado pelo aluno | COMPLETED: Completado (passou para estágio/contrato)';

create index if not exists idx_job_applications_student on public.job_applications(student_id, status);
create index if not exists idx_job_applications_partner on public.job_applications(partner_id, status);
create index if not exists idx_job_applications_status on public.job_applications(status, applied_at);

-- ============================================================================
-- 6. Tabela COMPANY_PROGRESS para rastrear progresso na empresa
-- ============================================================================
create table if not exists public.company_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  partner_id uuid not null references public.partners(id),
  job_application_id uuid references public.job_applications(id),
  progression_stage varchar(32) not null default 'INTERVIEW' check (
    progression_stage in ('INTERVIEW', 'INTERNSHIP', 'FIXED_TERM_CONTRACT', 'PERMANENT_CONTRACT', 'COMPLETED', 'TERMINATED')
  ),
  progress_status varchar(32) not null default 'IN_PROGRESS' check (
    progress_status in ('IN_PROGRESS', 'COMPLETED', 'FAILED', 'SUSPENDED')
  ),
  -- Interview details
  interview_date date,
  interview_result varchar(16) check (interview_result in ('ACCEPTED', 'REJECTED', null)),
  interview_notes text,
  -- Internship details
  internship_start_date date,
  internship_end_date date,
  internship_has_compensation boolean,
  internship_compensation_amount decimal(10, 2),
  internship_duration_months int,
  -- Contract details
  contract_type varchar(32) check (contract_type in ('FIXED_TERM', 'PERMANENT', null)),
  contract_start_date date,
  contract_end_date date,
  contract_salary decimal(10, 2),
  -- Status updates
  company_contact_name varchar(120),
  company_contact_email varchar(160),
  company_contact_phone varchar(20),
  status_updated_at timestamptz,
  status_updated_by_email varchar(160),
  -- Assessment
  student_assessment_rating decimal(3, 2) check (student_assessment_rating >= 0 and student_assessment_rating <= 5),
  company_assessment_rating decimal(3, 2) check (company_assessment_rating >= 0 and company_assessment_rating <= 5),
  company_assessment_text text,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.company_progress is 'Rastreamento do progresso do aluno na empresa ao longo das fases';
comment on column public.company_progress.progression_stage is 'Fase atual: Entrevista → Estágio → Contrato Temp. → Contrato Perm. → Concluído/Terminado';

create index if not exists idx_company_progress_student on public.company_progress(student_id);
create index if not exists idx_company_progress_partner on public.company_progress(partner_id);
create index if not exists idx_company_progress_stage on public.company_progress(progression_stage, progress_status);

-- ============================================================================
-- 7. Atualizar PARTNERS com campo de vagas ativas/preenchidas
-- ============================================================================
alter table if exists public.partners add column if not exists vagas_total int default 0;
alter table if exists public.partners add column if not exists vagas_preenchidas int default 0;
alter table if exists public.partners add column if not exists vagas_disponiveis int generated always as (vagas_total - vagas_preenchidas) stored;

-- ============================================================================
-- 8. Tabela EVALUATION (individual + grupo)
-- ============================================================================
create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  training_area_id uuid not null references public.training_area(id),
  evaluation_type varchar(16) not null check (evaluation_type in ('INDIVIDUAL', 'GROUP')),
  group_evaluation_id uuid references public.evaluations(id),
  student_id uuid not null references public.students(id),
  evaluator_id uuid not null references public.students(id),
  subject varchar(120) not null,
  score decimal(5, 2) not null check (score >= 0 and score <= 20),
  feedback text,
  evaluation_date timestamp not null,
  is_final boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.evaluations is 'Avaliações de alunos - individual ou grupo';
comment on column public.evaluations.evaluation_type is 'INDIVIDUAL: Avaliação de um aluno | GROUP: Avaliação aplicada a múltiplos alunos';
comment on column public.evaluations.group_evaluation_id is 'Se tipo GROUP, este campo identifica a avaliação pai';
comment on column public.evaluations.score is 'Escala 0-20';

create index if not exists idx_evaluations_student on public.evaluations(student_id, evaluation_date);
create index if not exists idx_evaluations_type on public.evaluations(evaluation_type, training_area_id);
create index if not exists idx_evaluations_group on public.evaluations(group_evaluation_id);

-- ============================================================================
-- 9. TRIGGERS para manter updated_at
-- ============================================================================
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_training_area_updated_at on public.training_area;
create trigger update_training_area_updated_at
before update on public.training_area
for each row
execute function public.update_updated_at_column();

drop trigger if exists update_students_updated_at on public.students;
create trigger update_students_updated_at
before update on public.students
for each row
execute function public.update_updated_at_column();

drop trigger if exists update_job_applications_updated_at on public.job_applications;
create trigger update_job_applications_updated_at
before update on public.job_applications
for each row
execute function public.update_updated_at_column();

drop trigger if exists update_company_progress_updated_at on public.company_progress;
create trigger update_company_progress_updated_at
before update on public.company_progress
for each row
execute function public.update_updated_at_column();

-- ============================================================================
-- 10. Seed: Training Areas com cores
-- ============================================================================
insert into public.training_area (code, name, color_hex, icon_name, display_order)
values
  ('INFO', 'Informatica', '#4a4a4a', 'computer', 1),
  ('ELEC', 'Electricidade', '#f18f3b', 'bolt', 2),
  ('MECA', 'Mecanica', '#0f6d67', 'settings', 3),
  ('BIOQUIM', 'Bioquimica', '#6ba076', 'science', 4)
on conflict (code) do nothing;

do $$
begin
  raise notice 'FASE 1 criada com sucesso!';
end $$;
