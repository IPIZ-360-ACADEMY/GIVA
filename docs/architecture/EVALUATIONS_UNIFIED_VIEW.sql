-- ============================================================================
-- FASE 1: VIEW UNIFICADA DE AVALIAÇÕES
-- ============================================================================
-- Consolida evaluations (acadêmicas) + intern_evaluations (estágio)
-- numa visão normalizada para painel enriquecido
-- ============================================================================

-- PASSO 1: Garantir que migrations de Fase 0 foram executadas
-- (MIGRATION_EVALUATIONS_V2_PHASE0.sql + EVALUATIONS_RLS_POLICIES_COMPLETE.sql)

-- PASSO 2: Criar view unificada
DROP VIEW IF EXISTS public.evaluations_unified CASCADE;

CREATE VIEW public.evaluations_unified AS
-- PARTE 1: Avaliações académicas (turmas / training_areas)
SELECT
  'ACADEMIC' || '_' || e.id AS unified_id,
  e.id AS source_id,
  'ACADEMIC' AS source_type,
  e.student_id,
  e.evaluator_id,
  e.evaluation_type,
  e.training_area_id AS context_area_id,
  'ACADEMIC' AS context_type,
  e.subject,
  e.score::numeric,
  CASE
    WHEN e.score IS NULL THEN NULL
    ELSE ROUND((e.score::numeric / 4.0), 2)  -- Converter 0-20 → 0-5
  END AS score_normalized_0_to_5,
  e.feedback,
  e.evaluation_date,
  e.is_final,
  e.created_by,
  e.created_at,
  e.updated_at,
  NULL::uuid AS company_progress_id,
  NULL::uuid AS partner_id,
  NULL::varchar AS eval_stage,
  NULL::boolean AS signed_by_company,
  NULL::boolean AS signed_by_student,
  TRUE AS is_academic,
  FALSE AS is_internship
FROM public.evaluations e
WHERE e.training_area_id IS NOT NULL

UNION ALL

-- PARTE 2: Avaliações de estágio (internships)
SELECT
  'INTERNSHIP' || '_' || ie.id AS unified_id,
  ie.id AS source_id,
  'INTERNSHIP' AS source_type,
  ie.student_id,
  ie.created_by AS evaluator_id,  -- Supervisor da empresa
  'GROUP' AS evaluation_type,  -- Todas avaliações de estágio são "evento"
  COALESCE(s.training_area_id, ta.id) AS context_area_id,  -- Área do aluno
  'INTERNSHIP' AS context_type,
  CONCAT('Avaliação de Estágio - ', ie.eval_type, ' (', p.company_name, ')') AS subject,
  ROUND(ie.rating_average::numeric, 2)::numeric,  -- Já 0-5
  ROUND(ie.rating_average::numeric, 2)::numeric,  -- Já 0-5
  ie.general_comments AS feedback,
  ie.eval_date::timestamptz AS evaluation_date,
  CASE WHEN ie.eval_type = 'FINAL' THEN TRUE ELSE FALSE END AS is_final,
  ie.created_by,
  ie.created_at,
  ie.updated_at,
  ie.company_progress_id,
  ie.partner_id,
  ie.eval_type AS eval_stage,
  ie.signed_by_company,
  ie.signed_by_student,
  FALSE AS is_academic,
  TRUE AS is_internship
FROM public.intern_evaluations ie
LEFT JOIN public.company_progress cp ON cp.id = ie.company_progress_id
LEFT JOIN public.students s ON s.id = ie.student_id
LEFT JOIN public.training_area ta ON ta.id = s.training_area_id
LEFT JOIN public.partners p ON p.id = ie.partner_id;

COMMENT ON VIEW public.evaluations_unified IS 
  'Visão unificada de avaliações académicas (0-20) e de estágio (0-5) com campos normalizados. Score normalizado para 0-5 para ambas. Suporta filtros por student, area, context_type e datas.';

-- PASSO 3: Criar índice para otimização (view não tem índices nativos, mas podem ser criados em tabelas base)
-- Validar índices em evaluations:
-- CREATE INDEX IF NOT EXISTS idx_evaluations_student_date ON evaluations(student_id, evaluation_date DESC);
-- CREATE INDEX IF NOT EXISTS idx_evaluations_training_area ON evaluations(training_area_id);

-- Validar índices em intern_evaluations:
-- CREATE INDEX IF NOT EXISTS idx_intern_evaluations_student_date ON intern_evaluations(student_id, eval_date DESC);
-- CREATE INDEX IF NOT EXISTS idx_intern_evaluations_company_progress ON intern_evaluations(company_progress_id);

-- PASSO 4: Criar função de teste para validar view
DROP FUNCTION IF EXISTS public.test_evaluations_unified() CASCADE;

CREATE OR REPLACE FUNCTION public.test_evaluations_unified()
RETURNS TABLE (
  total_records bigint,
  academic_count bigint,
  internship_count bigint,
  with_score bigint,
  sample_row text
) AS $$
DECLARE
  v_total bigint;
  v_academic bigint;
  v_internship bigint;
  v_with_score bigint;
  v_sample text;
BEGIN
  -- Contar registos
  SELECT COUNT(*) INTO v_total FROM public.evaluations_unified;
  SELECT COUNT(*) INTO v_academic FROM public.evaluations_unified WHERE context_type = 'ACADEMIC';
  SELECT COUNT(*) INTO v_internship FROM public.evaluations_unified WHERE context_type = 'INTERNSHIP';
  SELECT COUNT(*) INTO v_with_score FROM public.evaluations_unified WHERE score IS NOT NULL;

  -- Amostrar um registo
  SELECT ROW_TO_JSON(t)::text INTO v_sample FROM public.evaluations_unified t LIMIT 1;

  RETURN QUERY
  SELECT v_total, v_academic, v_internship, v_with_score, COALESCE(v_sample, 'Sem dados');
END;
$$ LANGUAGE plpgsql STABLE;

-- Teste rápido: SELECT * FROM public.test_evaluations_unified();

-- PASSO 5: Validação de dados
-- Execute as queries abaixo no SQL Editor para validar a view:

/*
-- Query 1: Total de registos por contexto
SELECT context_type, COUNT(*) as total, AVG(score) as avg_score FROM evaluations_unified GROUP BY context_type;

-- Query 2: Amostra de Academic
SELECT * FROM evaluations_unified WHERE context_type = 'ACADEMIC' LIMIT 5;

-- Query 3: Amostra de Internship
SELECT * FROM evaluations_unified WHERE context_type = 'INTERNSHIP' LIMIT 5;

-- Query 4: Teste da função
SELECT * FROM public.test_evaluations_unified();

-- Query 5: Validação de scores normalizados
SELECT 
  source_type, 
  score, 
  score_normalized_0_to_5,
  CASE 
    WHEN source_type = 'ACADEMIC' AND score IS NOT NULL THEN (score / 4.0)::numeric
    WHEN source_type = 'INTERNSHIP' THEN score_normalized_0_to_5
  END as expected_norm
FROM evaluations_unified
WHERE score IS NOT NULL
LIMIT 10;
*/

-- Notificação de sucesso
DO $$
BEGIN
  RAISE NOTICE 'View evaluations_unified criada com sucesso!';
  RAISE NOTICE 'Consolidada avaliações académicas (0-20 normalizado → 0-5) + estágio (0-5)';
  RAISE NOTICE 'Pronta para queries com filtros por student, area, context_type, datas';
  RAISE NOTICE 'Próximo: Expandir evaluationService.js com funções de agregação';
END $$;
