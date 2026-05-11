-- ============================================================
-- GIVA IPIZ — Company Signup Fix (Bug Fix Migration)
-- Corrige o fluxo de registo de empresa ponta a ponta.
--
-- Problemas resolvidos:
--   1. Trigger handle_new_user_oauth criava sempre type='external'
--      → empresas ficavam com tipo errado quando confirmação de email estava ativa
--   2. Adiciona coluna email a user_profiles para que o painel admin mostre o email
--   3. Cria função register_company_profile (SECURITY DEFINER) como fallback
--      para ambientes com confirmação de email ativada
--   4. Garante upsert seguro em company_accounts
--
-- Pode ser executado em qualquer ordem após supabase-signup-upgrade.sql
-- ============================================================

-- ============================================================
-- 1. Adicionar coluna email a user_profiles (se ainda não existir)
--    Necessário para o painel de administração mostrar o email da empresa
-- ============================================================
ALTER TABLE IF EXISTS public.user_profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Preencher email a partir de auth.users para registos existentes
UPDATE public.user_profiles up
SET email = au.email
FROM auth.users au
WHERE up.id = au.id
  AND up.email IS NULL;

-- Manter sincronizado via trigger (inserção futura)
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_type_moderation
  ON public.user_profiles(type, moderation);

-- ============================================================
-- 2. Corrigir trigger handle_new_user_oauth
--    Agora lê raw_user_meta_data->>'user_type' para definir o tipo correto
--    e cria company_accounts automaticamente se user_type = 'company'
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_oauth()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _display_name TEXT;
  _avatar_url   TEXT;
  _user_type    TEXT;
  _account_type public.account_type;
  _moderation   public.moderation_status;
  _empresa      TEXT;
  _nif          TEXT;
BEGIN
  -- Não sobrescrever perfil existente (ex: criado pelo client antes do trigger)
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Determinar tipo de conta a partir dos metadados passados no signUp
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

  -- Nome para exibição
  _display_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    split_part(NEW.email, '@', 1)
  );

  -- Avatar (OAuth providers)
  _avatar_url := NULLIF(COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  ), '');

  -- Criar perfil base
  INSERT INTO public.user_profiles (id, type, display_name, avatar_url, moderation, email)
  VALUES (NEW.id, _account_type, _display_name, _avatar_url, _moderation, NEW.email)
  ON CONFLICT (id) DO UPDATE
    SET type         = EXCLUDED.type,
        moderation   = EXCLUDED.moderation,
        display_name = COALESCE(EXCLUDED.display_name, public.user_profiles.display_name),
        email        = COALESCE(EXCLUDED.email, public.user_profiles.email);

  -- Criar registo de empresa se aplicável
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_user_oauth ON auth.users;
CREATE TRIGGER trg_new_user_oauth
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_oauth();

