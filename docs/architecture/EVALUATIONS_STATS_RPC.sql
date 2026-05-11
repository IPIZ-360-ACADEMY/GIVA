-- ============================================================================
-- FASE 1: RPC PARA ESTATÍSTICAS DE AVALIAÇÕES
-- ============================================================================
-- Calcula métricas agregadas por área e contexto para o painel enriquecido
-- ============================================================================

-- PASSO 1: Função para cálculo de estatísticas
DROP FUNCTION IF EXISTS public.calc_evaluation_stats(uuid, varchar) CASCADE;

CREATE OR REPLACE FUNCTION public.calc_evaluation_stats(
  p_training_area_id uuid DEFAULT NULL,
  p_context_type varchar DEFAULT NULL  -- 'ACADEMIC' ou 'INTERNSHIP'
)
RETURNS TABLE (
  total_count bigint,
  avg_score numeric,
  min_score numeric,
  max_score numeric,
  median_score numeric,
  std_dev numeric,
  final_count bigint,
  draft_count bigint,
  has_scores bigint,
  null_scores bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS total_count,
    ROUND(AVG(score), 2)::numeric AS avg_score,
    MIN(score)::numeric AS min_score,
    MAX(score)::numeric AS max_score,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY score)::numeric AS median_score,
    ROUND(STDDEV_POP(score), 2)::numeric AS std_dev,
    COUNT(*) FILTER (WHERE is_final = TRUE)::bigint AS final_count,
    COUNT(*) FILTER (WHERE is_final = FALSE)::bigint AS draft_count,
    COUNT(*) FILTER (WHERE score IS NOT NULL)::bigint AS has_scores,
    COUNT(*) FILTER (WHERE score IS NULL)::bigint AS null_scores
  FROM public.evaluations_unified
  WHERE (p_training_area_id IS NULL OR context_area_id = p_training_area_id)
    AND (p_context_type IS NULL OR context_type = p_context_type);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.calc_evaluation_stats(uuid, varchar) IS 
  'Calcula estatísticas de avaliações por área e contexto. Retorna: total, avg, min, max, median, stddev, counts por status e nulidade de scores.';

-- PASSO 2: Função para distribuição de scores (para gráficos)
DROP FUNCTION IF EXISTS public.get_evaluation_distribution(uuid, varchar) CASCADE;

CREATE OR REPLACE FUNCTION public.get_evaluation_distribution(
  p_training_area_id uuid DEFAULT NULL,
  p_context_type varchar DEFAULT NULL
)
RETURNS TABLE (
  score_bucket numeric,
  score_label varchar,
  count bigint,
  percentage numeric
) AS $$
DECLARE
  v_total bigint;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.evaluations_unified
  WHERE (p_training_area_id IS NULL OR context_area_id = p_training_area_id)
    AND (p_context_type IS NULL OR context_type = p_context_type)
    AND score IS NOT NULL;

  IF v_total = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH buckets AS (
    SELECT
      CASE
        WHEN score < 1 THEN 0.5
        WHEN score < 2 THEN 1.5
        WHEN score < 3 THEN 2.5
        WHEN score < 4 THEN 3.5
        ELSE 4.5
      END AS bucket,
      CASE
        WHEN score < 1 THEN '0.0-1.0'
        WHEN score < 2 THEN '1.0-2.0'
        WHEN score < 3 THEN '2.0-3.0'
        WHEN score < 4 THEN '3.0-4.0'
        ELSE '4.0-5.0'
      END AS label
    FROM public.evaluations_unified
    WHERE (p_training_area_id IS NULL OR context_area_id = p_training_area_id)
      AND (p_context_type IS NULL OR context_type = p_context_type)
      AND score IS NOT NULL
  )
  SELECT
    bucket::numeric,
    label::varchar,
    COUNT(*)::bigint,
    ROUND((COUNT(*) * 100.0 / v_total), 2)::numeric
  FROM buckets
  GROUP BY bucket, label
  ORDER BY bucket;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_evaluation_distribution(uuid, varchar) IS 
  'Retorna distribuição de scores em buckets (0-1, 1-2, ..., 4-5) para gráficos de histograma.';

