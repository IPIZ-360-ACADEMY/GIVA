-- ============================================================
-- GIVA IPIZ — Migração: Admin Académico + Fix Notificações
-- Executar no Supabase SQL Editor (requer acesso de admin)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Corrigir FK de actor_id em user_notifications
--    O join PostgREST `user_profiles!actor_id` requer que
--    a FK referencie public.user_profiles, não auth.users.
--    Como user_profiles.id = auth.users.id (1:1), isto é seguro.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.user_notifications
  DROP CONSTRAINT IF EXISTS user_notifications_actor_id_fkey;

ALTER TABLE public.user_notifications
  ADD CONSTRAINT user_notifications_actor_id_fkey
  FOREIGN KEY (actor_id)
  REFERENCES public.user_profiles(id)
  ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- 2. Garantir campos em public.students para registo via admin
-- ────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.students
  ADD COLUMN IF NOT EXISTS process_number    VARCHAR(32),
  ADD COLUMN IF NOT EXISTS date_of_birth     DATE,
  ADD COLUMN IF NOT EXISTS guardian_name     VARCHAR(140),
  ADD COLUMN IF NOT EXISTS guardian_phone    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS guardian_relation VARCHAR(64);

-- Unicidade do número de processo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_process_number_unique'
  ) THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_process_number_unique UNIQUE (process_number);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_students_process_number ON public.students(process_number);

-- ────────────────────────────────────────────────────────────
-- 3. Tornar training_area_id opcional em students
--    (o select no admin pode não ter a área disponível)
-- ────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.students
  ALTER COLUMN training_area_id DROP NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 4. Função PL/pgSQL: gerar número de processo sequencial
--    Exemplo de uso: SELECT public.generate_process_number();
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_process_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year     INT := EXTRACT(YEAR FROM now())::INT;
  _prefix   TEXT := 'IPIZ-' || _year || '-';
  _last     TEXT;
  _seq      INT;
BEGIN
  SELECT process_number
  INTO   _last
  FROM   public.students
  WHERE  process_number LIKE _prefix || '%'
  ORDER  BY process_number DESC
  LIMIT  1;

  IF _last IS NULL THEN
    _seq := 1;
  ELSE
    _seq := split_part(_last, '-', 3)::INT + 1;
  END IF;

  RETURN _prefix || lpad(_seq::TEXT, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_process_number() TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 5. RLS: permitir a alunos e admin verem/actualizarem students
-- ────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students_select_all"       ON public.students;
DROP POLICY IF EXISTS "students_insert_admin"      ON public.students;
DROP POLICY IF EXISTS "students_update_admin"      ON public.students;
DROP POLICY IF EXISTS "students_select_scoped"     ON public.students;
DROP POLICY IF EXISTS "students_insert_scoped"     ON public.students;
DROP POLICY IF EXISTS "students_update_scoped"     ON public.students;

-- Leitura escopada: admin, o proprio aluno, ou empresa com vínculo real.
CREATE POLICY "students_select_scoped"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (
    (
      coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', 'authenticated')
      in ('SUPER_ADMIN', 'ADMIN_1')
      or exists (
        select 1
        from public.user_profiles up
        where up.id = auth.uid()
          and up.type = 'admin'
      )
    )
    or exists (
      select 1
      from public.student_accounts sa
      where sa.id = auth.uid()
        and (
          sa.student_id = public.students.id
          or sa.process_number = public.students.process_number
        )
    )
    or exists (
      select 1
      from public.job_applications ja
      join public.partners p on p.id = ja.partner_id
      where ja.student_id = public.students.id
        and p.created_by = auth.uid()
    )
    or exists (
      select 1
      from public.company_progress cp
      join public.partners p on p.id = cp.partner_id
      where cp.student_id = public.students.id
        and p.created_by = auth.uid()
    )
  );

-- Inserção escopada para perfis administrativos.
CREATE POLICY "students_insert_scoped"
  ON public.students
  FOR INSERT
  TO authenticated
  WITH CHECK (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', 'authenticated')
    in ('SUPER_ADMIN', 'ADMIN_1')
    or exists (
      select 1
      from public.user_profiles up
      where up.id = auth.uid()
        and up.type = 'admin'
    )
  );

-- Actualização escopada: admin total, aluno apenas o proprio registo.
CREATE POLICY "students_update_scoped"
  ON public.students
  FOR UPDATE
  TO authenticated
  USING (
    (
      coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', 'authenticated')
      in ('SUPER_ADMIN', 'ADMIN_1')
      or exists (
        select 1
        from public.user_profiles up
        where up.id = auth.uid()
          and up.type = 'admin'
      )
    )
    or exists (
      select 1
      from public.student_accounts sa
      where sa.id = auth.uid()
        and (
          sa.student_id = public.students.id
          or sa.process_number = public.students.process_number
        )
    )
  )
  WITH CHECK (
    (
      coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', 'authenticated')
      in ('SUPER_ADMIN', 'ADMIN_1')
      or exists (
        select 1
        from public.user_profiles up
        where up.id = auth.uid()
          and up.type = 'admin'
      )
    )
    or exists (
      select 1
      from public.student_accounts sa
      where sa.id = auth.uid()
        and (
          sa.student_id = public.students.id
          or sa.process_number = public.students.process_number
        )
    )
  );

-- ────────────────────────────────────────────────────────────
-- 5.1 RLS: ownership em student_portfolio
-- ────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.student_portfolio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_portfolio_select_scoped" ON public.student_portfolio;
DROP POLICY IF EXISTS "student_portfolio_insert_scoped" ON public.student_portfolio;
DROP POLICY IF EXISTS "student_portfolio_update_scoped" ON public.student_portfolio;
DROP POLICY IF EXISTS "student_portfolio_delete_scoped" ON public.student_portfolio;

CREATE POLICY "student_portfolio_select_scoped"
  ON public.student_portfolio
  FOR SELECT
  TO authenticated
  USING (
    (
      coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', 'authenticated')
      in ('SUPER_ADMIN', 'ADMIN_1')
      or exists (
        select 1
        from public.user_profiles up
        where up.id = auth.uid()
          and up.type = 'admin'
      )
    )
    or exists (
      select 1
      from public.student_accounts sa
      where sa.id = auth.uid()
        and sa.student_id = public.student_portfolio.student_id
    )
    or exists (
      select 1
      from public.job_applications ja
      join public.partners p on p.id = ja.partner_id
      where ja.student_id = public.student_portfolio.student_id
        and p.created_by = auth.uid()
    )
    or exists (
      select 1
      from public.company_progress cp
      join public.partners p on p.id = cp.partner_id
      where cp.student_id = public.student_portfolio.student_id
        and p.created_by = auth.uid()
    )
  );

CREATE POLICY "student_portfolio_insert_scoped"
  ON public.student_portfolio
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', 'authenticated')
      in ('SUPER_ADMIN', 'ADMIN_1')
      or exists (
        select 1
        from public.user_profiles up
        where up.id = auth.uid()
          and up.type = 'admin'
      )
    )
    or exists (
      select 1
      from public.student_accounts sa
      where sa.id = auth.uid()
        and sa.student_id = public.student_portfolio.student_id
    )
  );