-- ============================================================
-- 3. Função SECURITY DEFINER para registo de empresa
--    Usada como fallback quando o client não tem sessão
--    (confirmação de email ativada no Supabase)
-- ============================================================
CREATE OR REPLACE FUNCTION public.register_company_profile(
  p_user_id           UUID,
  p_display_name      TEXT,
  p_empresa           TEXT,
  p_nif               TEXT,
  p_localizacao       TEXT DEFAULT NULL,
  p_responsible_name  TEXT DEFAULT NULL,
  p_responsible_contact TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nif TEXT;
BEGIN
  -- Validações básicas
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_id_required');
  END IF;

  -- Verificar que o utilizador existe em auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  -- Criar/actualizar perfil
  INSERT INTO public.user_profiles (id, type, display_name, moderation, email)
  SELECT
    p_user_id,
    'company',
    COALESCE(NULLIF(TRIM(p_display_name), ''), split_part(au.email, '@', 1)),
    'pending',
    au.email
  FROM auth.users au WHERE au.id = p_user_id
  ON CONFLICT (id) DO UPDATE
    SET type         = 'company',
        moderation   = CASE
                         WHEN public.user_profiles.moderation = 'suspended' THEN 'suspended'
                         ELSE 'pending'
                       END,
        display_name = COALESCE(NULLIF(TRIM(p_display_name), ''), public.user_profiles.display_name);

  v_nif := NULLIF(TRIM(COALESCE(p_nif, '')), '');
  IF v_nif IS NULL THEN
    v_nif := 'AUTO-' || UPPER(REPLACE(LEFT(p_user_id::text, 12), '-', ''));
  END IF;

  -- Criar/actualizar company_accounts
  INSERT INTO public.company_accounts (
    id, empresa, nif, localizacao, responsible_name, responsible_contact
  ) VALUES (
    p_user_id,
    COALESCE(NULLIF(TRIM(p_empresa), ''), TRIM(p_display_name)),
    v_nif,
    NULLIF(TRIM(COALESCE(p_localizacao, '')), ''),
    NULLIF(TRIM(COALESCE(p_responsible_name, '')), ''),
    NULLIF(TRIM(COALESCE(p_responsible_contact, '')), '')
  )
  ON CONFLICT (id) DO UPDATE
    SET empresa             = COALESCE(NULLIF(TRIM(p_empresa), ''), public.company_accounts.empresa),
        nif                 = COALESCE(NULLIF(TRIM(v_nif), ''), public.company_accounts.nif),
        localizacao         = COALESCE(NULLIF(TRIM(p_localizacao), ''), public.company_accounts.localizacao),
        responsible_name    = COALESCE(NULLIF(TRIM(p_responsible_name), ''), public.company_accounts.responsible_name),
        responsible_contact = COALESCE(NULLIF(TRIM(p_responsible_contact), ''), public.company_accounts.responsible_contact);

  RETURN jsonb_build_object('ok', true, 'user_id', p_user_id);

EXCEPTION WHEN unique_violation THEN
  -- NIF já registado por outra empresa
  RETURN jsonb_build_object('ok', false, 'error', 'company_nif_unique');
END;
$$;

-- Permitir chamada por utilizadores autenticados E anon (self-registration)
REVOKE ALL ON FUNCTION public.register_company_profile FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_company_profile TO anon, authenticated;

-- ============================================================
-- 3b. Sincronizar company_accounts -> partners automaticamente
--    Garante que toda conta de empresa passa a parceiro operacional
--    sem depender de criação manual no frontend.
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_company_partner_area_id(p_company_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _area_id UUID;
BEGIN
  SELECT NULLIF(
           COALESCE(
             au.raw_app_meta_data->>'area_id',
             au.raw_user_meta_data->>'area_id',
             ''
           ),
           ''
         )::UUID
  INTO _area_id
  FROM auth.users au
  WHERE au.id = p_company_id;

  IF _area_id IS NOT NULL THEN
    RETURN _area_id;
  END IF;

  SELECT ta.id
  INTO _area_id
  FROM public.training_area ta
  WHERE ta.is_active = true
  ORDER BY ta.display_order ASC, ta.created_at ASC
  LIMIT 1;

  IF _area_id IS NOT NULL THEN
    RETURN _area_id;
  END IF;

  RETURN '11111111-1111-1111-1111-111111111111'::UUID;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_company_partner_from_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _area_id UUID;
  _email TEXT;
  _responsavel TEXT;
  _endereco TEXT;
BEGIN
  _area_id := public.resolve_company_partner_area_id(NEW.id);

  SELECT COALESCE(au.email, '')
  INTO _email
  FROM auth.users au
  WHERE au.id = NEW.id;

  _responsavel := COALESCE(
    NULLIF(TRIM(NEW.responsible_name), ''),
    NULLIF(TRIM(NEW.empresa), ''),
    split_part(COALESCE(_email, ''), '@', 1),
    ''
  );

  _endereco := COALESCE(
    NULLIF(TRIM(NEW.endereco), ''),
    NULLIF(TRIM(NEW.localizacao), ''),
    ''
  );

  INSERT INTO public.partners (
    id,
    empresa,
    nif,
    setor,
    areas,
    vagas,
    sla,
    responsavel,
    telefone,
    email,
    website,
    endereco,
    photo_preview,
    area_id,
    created_by
  ) VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.empresa), ''), split_part(COALESCE(_email, ''), '@', 1)),
    COALESCE(NULLIF(TRIM(NEW.nif), ''), 'AUTO-' || UPPER(REPLACE(LEFT(NEW.id::TEXT, 12), '-', ''))),
    COALESCE(NULLIF(TRIM(NEW.setor), ''), 'tech'),
    '{}'::TEXT[],
    0,
    '',
    _responsavel,
    COALESCE(NULLIF(TRIM(NEW.responsible_contact), ''), ''),
    _email,
    COALESCE(NULLIF(TRIM(NEW.website), ''), ''),
    _endereco,
    NULL,
    _area_id,
    NEW.id
  )
  ON CONFLICT (id) DO UPDATE
    SET empresa      = EXCLUDED.empresa,
        nif          = EXCLUDED.nif,
        setor        = COALESCE(NULLIF(EXCLUDED.setor, ''), public.partners.setor),
        responsavel   = COALESCE(NULLIF(EXCLUDED.responsavel, ''), public.partners.responsavel),
        telefone      = COALESCE(NULLIF(EXCLUDED.telefone, ''), public.partners.telefone),
        email         = COALESCE(NULLIF(EXCLUDED.email, ''), public.partners.email),
        website       = COALESCE(NULLIF(EXCLUDED.website, ''), public.partners.website),
        endereco      = COALESCE(NULLIF(EXCLUDED.endereco, ''), public.partners.endereco),
        area_id       = COALESCE(public.partners.area_id, EXCLUDED.area_id),
        created_by    = COALESCE(public.partners.created_by, EXCLUDED.created_by);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_company_partner_from_account ON public.company_accounts;
