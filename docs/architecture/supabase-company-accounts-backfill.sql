-- ============================================================
-- GIVA IPIZ — Backfill company_accounts para perfis company órfãos
-- Objetivo: eliminar divergência frontend/backend
-- ============================================================

INSERT INTO public.company_accounts (
  id,
  empresa,
  nif,
  localizacao,
  responsible_name,
  responsible_contact
)
SELECT
  up.id,
  COALESCE(NULLIF(TRIM(up.display_name), ''), split_part(COALESCE(up.email, au.email), '@', 1)) AS empresa,
  ('MIG-' || substr(replace(up.id::text, '-', ''), 1, 12)) AS nif,
  NULL,
  NULL,
  NULL
FROM public.user_profiles up
JOIN auth.users au ON au.id = up.id
WHERE up.type = 'company'
  AND NOT EXISTS (
    SELECT 1 FROM public.company_accounts ca WHERE ca.id = up.id
  )
ON CONFLICT (id) DO NOTHING;
