-- ============================================================
-- GIVA IPIZ — Company Signup Hardening (Post-Fix)
-- Objetivo: reforçar segurança e consistência backend/frontend
-- ============================================================

-- 1) Trigger de sincronização de email auth.users -> public.user_profiles
CREATE OR REPLACE FUNCTION public.sync_user_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.user_profiles
       SET email = NEW.email,
           updated_at = now()
     WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_profile_email ON auth.users;
CREATE TRIGGER trg_sync_user_profile_email
AFTER UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_user_profile_email();

-- 2) Unicidade lógica de email no perfil (evita divergência visual)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_email_unique_ci
  ON public.user_profiles (lower(email))
  WHERE email IS NOT NULL AND btrim(email) <> '';

-- 3) Hardening de policy: company_upsert_own deixa de ser PUBLIC
--    e passa para authenticated explicitamente.
DROP POLICY IF EXISTS company_upsert_own ON public.company_accounts;
CREATE POLICY company_upsert_own ON public.company_accounts
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 4) Hardening de RPC fallback: remover execução anon.
--    O fluxo oficial sem sessão é o trigger handle_new_user_oauth.
REVOKE EXECUTE ON FUNCTION public.register_company_profile(uuid, text, text, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_company_profile(uuid, text, text, text, text, text, text) TO authenticated;

-- 5) Assegurar retrocompatibilidade de leitura admin na view
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
