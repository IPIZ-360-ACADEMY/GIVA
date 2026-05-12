-- =============================================================================
-- GIVA — Auth + MFA + Security Hardening
-- Data: 12 mai 2026
-- Objetivo:
-- 1) Tornar signup de aluno compatível com confirmação por email
-- 2) Criar artefactos de student no backend mesmo sem sessão pós-signUp
-- 3) Fechar exposição pública de views que fazem JOIN com auth.users
-- 4) Garantir RLS mínimo em public.evaluations
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_oauth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
SET row_security TO off
AS $$
DECLARE
  _display_name   TEXT;
  _avatar_url     TEXT;
  _user_type      TEXT;
  _account_type   public.account_type;
  _moderation     public.moderation_status;
  _empresa        TEXT;
  _nif            TEXT;
  _process_number TEXT;
  _student_id     UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  _user_type := COALESCE(
    NEW.raw_user_meta_data->>'user_type',
    NEW.raw_user_meta_data->>'account_type',
    'external'
  );

  CASE _user_type
    WHEN 'company'     THEN _account_type := 'company';  _moderation := 'pending';
    WHEN 'student'     THEN _account_type := 'student';  _moderation := 'active';
    WHEN 'admin'       THEN _account_type := 'admin';    _moderation := 'active';
    WHEN 'coordinator' THEN _account_type := 'admin';    _moderation := 'active';
    ELSE                    _account_type := 'external'; _moderation := 'active';
  END CASE;

  _display_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    split_part(NEW.email, '@', 1)
  );

  _avatar_url := NULLIF(COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  ), '');

  INSERT INTO public.user_profiles (id, type, display_name, avatar_url, moderation, email)
  VALUES (NEW.id, _account_type, _display_name, _avatar_url, _moderation, NEW.email)
  ON CONFLICT (id) DO UPDATE
    SET type         = EXCLUDED.type,
        moderation   = EXCLUDED.moderation,
        display_name = COALESCE(EXCLUDED.display_name, public.user_profiles.display_name),
        email        = COALESCE(EXCLUDED.email, public.user_profiles.email);

  IF _account_type = 'company' THEN
    _empresa := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'empresa'), ''),
      _display_name
    );
    _nif := NULLIF(TRIM(NEW.raw_user_meta_data->>'nif'), '');
    IF _nif IS NULL THEN
      _nif := 'AUTO-' || UPPER(REPLACE(LEFT(NEW.id::text, 12), '-', ''));
    END IF;

    INSERT INTO public.company_accounts (
      id,
      empresa,
      nif,
      localizacao,
      responsible_name,
      responsible_contact
    ) VALUES (
      NEW.id,
      _empresa,
      _nif,
      NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'localizacao', '')), ''),
      NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'responsible_name', '')), ''),
      NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'responsible_contact', '')), '')
    )
    ON CONFLICT (id) DO UPDATE
      SET empresa             = COALESCE(NULLIF(EXCLUDED.empresa, ''), public.company_accounts.empresa),
          nif                 = COALESCE(NULLIF(EXCLUDED.nif, ''), public.company_accounts.nif),
          localizacao         = COALESCE(EXCLUDED.localizacao, public.company_accounts.localizacao),
          responsible_name    = COALESCE(EXCLUDED.responsible_name, public.company_accounts.responsible_name),
          responsible_contact = COALESCE(EXCLUDED.responsible_contact, public.company_accounts.responsible_contact);
  END IF;

  IF _account_type = 'student' AND to_regclass('public.student_accounts') IS NOT NULL THEN
    _process_number := UPPER(TRIM(COALESCE(NEW.raw_user_meta_data->>'process_number', '')));

    IF _process_number <> '' THEN
      BEGIN
        _student_id := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'student_id', '')), '')::uuid;
      EXCEPTION
        WHEN invalid_text_representation THEN
          _student_id := NULL;
      END;

      BEGIN
        INSERT INTO public.student_accounts (id, process_number, student_id)
        VALUES (NEW.id, _process_number, _student_id)
        ON CONFLICT (id) DO UPDATE
          SET process_number = EXCLUDED.process_number,
              student_id = COALESCE(EXCLUDED.student_id, public.student_accounts.student_id);
      EXCEPTION
        WHEN undefined_column THEN
          INSERT INTO public.student_accounts (id, process_number)
          VALUES (NEW.id, _process_number)
          ON CONFLICT (id) DO UPDATE
            SET process_number = EXCLUDED.process_number;
      END;

      IF to_regclass('public.auth_login_aliases') IS NOT NULL THEN
        INSERT INTO public.auth_login_aliases (alias, user_id, login_email, account_type)
        VALUES (LOWER(_process_number), NEW.id, LOWER(NEW.email), 'student')
        ON CONFLICT (alias) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          login_email = EXCLUDED.login_email,
          account_type = EXCLUDED.account_type;

        INSERT INTO public.auth_login_aliases (alias, user_id, login_email, account_type)
        VALUES (LOWER(NEW.email), NEW.id, LOWER(NEW.email), 'student')
        ON CONFLICT (alias) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          login_email = EXCLUDED.login_email,
          account_type = EXCLUDED.account_type;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_user_oauth ON auth.users;
