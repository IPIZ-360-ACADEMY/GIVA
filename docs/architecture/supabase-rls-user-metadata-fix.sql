-- ==-==========================================================
-- GIVA IPIZ — RLS user_metadata Security Fix
-- Data: 2026-05-12
-- Objetivo: Corrigir políticas RLS que referenciam
-- user_metadata inseguro (editável por utilizadores).
--
-- Bugs resolvidos (21 políticas):
-- - training_area: insert_admin, update_admin, delete_admin (3)
-- - students: select_scoped, insert_scoped, update_scoped (3)
-- - student_portfolio: select_scoped, insert_scoped, update_scoped, delete_scoped (4)
-- - internships: insert_admin, update_admin, delete_admin (3)
-- - internship_vacancies: vacancies_insert_admin, vacancies_update_admin, vacancies_delete_admin (3)
-- - courses: insert_admin, update_admin, delete_admin (3)
--
-- SOLUÇÃO COMPLETA:
-- 1. Corrigir a função current_app_role() para usar apenas
--    app_metadata (não editável por users) em vez de
--    user_metadata (editável por users).
-- 2. Atualizar todas as políticas RLS para usar
--    public.current_app_role() (que agora é seguro).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. CORREÇÃO CRÍTICA: current_app_role()
--    Esta função é usada por TODAS as políticas RLS.
--    Deve usar APENAS app_metadata (não user_metadata).
--    Mapeia 'admin' em user_profiles para 'ADMIN_1'.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'role',
      (
        SELECT CASE WHEN up.type = 'admin' THEN 'ADMIN_1' ELSE up.type END
        FROM public.user_profiles up
        WHERE up.id = auth.uid()
        LIMIT 1
      ),
      'authenticated'
    );
$$;

-- Helper adicional: verificar se é admin (qualquer nível)
CREATE OR REPLACE FUNCTION public.is_admin_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.type = 'admin'
    );
$$;

-- ────────────────────────────────────────────────────────────
-- training_area (3 políticas a corrigir)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "training_area_insert_admin" ON public.training_area;
DROP POLICY IF EXISTS "training_area_update_admin" ON public.training_area;
DROP POLICY IF EXISTS "training_area_delete_admin" ON public.training_area;

CREATE POLICY "training_area_insert_admin"
  ON public.training_area
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.type = 'admin'
    )
  );

CREATE POLICY "training_area_update_admin"
  ON public.training_area
  FOR UPDATE
  TO authenticated
  USING (
    public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.type = 'admin'
    )
  )
  WITH CHECK (
    public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.type = 'admin'
    )
  );

