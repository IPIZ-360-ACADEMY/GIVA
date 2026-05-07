-- ============================================================
-- GIVA IPIZ — NIF Integrity Hardening
-- ============================================================

-- 1) Função utilitária de normalização de NIF
CREATE OR REPLACE FUNCTION public.normalize_company_nif(p_nif text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(UPPER(regexp_replace(COALESCE(p_nif, ''), '\\s+', '', 'g')), '');
$$;

-- 2) Normalizar NIFs existentes
UPDATE public.company_accounts
SET nif = public.normalize_company_nif(nif)
WHERE nif IS NOT NULL;

-- 3) Índice único por NIF normalizado (evita duplicidade semântica)
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_accounts_nif_unique_norm
  ON public.company_accounts (public.normalize_company_nif(nif));

-- 4) Trigger e RPC passam a normalizar NIF ao persistir
CREATE OR REPLACE FUNCTION public.handle_new_user_oauth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _display_name TEXT;
  _avatar_url TEXT;
  _user_type TEXT;
  _account_type public.account_type;
  _moderation public.moderation_status;
  _empresa TEXT;
  _nif TEXT;
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
    WHEN 'company' THEN _account_type := 'company'; _moderation := 'pending';
    WHEN 'student' THEN _account_type := 'student'; _moderation := 'active';
    WHEN 'admin' THEN _account_type := 'admin'; _moderation := 'active';
    WHEN 'coordinator' THEN _account_type := 'admin'; _moderation := 'active';
    ELSE _account_type := 'external'; _moderation := 'active';
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
    SET type = EXCLUDED.type,
        moderation = EXCLUDED.moderation,
        display_name = COALESCE(EXCLUDED.display_name, public.user_profiles.display_name),
        email = COALESCE(EXCLUDED.email, public.user_profiles.email);

  IF _account_type = 'company' THEN
    _empresa := COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'empresa'), ''),
      _display_name
    );
    _nif := public.normalize_company_nif(NEW.raw_user_meta_data->>'nif');

    IF _nif IS NULL THEN
      _nif := ('AUTO-' || substr(replace(NEW.id::text, '-', ''), 1, 12));
    END IF;

    INSERT INTO public.company_accounts (
      id, empresa, nif, localizacao, responsible_name, responsible_contact
    ) VALUES (
      NEW.id,
      _empresa,
      _nif,
      NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'localizacao', '')), ''),
      NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'responsible_name', '')), ''),
      NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'responsible_contact', '')), '')
    )
    ON CONFLICT (id) DO UPDATE
      SET empresa = COALESCE(NULLIF(EXCLUDED.empresa, ''), public.company_accounts.empresa),
          nif = COALESCE(NULLIF(EXCLUDED.nif, ''), public.company_accounts.nif),
          localizacao = COALESCE(EXCLUDED.localizacao, public.company_accounts.localizacao),
          responsible_name = COALESCE(EXCLUDED.responsible_name, public.company_accounts.responsible_name),
          responsible_contact = COALESCE(EXCLUDED.responsible_contact, public.company_accounts.responsible_contact);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_company_profile(
  p_user_id UUID,
  p_display_name TEXT,
  p_empresa TEXT,
  p_nif TEXT,
  p_localizacao TEXT DEFAULT NULL,
  p_responsible_name TEXT DEFAULT NULL,
  p_responsible_contact TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _nif TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_id_required');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  INSERT INTO public.user_profiles (id, type, display_name, moderation, email)
  SELECT
    p_user_id,
    'company',
    COALESCE(NULLIF(TRIM(p_display_name), ''), split_part(au.email, '@', 1)),
    'pending',
    au.email
  FROM auth.users au WHERE au.id = p_user_id
  ON CONFLICT (id) DO UPDATE
    SET type = 'company',
        moderation = CASE
          WHEN public.user_profiles.moderation = 'suspended' THEN 'suspended'
          ELSE 'pending'
        END,
        display_name = COALESCE(NULLIF(TRIM(p_display_name), ''), public.user_profiles.display_name);

  _nif := COALESCE(public.normalize_company_nif(p_nif), ('AUTO-' || substr(replace(p_user_id::text, '-', ''), 1, 12)));

  INSERT INTO public.company_accounts (
    id, empresa, nif, localizacao, responsible_name, responsible_contact
  ) VALUES (
    p_user_id,
    COALESCE(NULLIF(TRIM(p_empresa), ''), TRIM(p_display_name)),
    _nif,
    NULLIF(TRIM(COALESCE(p_localizacao, '')), ''),
    NULLIF(TRIM(COALESCE(p_responsible_name, '')), ''),
    NULLIF(TRIM(COALESCE(p_responsible_contact, '')), '')
  )
  ON CONFLICT (id) DO UPDATE
    SET empresa = COALESCE(NULLIF(TRIM(p_empresa), ''), public.company_accounts.empresa),
        nif = _nif,
        localizacao = COALESCE(NULLIF(TRIM(p_localizacao), ''), public.company_accounts.localizacao),
        responsible_name = COALESCE(NULLIF(TRIM(p_responsible_name), ''), public.company_accounts.responsible_name),
        responsible_contact = COALESCE(NULLIF(TRIM(p_responsible_contact), ''), public.company_accounts.responsible_contact);

  RETURN jsonb_build_object('ok', true, 'user_id', p_user_id);

EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'error', 'company_nif_unique');
END;
$$;
