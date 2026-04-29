-- ============================================================
-- GIVA - Modelo Unificado de Registo de Alunos
-- Data: 2026-04-21
-- Objetivo:
-- 1) Unificar a normalizacao do numero de processo
-- 2) Eliminar divergencia entre students, student_accounts e internships
-- 3) Tornar a verificacao de signup resiliente a maiusculas/minusculas e espacos
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0) Funcao canonica para numero de processo
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_process_number(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT left(regexp_replace(upper(trim(coalesce(p_value, ''))), '[^A-Z0-9-]', '', 'g'), 32)
$$;

-- ------------------------------------------------------------
-- 1) Backfill: normalizar dados existentes
-- ------------------------------------------------------------
UPDATE public.students
SET process_number = public.normalize_process_number(process_number)
WHERE process_number IS NOT NULL;

UPDATE public.student_accounts
SET process_number = public.normalize_process_number(process_number)
WHERE process_number IS NOT NULL;

UPDATE public.internships
SET processo = public.normalize_process_number(processo)
WHERE processo IS NOT NULL;

-- ------------------------------------------------------------
-- 2) Indices unicos por valor normalizado
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_process_number_norm
  ON public.students (public.normalize_process_number(process_number));

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_accounts_process_number_norm
  ON public.student_accounts (public.normalize_process_number(process_number));

CREATE INDEX IF NOT EXISTS idx_internships_processo_norm
  ON public.internships (public.normalize_process_number(processo));

-- ------------------------------------------------------------
-- 3) Trigger de normalizacao automatica
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_process_number_normalization()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'students' THEN
    NEW.process_number := public.normalize_process_number(NEW.process_number);
  ELSIF TG_TABLE_NAME = 'student_accounts' THEN
    NEW.process_number := public.normalize_process_number(NEW.process_number);
  ELSIF TG_TABLE_NAME = 'internships' THEN
    NEW.processo := public.normalize_process_number(NEW.processo);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_students_normalize_process_number ON public.students;
CREATE TRIGGER trg_students_normalize_process_number
BEFORE INSERT OR UPDATE OF process_number ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.apply_process_number_normalization();

DROP TRIGGER IF EXISTS trg_student_accounts_normalize_process_number ON public.student_accounts;
CREATE TRIGGER trg_student_accounts_normalize_process_number
BEFORE INSERT OR UPDATE OF process_number ON public.student_accounts
FOR EACH ROW
EXECUTE FUNCTION public.apply_process_number_normalization();

DROP TRIGGER IF EXISTS trg_internships_normalize_processo ON public.internships;
CREATE TRIGGER trg_internships_normalize_processo
BEFORE INSERT OR UPDATE OF processo ON public.internships
FOR EACH ROW
EXECUTE FUNCTION public.apply_process_number_normalization();

-- ------------------------------------------------------------
-- 4) Verificacao unificada para signup
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_student_process_number(p_number TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _number  TEXT := public.normalize_process_number(p_number);
  _student RECORD;
BEGIN
  IF _number = '' THEN
    RETURN jsonb_build_object(
      'found', false,
      'error', 'invalid_number',
      'message', 'Numero de processo invalido.'
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.student_accounts sa
    WHERE public.normalize_process_number(sa.process_number) = _number
  ) THEN
    RETURN jsonb_build_object(
      'found', false,
      'error', 'already_registered',
      'message', 'Este numero de processo ja tem uma conta GIVA associada. Faz login para continuar.'
    );
  END IF;

  SELECT s.id,
         s.full_name,
         s.date_of_birth,
         s.phone_number,
         s.email,
         s.guardian_name,
         s.guardian_phone,
         s.guardian_relation,
         c.name  AS course_name,
         ta.name AS training_area_name
  INTO _student
  FROM public.students s
  LEFT JOIN public.courses c ON c.id = s.course_id
  LEFT JOIN public.training_area ta ON ta.id = s.training_area_id
  WHERE public.normalize_process_number(s.process_number) = _number
    AND upper(coalesce(s.status, 'ACTIVE')) = 'ACTIVE'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'found', false,
      'error', 'not_found',
      'message', 'Numero de processo nao encontrado ou inactivo. Contacta a secretaria do IPIZ.'
    );
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'student_id', _student.id,
    'full_name', _student.full_name,
    'date_of_birth', _student.date_of_birth,
    'phone_number', _student.phone_number,
    'email', _student.email,
    'guardian_name', _student.guardian_name,
    'guardian_phone', _student.guardian_phone,
    'guardian_relation', _student.guardian_relation,
    'course_name', _student.course_name,
    'training_area_name', _student.training_area_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_student_process_number(TEXT) TO anon, authenticated;

-- ------------------------------------------------------------
-- 5) View de leitura unificada (apoio operacional)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_student_registry_unified AS
SELECT
  s.id AS student_id,
  public.normalize_process_number(s.process_number) AS process_number,
  s.full_name,
  s.email,
  s.phone_number,
  s.status,
  s.training_area_id,
  s.course_id,
  i.id AS internship_id,
  i.turma,
  i.curso,
  i.ano_letivo,
  i.empresa,
  i.status AS internship_status,
  sa.id AS account_user_id
FROM public.students s
LEFT JOIN public.internships i
  ON public.normalize_process_number(i.processo) = public.normalize_process_number(s.process_number)
LEFT JOIN public.student_accounts sa
  ON public.normalize_process_number(sa.process_number) = public.normalize_process_number(s.process_number);

COMMIT;

-- ============================================================
-- POS-EXECUCAO RECOMENDADA
-- 1) Validar um processo existente:
--    select public.verify_student_process_number(' ipiz-2026-0001 ');
-- 2) Conferir consistencia:
--    select process_number, count(*) from public.students group by 1 having count(*) > 1;
--    select process_number, count(*) from public.student_accounts group by 1 having count(*) > 1;
-- ============================================================
