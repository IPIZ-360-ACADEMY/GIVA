-- ============================================================
-- GIVA IPIZ - Admin Company Login Fix
-- Data: 2026-05-07
--
-- Objetivo:
-- Corrigir login de contas empresa criadas no painel "Utilizadores".
--
-- Correcoes aplicadas:
--  1) Recria admin_create_platform_user com metadata de auth por email
--     (provider/providers) e validacao de email.
--  2) Grava auth.users no "shape" nativo (tokens vazios + status padrao).
--  3) Garante auth.identities para login por password.
--  4) Backfill em auth.users para contas locais sem provider/providers.
--  5) Normaliza contas company existentes para evitar erro
--     "Database error querying schema".
--  6) Sincroniza user_profiles.email com auth.users.email.
--  7) Garante company_accounts para todos os perfis company.
--  8) Garante alias de login por email para contas company.
--
-- Nota:
-- Esta versao usa NIF provisório AUTO-* para respeitar a governanca
-- atual (trigger exige NIF obrigatorio).
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_create_platform_user(
  p_email text,
  p_password text,
  p_display_name text,
  p_type text,
  p_role text,
  p_moderation text DEFAULT 'active',
  p_require_password_change boolean DEFAULT true,
  p_process_number text DEFAULT NULL,
  p_area_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid         uuid;
  v_area_id     uuid;
  v_app_meta    jsonb;
  v_user_meta   jsonb;
  v_email       text;
  v_process     text;
  v_login_email text;
  v_company_nif text;
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

  IF position('@' in v_email) = 0 OR split_part(v_email, '@', 2) = '' THEN
    RAISE EXCEPTION 'Email invalido para login';
  END IF;

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

    IF NOT EXISTS (
      SELECT 1
      FROM public.training_area ta
      WHERE ta.id = v_area_id
        AND ta.is_active = true
    ) THEN
      RAISE EXCEPTION 'Area de formacao invalida ou inactiva';
    END IF;
  END IF;

  v_uid := gen_random_uuid();

  v_app_meta := jsonb_build_object(
    'provider', 'email',
    'providers', jsonb_build_array('email'),
    'role', p_role
  );

  IF v_area_id IS NOT NULL THEN
    v_app_meta := v_app_meta || jsonb_build_object('area_id', v_area_id::text);
  END IF;

  v_user_meta := jsonb_build_object(
    'sub', v_uid::text,
    'display_name', p_display_name,
    'email', v_email,
    'email_verified', true,
    'phone_verified', false,
    'must_change_password', coalesce(p_require_password_change, true)
  );

  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change,
    email_change_token_new,
    email_change_token_current,
    phone_change,
    phone_change_token,
    reauthentication_token,
    email_change_confirm_status,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous
  ) VALUES (
    v_uid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf'::text, 10)),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    0,
    v_app_meta,
    v_user_meta,
    now(),
    now(),
    false,
    false
  );

  INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    created_at,
    updated_at,
    last_sign_in_at
  ) VALUES (
    v_uid::text,
    v_uid,
    jsonb_build_object(
      'sub', v_uid::text,
      'email', v_email,
      'display_name', p_display_name,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    NULL
  )
  ON CONFLICT (provider_id, provider)
  DO UPDATE SET
    user_id = excluded.user_id,
    identity_data = excluded.identity_data,
    updated_at = now();

  INSERT INTO public.user_profiles (id, display_name, type, moderation, email)
  VALUES (v_uid, p_display_name, p_type::public.account_type, p_moderation::public.moderation_status, v_email)
  ON CONFLICT (id) DO UPDATE
    SET display_name = excluded.display_name,
        type         = excluded.type,
        moderation   = excluded.moderation,
        email        = COALESCE(excluded.email, public.user_profiles.email);

  IF p_type = 'company' THEN
    v_company_nif := 'AUTO-' || upper(replace(left(v_uid::text, 12), '-', ''));

    INSERT INTO public.company_accounts (id, empresa, nif)
    VALUES (
      v_uid,
      COALESCE(NULLIF(trim(p_display_name), ''), split_part(v_email, '@', 1)),
      v_company_nif
    )
    ON CONFLICT (id) DO UPDATE
      SET empresa = COALESCE(NULLIF(excluded.empresa, ''), public.company_accounts.empresa);
  END IF;

  IF p_type = 'student' AND p_process_number IS NOT NULL AND trim(p_process_number) <> '' THEN
    v_process     := upper(trim(p_process_number));
    v_login_email := lower('aluno.' || lower(v_process) || '@giva.ao');

    INSERT INTO public.student_accounts (id, process_number)
    VALUES (v_uid, v_process)
    ON CONFLICT (id) DO UPDATE SET process_number = excluded.process_number;

    INSERT INTO public.auth_login_aliases (alias, user_id, login_email, account_type)
    VALUES (lower(v_process), v_uid, v_login_email, 'student')
    ON CONFLICT (alias) DO UPDATE SET
      user_id      = excluded.user_id,
      login_email  = excluded.login_email,
      account_type = excluded.account_type;

    INSERT INTO public.auth_login_aliases (alias, user_id, login_email, account_type)
    VALUES (v_login_email, v_uid, v_login_email, 'student')
    ON CONFLICT (alias) DO UPDATE SET
      user_id      = excluded.user_id,
      login_email  = excluded.login_email,
      account_type = excluded.account_type;
  END IF;

  INSERT INTO public.auth_login_aliases (alias, user_id, login_email, account_type)
  VALUES (v_email, v_uid, v_email, p_type)
  ON CONFLICT (alias) DO UPDATE SET
    user_id      = excluded.user_id,
    login_email  = excluded.login_email,
    account_type = excluded.account_type;

  RETURN v_uid;
END;
$$;

UPDATE auth.users au
SET raw_app_meta_data =
      (COALESCE(au.raw_app_meta_data, '{}'::jsonb) - 'provider' - 'providers') ||
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')) ||
      CASE
        WHEN COALESCE(au.raw_app_meta_data, '{}'::jsonb) ? 'role'
          THEN jsonb_build_object('role', COALESCE(au.raw_app_meta_data->>'role', 'authenticated'))
        ELSE '{}'::jsonb
      END,
    raw_user_meta_data = COALESCE(au.raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('email', lower(au.email), 'email_verified', true),
    email_confirmed_at = COALESCE(au.email_confirmed_at, now()),
    updated_at = now()
WHERE au.encrypted_password IS NOT NULL
  AND (
    au.raw_app_meta_data IS NULL
    OR au.raw_app_meta_data->>'provider' IS DISTINCT FROM 'email'
    OR NOT (COALESCE(au.raw_app_meta_data->'providers', '[]'::jsonb) @> '["email"]'::jsonb)
  );

UPDATE auth.users au
SET
  confirmation_token = COALESCE(au.confirmation_token, ''),
  recovery_token = COALESCE(au.recovery_token, ''),
  email_change = COALESCE(au.email_change, ''),
  email_change_token_new = COALESCE(au.email_change_token_new, ''),
  email_change_token_current = COALESCE(au.email_change_token_current, ''),
  phone_change = COALESCE(au.phone_change, ''),
  phone_change_token = COALESCE(au.phone_change_token, ''),
  reauthentication_token = COALESCE(au.reauthentication_token, ''),
  email_change_confirm_status = COALESCE(au.email_change_confirm_status, 0),
  raw_user_meta_data = COALESCE(au.raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('sub', au.id::text)
    || jsonb_build_object('phone_verified', COALESCE((au.raw_user_meta_data->>'phone_verified')::boolean, false))
WHERE au.id IN (
  SELECT up.id
  FROM public.user_profiles up
  WHERE up.type = 'company'
);

INSERT INTO auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  created_at,
  updated_at,
  last_sign_in_at
)
SELECT
  au.id::text,
  au.id,
  jsonb_build_object(
    'sub', au.id::text,
    'email', lower(au.email),
    'display_name', up.display_name,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  COALESCE(au.created_at, now()),
  now(),
  NULL
FROM public.user_profiles up
JOIN auth.users au ON au.id = up.id
LEFT JOIN auth.identities ai
  ON ai.user_id = au.id AND ai.provider = 'email'
WHERE up.type = 'company'
  AND ai.user_id IS NULL
ON CONFLICT (provider_id, provider)
DO UPDATE SET
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  updated_at = now();

UPDATE auth.identities ai
SET identity_data = COALESCE(ai.identity_data, '{}'::jsonb)
  || jsonb_build_object('sub', ai.user_id::text)
  || jsonb_build_object('phone_verified', COALESCE((ai.identity_data->>'phone_verified')::boolean, false))
WHERE ai.provider = 'email'
  AND ai.user_id IN (
    SELECT up.id
    FROM public.user_profiles up
    WHERE up.type = 'company'
  );

UPDATE public.user_profiles up
SET email = lower(au.email)
FROM auth.users au
WHERE au.id = up.id
  AND (up.email IS NULL OR up.email IS DISTINCT FROM lower(au.email));

INSERT INTO public.company_accounts (id, empresa, nif)
SELECT
  up.id,
  COALESCE(NULLIF(trim(up.display_name), ''), split_part(lower(au.email), '@', 1)),
  'AUTO-' || upper(replace(left(up.id::text, 12), '-', ''))
FROM public.user_profiles up
JOIN auth.users au ON au.id = up.id
LEFT JOIN public.company_accounts ca ON ca.id = up.id
WHERE up.type = 'company'
  AND ca.id IS NULL;

INSERT INTO public.auth_login_aliases (alias, user_id, login_email, account_type)
SELECT lower(au.email), up.id, lower(au.email), 'company'
FROM public.user_profiles up
JOIN auth.users au ON au.id = up.id
WHERE up.type = 'company'
ON CONFLICT (alias) DO UPDATE
SET user_id = excluded.user_id,
    login_email = excluded.login_email,
    account_type = excluded.account_type;
