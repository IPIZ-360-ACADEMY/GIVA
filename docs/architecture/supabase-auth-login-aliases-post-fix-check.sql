-- ============================================================
-- GIVA IPIZ - Verificação pós-fix de auth_login_aliases
-- Cobre:
-- 1) Constraint account_type
-- 2) Criação de coordenador/professor sem erro (RPC admin)
-- 3) Integridade dos aliases existentes
-- ============================================================

-- ------------------------------------------------------------
-- [1] Verificar se a constraint existe e contempla os tipos esperados
-- ------------------------------------------------------------
WITH constraint_def AS (
  SELECT
    c.conname,
    pg_get_constraintdef(c.oid) AS definition
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'auth_login_aliases'
    AND c.conname = 'auth_login_aliases_account_type_check'
)
SELECT
  conname,
  definition,
  (
    position('student' in definition) > 0
    AND position('company' in definition) > 0
    AND position('external' in definition) > 0
    AND position('admin' in definition) > 0
    AND position('coordinator' in definition) > 0
    AND position('teacher' in definition) > 0
    AND position('admin_1' in definition) > 0
    AND position('super_admin' in definition) > 0
  ) AS covers_expected_values
FROM constraint_def;

-- ------------------------------------------------------------
-- [1b] Verificar linhas inválidas face ao conjunto permitido
-- ------------------------------------------------------------
SELECT
  account_type,
  count(*) AS total
FROM public.auth_login_aliases
WHERE account_type NOT IN (
  'student', 'company', 'external', 'admin',
  'coordinator', 'teacher', 'admin_1', 'super_admin'
)
GROUP BY account_type
ORDER BY total DESC;

-- ------------------------------------------------------------
-- [3] Integridade: comparar alias.account_type com user_profiles.type
-- Regra canónica atual no app:
-- - coordinator/teacher/admin/admin_1/super_admin -> admin
-- - student/company/external -> igual
-- ------------------------------------------------------------
WITH expected AS (
  SELECT
    ala.alias,
    ala.user_id,
    ala.login_email,
    ala.account_type AS alias_type,
    up.type::text AS profile_type,
    CASE
      WHEN up.type::text IN ('student', 'company', 'external') THEN up.type::text
      WHEN up.type::text IN ('admin', 'coordinator', 'teacher') THEN 'admin'
      ELSE 'external'
    END AS expected_alias_type
  FROM public.auth_login_aliases ala
  LEFT JOIN public.user_profiles up
    ON up.id = ala.user_id
)
SELECT
  alias,
  user_id,
  login_email,
  profile_type,
  alias_type,
  expected_alias_type
FROM expected
WHERE alias_type IS DISTINCT FROM expected_alias_type
ORDER BY profile_type NULLS LAST, alias
LIMIT 200;

-- ------------------------------------------------------------
-- [2] Teste funcional de criação via RPC admin_create_platform_user
-- Requer contexto SUPER_ADMIN. Se não houver, bloco é ignorado com NOTICE.
-- Faz cleanup automático via admin_delete_user.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_role text;
  v_area_id uuid;
  v_uid_coordinator uuid;
  v_uid_teacher uuid;
BEGIN
  BEGIN
    SELECT public.current_app_role() INTO v_role;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'SKIP [2]: não foi possível avaliar current_app_role() (%).', SQLERRM;
    RETURN;
  END;

  IF v_role <> 'SUPER_ADMIN' THEN
    RAISE NOTICE 'SKIP [2]: role atual = %, necessário SUPER_ADMIN.', coalesce(v_role, '<null>');
    RETURN;
  END IF;

  SELECT id
  INTO v_area_id
  FROM public.training_area
  WHERE is_active = true
  ORDER BY display_order NULLS LAST, created_at ASC
  LIMIT 1;

  IF v_area_id IS NULL THEN
    RAISE NOTICE 'SKIP [2]: nenhuma training_area ativa encontrada.';
    RETURN;
  END IF;

  -- 2a) Coordenador
  v_uid_coordinator := public.admin_create_platform_user(
    p_email => 'qa.coordinator.' || substring(md5(random()::text) for 10) || '@giva.ao',
    p_password => 'Temp#12345',
    p_display_name => 'QA Coordenador',
    p_type => 'coordinator',
    p_role => 'COORDINATOR',
    p_moderation => 'active',
    p_require_password_change => true,
    p_process_number => null,
    p_area_id => v_area_id::text
  );

  RAISE NOTICE 'OK [2a]: coordenador criado uid=%', v_uid_coordinator;

  PERFORM public.admin_delete_user(v_uid_coordinator);
  RAISE NOTICE 'OK [2a]: cleanup coordenador concluído';

  -- 2b) Professor
  v_uid_teacher := public.admin_create_platform_user(
    p_email => 'qa.teacher.' || substring(md5(random()::text) for 10) || '@giva.ao',
    p_password => 'Temp#12345',
    p_display_name => 'QA Professor',
    p_type => 'teacher',
    p_role => 'TEACHER',
    p_moderation => 'active',
    p_require_password_change => true,
    p_process_number => null,
    p_area_id => null
  );

  RAISE NOTICE 'OK [2b]: professor criado uid=%', v_uid_teacher;

  PERFORM public.admin_delete_user(v_uid_teacher);
  RAISE NOTICE 'OK [2b]: cleanup professor concluído';
END;
$$;

-- ------------------------------------------------------------
-- [1c] Smoke test da própria constraint por INSERT direto (rollback)
-- ------------------------------------------------------------
BEGIN;

DO $$
DECLARE
  v_user_id uuid;
  v_prefix text;
BEGIN
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sem utilizadores em auth.users para teste de constraint';
  END IF;

  v_prefix := 'qa.alias.' || substring(md5(random()::text) for 12);

  INSERT INTO public.auth_login_aliases (alias, user_id, login_email, account_type)
  VALUES
    (v_prefix || '.coord', v_user_id, 'qa.alias.coord@giva.ao', 'coordinator'),
    (v_prefix || '.teacher', v_user_id, 'qa.alias.teacher@giva.ao', 'teacher'),
    (v_prefix || '.admin1', v_user_id, 'qa.alias.admin1@giva.ao', 'admin_1'),
    (v_prefix || '.super', v_user_id, 'qa.alias.super@giva.ao', 'super_admin')
  ON CONFLICT (alias) DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    login_email = EXCLUDED.login_email,
    account_type = EXCLUDED.account_type;

  RAISE NOTICE 'OK [1c]: inserts de smoke test aceitos pela constraint (prefix=%)', v_prefix;

  DELETE FROM public.auth_login_aliases
  WHERE alias LIKE v_prefix || '%';
END;
$$;

ROLLBACK;
