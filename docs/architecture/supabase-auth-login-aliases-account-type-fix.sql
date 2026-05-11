-- ============================================================
-- GIVA IPIZ - Fix global para auth_login_aliases.account_type
-- Objetivo:
-- 1) Evitar erro de check constraint ao criar coordenador/professor/admin legado
-- 2) Manter compatibilidade com fluxos antigos e novos
-- ============================================================

BEGIN;

-- Garantir que valores existentes estão normalizados
UPDATE public.auth_login_aliases
SET account_type = lower(trim(account_type))
WHERE account_type IS NOT NULL
  AND account_type <> lower(trim(account_type));

-- Recriar constraint com cobertura completa de perfis usados na plataforma
ALTER TABLE public.auth_login_aliases
  DROP CONSTRAINT IF EXISTS auth_login_aliases_account_type_check;

ALTER TABLE public.auth_login_aliases
  ADD CONSTRAINT auth_login_aliases_account_type_check
  CHECK (
    account_type IN (
      'student',
      'company',
      'external',
      'admin',
      'coordinator',
      'teacher',
      'admin_1',
      'super_admin'
    )
  );

-- Opcional: canonizar aliases administrativos legados para "admin"
UPDATE public.auth_login_aliases
SET account_type = 'admin'
WHERE account_type IN ('admin_1', 'super_admin');

COMMIT;