CREATE TRIGGER trg_new_user_oauth
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_oauth();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
      AND policyname = 'profiles_insert_system'
  ) THEN
    EXECUTE '
      CREATE POLICY profiles_insert_system ON public.user_profiles
      FOR INSERT
      TO postgres
      WITH CHECK (true)
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
      AND policyname = 'profiles_insert_system_auth_admin'
  ) THEN
    EXECUTE '
      CREATE POLICY profiles_insert_system_auth_admin ON public.user_profiles
      FOR INSERT
      TO supabase_auth_admin
      WITH CHECK (true)
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
      AND policyname = 'profiles_insert_via_trigger'
  ) THEN
    EXECUTE '
      CREATE POLICY profiles_insert_via_trigger ON public.user_profiles
      FOR INSERT
      TO public
      WITH CHECK (pg_trigger_depth() > 0)
    ';
  END IF;

  IF to_regclass('public.user_profiles_with_email') IS NOT NULL THEN
    EXECUTE 'ALTER VIEW public.user_profiles_with_email SET (security_invoker = true)';
    EXECUTE 'REVOKE ALL ON TABLE public.user_profiles_with_email FROM anon, authenticated';
  END IF;

  IF to_regclass('public.company_accounts_quality') IS NOT NULL THEN
    EXECUTE 'ALTER VIEW public.company_accounts_quality SET (security_invoker = true)';
    EXECUTE 'REVOKE ALL ON TABLE public.company_accounts_quality FROM anon, authenticated';
  END IF;
END $$;

ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'evaluations' AND policyname = 'evaluations_select_scoped'
  ) THEN
    EXECUTE '
      CREATE POLICY evaluations_select_scoped ON public.evaluations
      FOR SELECT
      TO authenticated
      USING (
        public.current_app_role() IN (''SUPER_ADMIN'', ''ADMIN_1'')
        OR public.has_cross_area_scope()
        OR training_area_id = public.current_area_id()
      )
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'evaluations' AND policyname = 'evaluations_insert_scoped'
  ) THEN
    EXECUTE '
      CREATE POLICY evaluations_insert_scoped ON public.evaluations
      FOR INSERT
      TO authenticated
      WITH CHECK (
        (
          public.current_app_role() IN (''SUPER_ADMIN'', ''ADMIN_1'')
          OR public.has_cross_area_scope()
          OR training_area_id = public.current_area_id()
        )
        AND evaluator_id = auth.uid()
      )
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'evaluations' AND policyname = 'evaluations_update_scoped'
  ) THEN
    EXECUTE '
      CREATE POLICY evaluations_update_scoped ON public.evaluations
      FOR UPDATE
      TO authenticated
      USING (
        (
          public.current_app_role() IN (''SUPER_ADMIN'', ''ADMIN_1'')
          OR public.has_cross_area_scope()
          OR training_area_id = public.current_area_id()
        )
        AND evaluator_id = auth.uid()
      )
      WITH CHECK (
        (
          public.current_app_role() IN (''SUPER_ADMIN'', ''ADMIN_1'')
          OR public.has_cross_area_scope()
          OR training_area_id = public.current_area_id()
        )
        AND evaluator_id = auth.uid()
      )
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'evaluations' AND policyname = 'evaluations_delete_scoped'
  ) THEN
    EXECUTE '
      CREATE POLICY evaluations_delete_scoped ON public.evaluations
      FOR DELETE
      TO authenticated
      USING (
        public.current_app_role() IN (''SUPER_ADMIN'', ''ADMIN_1'')
        OR public.has_cross_area_scope()
        OR evaluator_id = auth.uid()
      )
    ';
  END IF;
END $$;