CREATE POLICY "training_area_delete_admin"
  ON public.training_area
  FOR DELETE
  TO authenticated
  USING (
    public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.type = 'admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- students (3 políticas a corrigir)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "students_select_scoped" ON public.students;
DROP POLICY IF EXISTS "students_insert_scoped" ON public.students;
DROP POLICY IF EXISTS "students_update_scoped" ON public.students;

CREATE POLICY "students_select_scoped"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (
    (
      public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
      OR EXISTS (
        SELECT 1
        FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND up.type = 'admin'
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.student_accounts sa
      WHERE sa.id = auth.uid()
        AND (
          sa.student_id = public.students.id
          OR sa.process_number = public.students.process_number
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.job_applications ja
      JOIN public.partners p ON p.id = ja.partner_id
      WHERE ja.student_id = public.students.id
        AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.company_progress cp
      JOIN public.partners p ON p.id = cp.partner_id
      WHERE cp.student_id = public.students.id
        AND p.created_by = auth.uid()
    )
  );

CREATE POLICY "students_insert_scoped"
  ON public.students
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.type = 'admin'
    )
  );

CREATE POLICY "students_update_scoped"
  ON public.students
  FOR UPDATE
  TO authenticated
  USING (
    (
      public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
      OR EXISTS (
        SELECT 1
        FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND up.type = 'admin'
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.student_accounts sa
      WHERE sa.id = auth.uid()
        AND (
          sa.student_id = public.students.id
          OR sa.process_number = public.students.process_number
        )
    )
  )
  WITH CHECK (
    (
      public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
      OR EXISTS (
        SELECT 1
        FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND up.type = 'admin'
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.student_accounts sa
      WHERE sa.id = auth.uid()
        AND (
          sa.student_id = public.students.id
          OR sa.process_number = public.students.process_number
        )
    )
  );

-- ────────────────────────────────────────────────────────────
-- student_portfolio (4 políticas a corrigir)
-- ────────────────────────────────────────────────────────────
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
      public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
      OR EXISTS (
        SELECT 1
        FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND up.type = 'admin'
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.student_accounts sa
      WHERE sa.id = auth.uid()
        AND sa.student_id = public.student_portfolio.student_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.job_applications ja
      JOIN public.partners p ON p.id = ja.partner_id
      WHERE ja.student_id = public.student_portfolio.student_id
        AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.company_progress cp
      JOIN public.partners p ON p.id = cp.partner_id
      WHERE cp.student_id = public.student_portfolio.student_id
        AND p.created_by = auth.uid()
    )
  );

CREATE POLICY "student_portfolio_insert_scoped"
  ON public.student_portfolio
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
      OR EXISTS (
        SELECT 1
        FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND up.type = 'admin'
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.student_accounts sa
      WHERE sa.id = auth.uid()
        AND sa.student_id = public.student_portfolio.student_id
    )
  );

CREATE POLICY "student_portfolio_update_scoped"
  ON public.student_portfolio
  FOR UPDATE
  TO authenticated
  USING (
    (
      public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
      OR EXISTS (
        SELECT 1
        FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND up.type = 'admin'
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.student_accounts sa
      WHERE sa.id = auth.uid()
        AND sa.student_id = public.student_portfolio.student_id
    )
  )
  WITH CHECK (
    (
      public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
      OR EXISTS (
        SELECT 1
        FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND up.type = 'admin'
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.student_accounts sa
      WHERE sa.id = auth.uid()
        AND sa.student_id = public.student_portfolio.student_id
    )
  );

CREATE POLICY "student_portfolio_delete_scoped"
  ON public.student_portfolio
  FOR DELETE
  TO authenticated
  USING (
    (
      public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
      OR EXISTS (
        SELECT 1
        FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND up.type = 'admin'
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.student_accounts sa
      WHERE sa.id = auth.uid()
        AND sa.student_id = public.student_portfolio.student_id
    )
  );

-- ────────────────────────────────────────────────────────────
-- internships (3 políticas a corrigir)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "internships_insert_admin" ON public.internships;
DROP POLICY IF EXISTS "internships_update_admin" ON public.internships;
DROP POLICY IF EXISTS "internships_delete_admin" ON public.internships;

CREATE POLICY "internships_insert_admin"
  ON public.internships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.type = 'admin'
    )
  );

CREATE POLICY "internships_update_admin"
  ON public.internships
  FOR UPDATE
  TO authenticated
  USING (
    public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.type = 'admin'
    )
  )
  WITH CHECK (
    public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.type = 'admin'
    )
  );

CREATE POLICY "internships_delete_admin"
  ON public.internships
  FOR DELETE
  TO authenticated
  USING (
    public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.type = 'admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- internship_vacancies (3 políticas a corrigir)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "vacancies_insert_admin" ON public.internship_vacancies;
DROP POLICY IF EXISTS "vacancies_update_admin" ON public.internship_vacancies;
DROP POLICY IF EXISTS "vacancies_delete_admin" ON public.internship_vacancies;

CREATE POLICY "vacancies_insert_admin"
  ON public.internship_vacancies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.type = 'admin'
    )
  );

CREATE POLICY "vacancies_update_admin"
  ON public.internship_vacancies
  FOR UPDATE
  TO authenticated
  USING (
    public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.type = 'admin'
    )
  )
  WITH CHECK (
    public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.type = 'admin'
    )
  );

CREATE POLICY "vacancies_delete_admin"
  ON public.internship_vacancies
  FOR DELETE
  TO authenticated
  USING (
    public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.type = 'admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- courses (3 políticas a corrigir)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "courses_insert_admin" ON public.courses;
DROP POLICY IF EXISTS "courses_update_admin" ON public.courses;
DROP POLICY IF EXISTS "courses_delete_admin" ON public.courses;

CREATE POLICY "courses_insert_admin"
  ON public.courses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.type = 'admin'
    )
  );

CREATE POLICY "courses_update_admin"
  ON public.courses
  FOR UPDATE
  TO authenticated
  USING (
    public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.type = 'admin'
    )
  )
  WITH CHECK (
    public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.type = 'admin'
    )
  );

CREATE POLICY "courses_delete_admin"
  ON public.courses
  FOR DELETE
  TO authenticated
  USING (
    public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.type = 'admin'
    )
  );
