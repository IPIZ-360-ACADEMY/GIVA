-- ============================================================
-- GIVA IPIZ — User Profiles & Account Types
-- Executar no Supabase SQL Editor na ordem indicada
-- ============================================================

-- 1. Tipo de conta
DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM ('student', 'company', 'external', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.moderation_status AS ENUM ('active', 'pending', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Perfil base (um por utilizador auth)
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

-- 3. Conta aluno
CREATE TABLE IF NOT EXISTS public.student_accounts (
  id              UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  process_number  TEXT NOT NULL,
  training_area   TEXT,
  course          TEXT,
  CONSTRAINT student_process_unique UNIQUE (process_number)
);

-- 4. Conta empresa / parceiro
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

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_user_profiles_type ON public.user_profiles (type);
CREATE INDEX IF NOT EXISTS idx_user_profiles_moderation ON public.user_profiles (moderation);

-- 6. Trigger updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 7. Trigger: criar perfil automático quando utilizador se regista via OAuth
CREATE OR REPLACE FUNCTION public.handle_new_user_oauth()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _display_name TEXT;
  _avatar_url   TEXT;
BEGIN
  -- Só cria se ainda não existe (pode ter sido criado na signup explícita)
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

-- 8. RLS
ALTER TABLE public.user_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_accounts  ENABLE ROW LEVEL SECURITY;

-- user_profiles: qualquer autenticado lê; só o próprio edita
DROP POLICY IF EXISTS "profiles_select_all"  ON public.user_profiles;
DROP POLICY IF EXISTS "profiles_insert_own"  ON public.user_profiles;
DROP POLICY IF EXISTS "profiles_update_own"  ON public.user_profiles;
DROP POLICY IF EXISTS "profiles_delete_own"  ON public.user_profiles;

CREATE POLICY "profiles_select_all"
  ON public.user_profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles_insert_own"
  ON public.user_profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.user_profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "profiles_delete_own"
  ON public.user_profiles FOR DELETE
  USING (id = auth.uid());

-- student_accounts
DROP POLICY IF EXISTS "student_select_all"   ON public.student_accounts;
DROP POLICY IF EXISTS "student_insert_own"   ON public.student_accounts;
DROP POLICY IF EXISTS "student_update_own"   ON public.student_accounts;

CREATE POLICY "student_select_all"
  ON public.student_accounts FOR SELECT USING (true);

CREATE POLICY "student_insert_own"
  ON public.student_accounts FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "student_update_own"
  ON public.student_accounts FOR UPDATE
  USING (id = auth.uid());

-- company_accounts
DROP POLICY IF EXISTS "company_select_all"   ON public.company_accounts;
DROP POLICY IF EXISTS "company_insert_own"   ON public.company_accounts;
DROP POLICY IF EXISTS "company_update_own"   ON public.company_accounts;

CREATE POLICY "company_select_all"
  ON public.company_accounts FOR SELECT USING (true);

CREATE POLICY "company_insert_own"
  ON public.company_accounts FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "company_update_own"
  ON public.company_accounts FOR UPDATE
  USING (id = auth.uid());