CREATE POLICY "student_portfolio_update_scoped"
  ON public.student_portfolio
  FOR UPDATE
  TO authenticated
  USING (
    (
      coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', 'authenticated')
      in ('SUPER_ADMIN', 'ADMIN_1')
      or exists (
        select 1
        from public.user_profiles up
        where up.id = auth.uid()
          and up.type = 'admin'
      )
    )
    or exists (
      select 1
      from public.student_accounts sa
      where sa.id = auth.uid()
        and sa.student_id = public.student_portfolio.student_id
    )
  )
  WITH CHECK (
    (
      coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', 'authenticated')
      in ('SUPER_ADMIN', 'ADMIN_1')
      or exists (
        select 1
        from public.user_profiles up
        where up.id = auth.uid()
          and up.type = 'admin'
      )
    )
    or exists (
      select 1
      from public.student_accounts sa
      where sa.id = auth.uid()
        and sa.student_id = public.student_portfolio.student_id
    )
  );

CREATE POLICY "student_portfolio_delete_scoped"
  ON public.student_portfolio
  FOR DELETE
  TO authenticated
  USING (
    (
      coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', 'authenticated')
      in ('SUPER_ADMIN', 'ADMIN_1')
      or exists (
        select 1
        from public.user_profiles up
        where up.id = auth.uid()
          and up.type = 'admin'
      )
    )
    or exists (
      select 1
      from public.student_accounts sa
      where sa.id = auth.uid()
        and sa.student_id = public.student_portfolio.student_id
    )
  );

-- ────────────────────────────────────────────────────────────
-- 6. Garantir que a política de notificações permite broadcast
--    (inserir para qualquer user_id por utilizador autenticado)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "notif_insert_any" ON public.user_notifications;
CREATE POLICY "notif_insert_any"
  ON public.user_notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ────────────────────────────────────────────────────────────
-- 7. Função RPC para broadcast de anúncio (alternativa segura)
--    Pode ser chamada do frontend via supabase.rpc('admin_broadcast')
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_broadcast(
  p_actor_id  UUID,
  p_title     TEXT,
  p_body      TEXT DEFAULT NULL,
  p_target    TEXT DEFAULT NULL   -- NULL = todos | 'student' | 'company' | 'external'
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count INT := 0;
BEGIN
  INSERT INTO public.user_notifications (user_id, actor_id, type, title, body)
  SELECT
    up.id,
    p_actor_id,
    'announcement',
    p_title,
    p_body
  FROM public.user_profiles up
  WHERE up.moderation = 'active'
    AND (p_target IS NULL OR up.type::TEXT = p_target);

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_broadcast(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 8. Habilitar Realtime na tabela user_notifications (se não estiver)
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'user_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
  END IF;
END $$;