-- PASSO 3: Função para comparação de avaliadores (detecção de inconsistência)
DROP FUNCTION IF EXISTS public.compare_evaluators(uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.compare_evaluators(
  p_training_area_id uuid
)
RETURNS TABLE (
  evaluator_id uuid,
  evaluator_name varchar,
  total_count bigint,
  avg_score numeric,
  std_dev numeric,
  is_lenient boolean,
  is_strict boolean
) AS $$
DECLARE
  v_overall_avg numeric;
BEGIN
  -- Calcular média global
  SELECT ROUND(AVG(score), 2) INTO v_overall_avg
  FROM public.evaluations_unified
  WHERE context_area_id = p_training_area_id
    AND is_academic = TRUE
    AND score IS NOT NULL;

  RETURN QUERY
  WITH evaluator_stats AS (
    SELECT
      u.evaluator_id,
      u.evaluator_name,
      COUNT(*)::bigint AS total,
      ROUND(AVG(u.score), 2)::numeric AS avg,
      ROUND(STDDEV_POP(u.score), 2)::numeric AS stdev,
      CASE WHEN ROUND(AVG(u.score), 2) > v_overall_avg + 1 THEN TRUE ELSE FALSE END AS lenient,
      CASE WHEN ROUND(AVG(u.score), 2) < v_overall_avg - 1 THEN TRUE ELSE FALSE END AS strict
    FROM public.evaluations_unified u
    WHERE u.context_area_id = p_training_area_id
      AND u.is_academic = TRUE
      AND u.score IS NOT NULL
    GROUP BY u.evaluator_id, u.evaluator_name
    HAVING COUNT(*) >= 5  -- Pelo menos 5 avaliações
  )
  SELECT * FROM evaluator_stats
  ORDER BY avg DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.compare_evaluators(uuid) IS 
  'Compara perfis de avaliadores (rigorosos vs lenientes) em relação à média de área. Identifica possíveis inconsistências de padrão de avaliação.';

-- PASSO 4: Função para trend temporal (evolução de scores)
DROP FUNCTION IF EXISTS public.get_evaluation_trends(uuid, varchar) CASCADE;

CREATE OR REPLACE FUNCTION public.get_evaluation_trends(
  p_training_area_id uuid,
  p_period_months integer DEFAULT 6  -- Últimos N meses
)
RETURNS TABLE (
  month date,
  avg_score numeric,
  total_count bigint,
  final_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC('month', eu.evaluation_date)::date AS month,
    ROUND(AVG(eu.score), 2)::numeric,
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE eu.is_final = TRUE)::bigint
  FROM public.evaluations_unified eu
  WHERE eu.context_area_id = p_training_area_id
    AND eu.evaluation_date >= NOW() - (p_period_months::text || ' months')::interval
    AND eu.score IS NOT NULL
  GROUP BY DATE_TRUNC('month', eu.evaluation_date)
  ORDER BY month DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_evaluation_trends(uuid, integer) IS 
  'Retorna tendência temporal de scores por mês. Útil para gráficos de evolução.';

-- PASSO 5: Função para contar avaliações por estudante (ranking)
DROP FUNCTION IF EXISTS public.get_student_evaluation_ranking(uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.get_student_evaluation_ranking(
  p_training_area_id uuid
)
RETURNS TABLE (
  rank bigint,
  student_id uuid,
  student_name varchar,
  avg_score numeric,
  total_evaluations bigint,
  last_evaluation date
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT
      ROW_NUMBER() OVER (ORDER BY ROUND(AVG(eu.score), 2) DESC) AS rank_num,
      eu.student_id,
      (eu.student_name::varchar),  -- Vem do join na view
      ROUND(AVG(eu.score), 2)::numeric,
      COUNT(*)::bigint,
      MAX(eu.evaluation_date)::date
    FROM public.evaluations_unified eu
    WHERE eu.context_area_id = p_training_area_id
      AND eu.is_academic = TRUE
      AND eu.score IS NOT NULL
    GROUP BY eu.student_id, eu.student_name
  )
  SELECT * FROM ranked;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_student_evaluation_ranking(uuid) IS 
  'Retorna ranking de estudantes por média de score na área, com estatísticas de volume e data última avaliação.';

-- PASSO 6: Validação de RPC
-- Execute as queries abaixo no SQL Editor para testar as funções:

/*
-- Teste 1: Estatísticas gerais
SELECT * FROM public.calc_evaluation_stats(NULL, 'ACADEMIC');

-- Teste 2: Distribuição de scores
SELECT * FROM public.get_evaluation_distribution(NULL, 'ACADEMIC');

-- Teste 3: Comparação de avaliadores (usar area_id válida)
SELECT * FROM public.compare_evaluators('00000000-0000-0000-0000-000000000001'::uuid);

-- Teste 4: Trends temporais
SELECT * FROM public.get_evaluation_trends('00000000-0000-0000-0000-000000000001'::uuid, 6);

-- Teste 5: Ranking de estudantes
SELECT * FROM public.get_student_evaluation_ranking('00000000-0000-0000-0000-000000000001'::uuid);
*/

-- Notificação de sucesso
DO $$
BEGIN
  RAISE NOTICE '5 RPC de analytics criadas com sucesso!';
  RAISE NOTICE '- calc_evaluation_stats: Métricas agregadas (média, mediana, desvio padrão, etc.)';
  RAISE NOTICE '- get_evaluation_distribution: Distribuição de scores em buckets';
  RAISE NOTICE '- compare_evaluators: Identifica avaliadores rigorosos vs lenientes';
  RAISE NOTICE '- get_evaluation_trends: Evolução temporal de scores';
  RAISE NOTICE '- get_student_evaluation_ranking: Ranking de estudantes por performance';
  RAISE NOTICE 'Próximo: Integrar no evaluationService.js e criar dashboard com gráficos';
END $$;
