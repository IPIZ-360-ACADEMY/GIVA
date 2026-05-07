-- ============================================================
-- GIVA IPIZ — Company NIF Governance
-- Objetivo: controlar NIF provisório vs oficial com fonte única no backend
-- ============================================================

-- 1) Colunas de governança de NIF
ALTER TABLE IF EXISTS public.company_accounts
  ADD COLUMN IF NOT EXISTS nif_is_provisional boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nif_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS nif_updated_by uuid REFERENCES auth.users(id);

-- 2) Marcar registos já conhecidos como provisórios
UPDATE public.company_accounts
SET nif_is_provisional = true
WHERE nif LIKE 'MIG-%' OR nif LIKE 'AUTO-%';

-- 3) Função de normalização central
CREATE OR REPLACE FUNCTION public.normalize_company_nif(p_nif text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(UPPER(regexp_replace(COALESCE(p_nif, ''), '\\s+', '', 'g')), '');
$$;

-- 4) Trigger para manter consistência em qualquer INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.company_accounts_nif_enforce()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _normalized text;
BEGIN
  _normalized := public.normalize_company_nif(NEW.nif);
  NEW.nif := COALESCE(_normalized, NEW.nif);

  IF NEW.nif IS NULL OR NEW.nif = '' THEN
    RAISE EXCEPTION 'NIF é obrigatório';
  END IF;

  NEW.nif_is_provisional := (NEW.nif LIKE 'MIG-%' OR NEW.nif LIKE 'AUTO-%');
  NEW.nif_updated_at := now();

  IF auth.uid() IS NOT NULL THEN
    NEW.nif_updated_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_accounts_nif_enforce ON public.company_accounts;
CREATE TRIGGER trg_company_accounts_nif_enforce
BEFORE INSERT OR UPDATE OF nif ON public.company_accounts
FOR EACH ROW EXECUTE FUNCTION public.company_accounts_nif_enforce();

-- 5) Índice para operações administrativas (fila de regularização)
CREATE INDEX IF NOT EXISTS idx_company_accounts_nif_provisional
  ON public.company_accounts(nif_is_provisional)
  WHERE nif_is_provisional = true;

-- 6) Função segura para regularizar NIF (somente admin/coordenador)
CREATE OR REPLACE FUNCTION public.resolve_company_nif(
  p_company_id uuid,
  p_real_nif text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller uuid;
  _normalized text;
  _allowed boolean;
BEGIN
  _caller := auth.uid();
  IF _caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = _caller
      AND up.type IN ('admin', 'coordinator')
  ) INTO _allowed;

  IF NOT _allowed THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  _normalized := public.normalize_company_nif(p_real_nif);
  IF _normalized IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_nif');
  END IF;

  UPDATE public.company_accounts
  SET nif = _normalized,
      nif_is_provisional = false,
      nif_updated_at = now(),
      nif_updated_by = _caller
  WHERE id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'company_not_found');
  END IF;

  RETURN jsonb_build_object('ok', true, 'company_id', p_company_id, 'nif', _normalized);

EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'error', 'company_nif_unique');
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_company_nif(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_company_nif(uuid, text) TO authenticated;

-- 7) View operacional para backend/frontend admin sincronizados
CREATE OR REPLACE VIEW public.company_accounts_quality AS
SELECT
  ca.id,
  ca.empresa,
  ca.nif,
  ca.nif_is_provisional,
  ca.nif_updated_at,
  ca.nif_updated_by,
  up.display_name,
  COALESCE(up.email, au.email) AS email,
  up.moderation,
  up.created_at
FROM public.company_accounts ca
JOIN public.user_profiles up ON up.id = ca.id
JOIN auth.users au ON au.id = ca.id;
