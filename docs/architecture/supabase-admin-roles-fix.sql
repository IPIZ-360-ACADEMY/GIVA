-- ============================================================
-- GIVA IPIZ - Fix: criação de contas administrativas e académicas
-- Objetivo:
-- 1) Permitir account_type 'coordinator' e 'teacher'
-- 2) Permitir todos os roles da plataforma nos RPCs de admin
-- 3) Garantir que contas criadas pelo SUPER_ADMIN conseguem login
-- ============================================================

-- 1) Estender enum account_type
ALTER TYPE public.account_type ADD VALUE IF NOT EXISTS 'coordinator';
ALTER TYPE public.account_type ADD VALUE IF NOT EXISTS 'teacher';

-- 2) Recriar RPC admin_create_platform_user com validações expandidas
CREATE OR REPLACE FUNCTION public.admin_create_platform_user(
  p_email text,
  p_password text,
  p_display_name text,
  p_type text,
  p_role text,
  p_moderation text DEFAULT 'active',
  p_require_password_change boolean DEFAULT true,
  p_process_number text DEFAULT null,
  p_area_id text DEFAULT null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid;
  v_area_id uuid;
  v_app_meta jsonb;
  v_email text;
  v_process text;
  v_login_email text;
BEGIN
  IF public.current_app_role() <> 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'Acesso negado: requer SUPER_ADMIN';
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'Email e obrigatorio';
  END IF;

  IF p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'Password deve ter pelo menos 8 caracteres';
  END IF;

  IF p_type NOT IN ('student', 'company', 'external', 'admin', 'coordinator', 'teacher') THEN
    RAISE EXCEPTION 'Tipo invalido. Valores aceites: student, company, external, admin, coordinator, teacher';
  END IF;

  IF p_role NOT IN ('SUPER_ADMIN', 'ADMIN_1', 'COORDINATOR', 'TEACHER', 'STUDENT', 'COMPANY', 'ADMIN', 'EXTERNAL', 'authenticated') THEN
    RAISE EXCEPTION 'Role invalido. Valores aceites: SUPER_ADMIN, ADMIN_1, COORDINATOR, TEACHER, STUDENT, COMPANY, ADMIN, EXTERNAL, authenticated';
  END IF;

  v_email := lower(trim(p_email));

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'Ja existe um utilizador com este email';
  END IF;

  IF p_role IN ('COORDINATOR', 'ADMIN_1') THEN
    IF p_area_id IS NULL OR trim(p_area_id) = '' THEN
      RAISE EXCEPTION 'area_id e obrigatorio para o role Coordenador';
    END IF;

    BEGIN
      v_area_id := p_area_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'area_id tem formato UUID invalido';
    END;

    IF NOT EXISTS (SELECT 1 FROM public.training_area WHERE id = v_area_id AND is_active = true) THEN
      RAISE EXCEPTION 'Area de formacao invalida ou inactiva';
    END IF;
  END IF;

  v_uid := gen_random_uuid();

  v_app_meta := jsonb_build_object('role', p_role);
  IF v_area_id IS NOT NULL THEN
    v_app_meta := v_app_meta || jsonb_build_object('area_id', v_area_id::text);
  END IF;

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, aud, role
  ) VALUES (
    v_uid,
    '00000000-0000-0000-0000-000000000000',
    v_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    v_app_meta,
    jsonb_build_object(
      'display_name', p_display_name,
      'must_change_password', coalesce(p_require_password_change, true)
    ),
    now(),
    now(),
    'authenticated',
    'authenticated'
  );

  INSERT INTO public.user_profiles (id, display_name, type, moderation)
  VALUES (v_uid, p_display_name, p_type::public.account_type, p_moderation::public.moderation_status)
  ON CONFLICT (id) DO UPDATE
  SET display_name = excluded.display_name,
      type = excluded.type,
      moderation = excluded.moderation;

  IF p_type = 'student' AND p_process_number IS NOT NULL AND trim(p_process_number) <> '' THEN
    v_process := upper(trim(p_process_number));
    v_login_email := lower('aluno.' || lower(v_process) || '@giva.ao');

    INSERT INTO public.student_accounts (id, process_number)
    VALUES (v_uid, v_process)
    ON CONFLICT (id) DO UPDATE SET process_number = excluded.process_number;

    INSERT INTO public.auth_login_aliases (alias, user_id, login_email, account_type)
    VALUES (lower(v_process), v_uid, v_login_email, 'student')
    ON CONFLICT (alias) DO UPDATE
    SET user_id = excluded.user_id,
        login_email = excluded.login_email;

    INSERT INTO public.auth_login_aliases (alias, user_id, login_email, account_type)
    VALUES (v_login_email, v_uid, v_login_email, 'student')
    ON CONFLICT (alias) DO UPDATE
    SET user_id = excluded.user_id,
        login_email = excluded.login_email;
  END IF;

  INSERT INTO public.auth_login_aliases (alias, user_id, login_email, account_type)
  VALUES (v_email, v_uid, v_email, p_type)
  ON CONFLICT (alias) DO UPDATE
  SET user_id = excluded.user_id,
      login_email = excluded.login_email;

  RETURN v_uid;
END;
$$;

-- 3) Recriar RPC admin_set_user_role com validação expandida
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_target_uid uuid,
  p_new_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF public.current_app_role() <> 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'Acesso negado: requer SUPER_ADMIN';
  END IF;

  IF p_new_role NOT IN ('SUPER_ADMIN', 'ADMIN_1', 'COORDINATOR', 'TEACHER', 'STUDENT', 'COMPANY', 'ADMIN', 'EXTERNAL', 'authenticated') THEN
    RAISE EXCEPTION 'Role invalido. Valores aceites: SUPER_ADMIN, ADMIN_1, COORDINATOR, TEACHER, STUDENT, COMPANY, ADMIN, EXTERNAL, authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_uid) THEN
    RAISE EXCEPTION 'Utilizador nao encontrado';
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', p_new_role),
      updated_at = now()
  WHERE id = p_target_uid;
END;
$$;

-- 4) Correcção opcional de aliases para contas existentes
UPDATE public.auth_login_aliases ala
SET account_type = up.type::text
FROM public.user_profiles up
WHERE ala.user_id = up.id
  AND up.type::text IN ('coordinator', 'teacher')
  AND ala.account_type NOT IN ('coordinator', 'teacher');
