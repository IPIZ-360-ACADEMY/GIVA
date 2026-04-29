-- ============================================================
-- GIVA IPIZ — Signup Upgrade: Student Verification + Company Pending
-- Auto-suficiente: cria as tabelas base se ainda não existirem
-- Pode ser executado sozinho ou após supabase-user-profiles.sql
-- ============================================================

-- ============================================================
-- 0. Tipos e tabelas base (idempotente — ignorado se já existir)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM ('student', 'company', 'external', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.moderation_status AS ENUM ('active', 'pending', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  type          public.account_type NOT NULL DEFAULT 'external',
  display_name  TEXT NOT NULL DEFAULT '',
  avatar_url    TEXT,
  bio           TEXT,
  moderation    public.moderation_status NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_accounts (
  id              UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  process_number  TEXT NOT NULL,
  training_area   TEXT,
  course          TEXT,
  CONSTRAINT student_process_unique UNIQUE (process_number)
);

CREATE TABLE IF NOT EXISTS public.company_accounts (
  id          UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  empresa     TEXT NOT NULL DEFAULT '',
  nif         TEXT NOT NULL,
  setor       TEXT,
  logo_url    TEXT,
  endereco    TEXT,
  cidade      TEXT,
  website     TEXT,
  CONSTRAINT company_nif_unique UNIQUE (nif)
);

-- RLS (caso as tabelas tenham sido criadas agora)
ALTER TABLE public.user_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_accounts ENABLE ROW LEVEL SECURITY;

-- Políticas mínimas (ignoradas se já existirem)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_profiles' AND policyname='profiles_select_all') THEN
    EXECUTE 'CREATE POLICY profiles_select_all ON public.user_profiles FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_profiles' AND policyname='profiles_insert_own') THEN
    EXECUTE 'CREATE POLICY profiles_insert_own ON public.user_profiles FOR INSERT WITH CHECK (id = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_profiles' AND policyname='profiles_update_own') THEN
    EXECUTE 'CREATE POLICY profiles_update_own ON public.user_profiles FOR UPDATE USING (id = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='student_accounts' AND policyname='student_select_all') THEN
    EXECUTE 'CREATE POLICY student_select_all ON public.student_accounts FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='student_accounts' AND policyname='student_insert_own') THEN
    EXECUTE 'CREATE POLICY student_insert_own ON public.student_accounts FOR INSERT WITH CHECK (id = auth.uid())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='student_accounts' AND policyname='student_update_own') THEN
    EXECUTE 'CREATE POLICY student_update_own ON public.student_accounts FOR UPDATE USING (id = auth.uid())';
  END IF;
END $$;

-- Trigger para criação automática de perfil OAuth (caso não exista)
CREATE OR REPLACE FUNCTION public.handle_new_user_oauth()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _display_name TEXT;
  _avatar_url   TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;
  _display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  _avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );
  INSERT INTO public.user_profiles (id, type, display_name, avatar_url)
  VALUES (NEW.id, 'external', _display_name, _avatar_url);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_user_oauth ON auth.users;
CREATE TRIGGER trg_new_user_oauth
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_oauth();

-- ============================================================
-- 1. Adicionar colunas à tabela students (registo administrativo)
-- ============================================================
ALTER TABLE IF EXISTS public.students
  ADD COLUMN IF NOT EXISTS process_number    VARCHAR(32),
  ADD COLUMN IF NOT EXISTS date_of_birth     DATE,
  ADD COLUMN IF NOT EXISTS guardian_name     VARCHAR(140),
  ADD COLUMN IF NOT EXISTS guardian_phone    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS guardian_email    VARCHAR(160),
  ADD COLUMN IF NOT EXISTS guardian_relation VARCHAR(64);

-- Unicidade do número de processo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'students_process_number_unique'
  ) THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_process_number_unique UNIQUE (process_number);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_students_process_number ON public.students(process_number);

-- ============================================================
-- 2. Adicionar campos de responsável e localização na empresa
-- ============================================================
ALTER TABLE IF EXISTS public.company_accounts
  ADD COLUMN IF NOT EXISTS responsible_name    TEXT,
  ADD COLUMN IF NOT EXISTS responsible_contact TEXT,
  ADD COLUMN IF NOT EXISTS localizacao         TEXT;
 
-- ============================================================
-- 3. Ligar student_accounts ao registo administrativo (students)
-- ============================================================
ALTER TABLE IF EXISTS public.student_accounts
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.students(id);

CREATE INDEX IF NOT EXISTS idx_student_accounts_student_id
  ON public.student_accounts(student_id);

-- ============================================================
-- 4. RPC pública: verificar número de processo IPIZ
--    Acessível a anon + authenticated.
--    Não expõe dados se processo já tiver conta GIVA activa.
-- ============================================================
CREATE OR REPLACE FUNCTION public.verify_student_process_number(p_number TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student RECORD;
BEGIN
  p_number := TRIM(p_number);

  -- Verificar se já existe conta GIVA ligada a este processo
  IF EXISTS (
    SELECT 1 FROM public.student_accounts WHERE process_number = p_number
  ) THEN
    RETURN jsonb_build_object(
      'found',   false,
      'error',   'already_registered',
      'message', 'Este número de processo já tem uma conta GIVA associada. Faz login para continuar.'
    );
  END IF;

  -- Verificar se a tabela students existe antes de consultar
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'students'
  ) THEN
    RETURN jsonb_build_object(
      'found',   false,
      'error',   'not_found',
      'message', 'Número de processo não encontrado. Contacta o coordernador do curso.'
    );
  END IF;

  -- Buscar dados do aluno na base administrativa
  SELECT s.id,
         s.full_name,
         s.date_of_birth,
         s.phone_number,
         s.email,
         s.guardian_name,
         s.guardian_phone,
         s.guardian_relation,
         c.name  AS course_name,
         ta.name AS training_area_name
  INTO _student
  FROM public.students s
  LEFT JOIN public.courses       c  ON c.id  = s.course_id
  LEFT JOIN public.training_area ta ON ta.id = s.training_area_id
  WHERE s.process_number = p_number
    AND s.status = 'ACTIVE'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'found',   false,
      'error',   'not_found',
      'message', 'Número de processo não encontrado ou inactivo. Contacte a coordenação.'
    );
  END IF;

  RETURN jsonb_build_object(
    'found',              true,
    'student_id',         _student.id,
    'full_name',          _student.full_name,
    'date_of_birth',      _student.date_of_birth,
    'phone_number',       _student.phone_number,
    'email',              _student.email,
    'guardian_name',      _student.guardian_name,
    'guardian_phone',     _student.guardian_phone,
    'guardian_relation',  _student.guardian_relation,
    'course_name',        _student.course_name,
    'training_area_name', _student.training_area_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_student_process_number(TEXT) TO anon, authenticated;

-- ============================================================
-- 5. Política para empresas: pending só visível ao próprio ou admin
-- ============================================================
DROP POLICY IF EXISTS "company_select_all"          ON public.company_accounts;
DROP POLICY IF EXISTS "company_select_own_or_active" ON public.company_accounts;

CREATE POLICY "company_select_own_or_active"
  ON public.company_accounts FOR SELECT
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND type = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = public.company_accounts.id AND moderation = 'active'
    )
  );

-- ============================================================
-- Fim do ficheiro — executar no Supabase SQL Editor
-- ============================================================