CREATE TRIGGER trg_sync_company_partner_from_account
  AFTER INSERT OR UPDATE OF empresa, nif, setor, responsible_name, responsible_contact, website, endereco, localizacao, cidade
  ON public.company_accounts
  FOR EACH ROW EXECUTE FUNCTION public.sync_company_partner_from_account();

INSERT INTO public.partners (
  id,
  empresa,
  nif,
  setor,
  areas,
  vagas,
  sla,
  responsavel,
  telefone,
  email,
  website,
  endereco,
  photo_preview,
  area_id,
  created_by
)
SELECT
  ca.id,
  COALESCE(NULLIF(TRIM(ca.empresa), ''), split_part(COALESCE(au.email, ''), '@', 1)),
  COALESCE(NULLIF(TRIM(ca.nif), ''), 'AUTO-' || UPPER(REPLACE(LEFT(ca.id::TEXT, 12), '-', ''))),
  COALESCE(NULLIF(TRIM(ca.setor), ''), 'tech'),
  '{}'::TEXT[],
  0,
  '',
  COALESCE(
    NULLIF(TRIM(ca.responsible_name), ''),
    NULLIF(TRIM(ca.empresa), ''),
    split_part(COALESCE(au.email, ''), '@', 1),
    ''
  ),
  COALESCE(NULLIF(TRIM(ca.responsible_contact), ''), ''),
  COALESCE(au.email, ''),
  COALESCE(NULLIF(TRIM(ca.website), ''), ''),
  COALESCE(NULLIF(TRIM(ca.endereco), ''), NULLIF(TRIM(ca.localizacao), ''), ''),
  NULL,
  public.resolve_company_partner_area_id(ca.id),
  ca.id
FROM public.company_accounts ca
LEFT JOIN auth.users au ON au.id = ca.id
LEFT JOIN public.partners p ON p.id = ca.id
WHERE p.id IS NULL
ON CONFLICT (id) DO UPDATE
  SET empresa      = EXCLUDED.empresa,
      nif          = EXCLUDED.nif,
      setor        = COALESCE(NULLIF(EXCLUDED.setor, ''), public.partners.setor),
      responsavel   = COALESCE(NULLIF(EXCLUDED.responsavel, ''), public.partners.responsavel),
      telefone      = COALESCE(NULLIF(EXCLUDED.telefone, ''), public.partners.telefone),
      email         = COALESCE(NULLIF(EXCLUDED.email, ''), public.partners.email),
      website       = COALESCE(NULLIF(EXCLUDED.website, ''), public.partners.website),
      endereco      = COALESCE(NULLIF(EXCLUDED.endereco, ''), public.partners.endereco),
      area_id       = COALESCE(public.partners.area_id, EXCLUDED.area_id),
      created_by    = COALESCE(public.partners.created_by, EXCLUDED.created_by);

-- ============================================================
-- 4. Políticas RLS adicionais para company_accounts
--    (INSERT por anon não é necessário se trigger cria o row)
--    Empresa pode ver e atualizar o seu próprio registo.
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='company_accounts' AND policyname='company_upsert_own'
  ) THEN
    EXECUTE '
      CREATE POLICY company_upsert_own ON public.company_accounts
        FOR ALL
        USING (id = auth.uid())
        WITH CHECK (id = auth.uid())
    ';
  END IF;
END $$;

-- Coordenadores/admins podem ver todos os company_accounts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='company_accounts' AND policyname='company_admin_select'
  ) THEN
    EXECUTE '
      CREATE POLICY company_admin_select ON public.company_accounts
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
              AND up.type IN (''admin'', ''coordinator'')
          )
        )
    ';
  END IF;
END $$;

-- ============================================================
-- 5. Vista pública para admin: user_profiles + email de auth.users
--    Para garantir que o email está sempre disponível no painel admin
-- ============================================================
CREATE OR REPLACE VIEW public.user_profiles_with_email AS
SELECT
  up.id,
  up.type,
  up.display_name,
  up.avatar_url,
  up.bio,
  up.moderation,
  up.created_at,
  up.updated_at,
  COALESCE(up.email, au.email) AS email
FROM public.user_profiles up
JOIN auth.users au ON au.id = up.id;

-- ============================================================
-- 6. Corrigir user_profiles existentes com type='external'
--    que deveriam ter type='company' (quando nif existe em company_accounts)
--    NOTA: apenas afecta utilizadores cujo user_type não foi passado
--    no momento do registo (trigger antigo)
-- ============================================================
UPDATE public.user_profiles up
SET type = 'company', moderation = 'pending'
WHERE up.type = 'external'
  AND EXISTS (
    SELECT 1 FROM public.company_accounts ca WHERE ca.id = up.id
  );

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================
