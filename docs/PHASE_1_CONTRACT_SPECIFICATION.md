# Fase 1: Contrato de Domínio Unificado de Avaliações

**Objetivo:** Consolidar leitura de avaliações académicas (training_area) e de estágio numa abstração unificada sem quebrar serviços existentes. Criar layer de agregação neutro que permite painel multi-visão por perfil.

**Dependência:** ✅ Fase 0 completa (TEACHER no menu, schema migration pronta)

**Data:** 11 de maio de 2026  
**Status:** ⏳ Planejada  
**Esforço Estimado:** 6-8h (SQL view + JS layer + validação)

---

## 1. PASSO-A-PASSO FASE 1

### 1.1 Prerequisito: Executar Migrations de Fase 0

**Antes de qualquer código de Fase 1, OBRIGATÓRIO:**
1. Executar `MIGRATION_EVALUATIONS_V2_PHASE0.sql` no Supabase SQL Editor
2. Executar `EVALUATIONS_RLS_POLICIES_COMPLETE.sql` no Supabase SQL Editor
3. Validar que tabela `evaluations` tem novos campos (student_id, evaluator_id, score, etc.)

**Validação rápida no SQL Editor:**
```sql
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name='evaluations' ORDER BY ordinal_position;
-- Deve listar: id, evaluation_type, student_id, evaluator_id, evaluation_date, subject, score, feedback, is_final, group_evaluation_id, created_by, created_at, updated_at, training_area_id
```

---

### 1.2 Criar View SQL Unificada: `evaluations_unified`

**Objetivo:** Abstrair duas tabelas (`evaluations` + `intern_evaluations`) numa visão normalizada.

**Arquivo a Criar:** `docs/architecture/EVALUATIONS_UNIFIED_VIEW.sql`

```sql
-- ============================================================================
-- VIEW: evaluations_unified
-- Consolida evaluations (acadêmicas) + intern_evaluations (estágio)
-- ============================================================================

DROP VIEW IF EXISTS public.evaluations_unified CASCADE;

CREATE VIEW public.evaluations_unified AS
-- PARTE 1: Avaliações académicas (training areas)
SELECT
  e.id,
  e.student_id,
  e.evaluator_id,
  e.evaluation_type,
  e.training_area_id AS context_area_id,
  'ACADEMIC' AS context_type,
  e.subject,
  e.score::numeric,
  e.score::numeric / 4 AS score_normalized_0_to_5,  -- Converter 0-20 → 0-5
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
  NULL::boolean AS signed_by_student
FROM public.evaluations e
WHERE e.training_area_id IS NOT NULL

UNION ALL

-- PARTE 2: Avaliações de estágio
SELECT
  ie.id,
  ie.student_id,
  ie.created_by AS evaluator_id,  -- Partner/supervisor
  'GROUP' AS evaluation_type,  -- Todas estágio são "grupo" (um evento)
  ta.id AS context_area_id,  -- Tentar linkar com training_area via student
  'INTERNSHIP' AS context_type,
  CONCAT('Avaliação de Estágio - ', ie.eval_type) AS subject,
  ie.rating_average::numeric,  -- 0-5
  ie.rating_average::numeric,  -- Já 0-5
  ie.general_comments AS feedback,
  ie.eval_date AS evaluation_date,
  CASE WHEN ie.eval_type = 'FINAL' THEN TRUE ELSE FALSE END AS is_final,
  ie.created_by,
  ie.created_at,
  ie.updated_at,
  ie.company_progress_id,
  ie.partner_id,
  ie.eval_type AS eval_stage,
  ie.signed_by_company,
  ie.signed_by_student
FROM public.intern_evaluations ie
LEFT JOIN public.company_progress cp ON cp.id = ie.company_progress_id
LEFT JOIN public.students s ON s.id = ie.student_id
LEFT JOIN public.training_area ta ON ta.id = s.training_area_id;

COMMENT ON VIEW public.evaluations_unified IS 
  'Visão unificada de avaliações académicas e de estágio com campos normalizados para painel enriquecido.';

-- Índice para otimização
CREATE INDEX IF NOT EXISTS idx_evaluations_unified_student_context 
ON public.evaluations_unified(student_id, context_type, evaluation_date DESC);

-- ============================================================================
-- RLS para view (replicar regras da tabela source)
-- ============================================================================
ALTER VIEW public.evaluations_unified SET (security_barrier = on);

DROP POLICY IF EXISTS "evaluations_unified_select" ON public.evaluations_unified;
CREATE POLICY "evaluations_unified_select" ON public.evaluations_unified
FOR SELECT
TO authenticated
USING (
  public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
  OR public.has_cross_area_scope()
  OR context_area_id = public.current_area_id()
);
```

**Execução:**
1. Copiar SQL acima para novo arquivo `EVALUATIONS_UNIFIED_VIEW.sql`
2. Executar no Supabase SQL Editor
3. Validar: `SELECT COUNT(*) FROM evaluations_unified;` deve retornar total de ambas tabelas

---

### 1.3 Expandir `evaluationService.js` com Layer de Agregação

**Arquivo:** `src/services/evaluationService.js`

**Novas Funções:**

```javascript
// ============================================================================
// NOVA: Query unificada com filtros multi-perfil
// ============================================================================
export async function getEvaluationsUnified(filters = {}) {
  if (!canUseEvaluationApi()) return [];

  const {
    studentId,
    evaluatorId,
    trainingAreaId,
    contextType, // 'ACADEMIC' | 'INTERNSHIP' | undefined (ambas)
    isFinal,
    startDate,
    endDate,
    sortBy = 'evaluation_date', // evaluation_date | score | subject
    sortOrder = 'desc'
  } = filters;

  let query = supabase
    .from('evaluations_unified')
    .select(`
      id,
      student_id,
      evaluator_id,
      evaluation_type,
      context_area_id,
      context_type,
      subject,
      score,
      score_normalized_0_to_5,
      feedback,
      evaluation_date,
      is_final,
      created_by,
      created_at,
      updated_at,
      company_progress_id,
      partner_id,
      eval_stage,
      signed_by_company,
      signed_by_student,
      student:student_id(full_name, email),
      evaluator:evaluator_id(full_name, email),
      area:context_area_id(name, color_hex)
    `);

  // Aplicar filtros
  if (studentId) query = query.eq('student_id', studentId);
  if (evaluatorId) query = query.eq('evaluator_id', evaluatorId);
  if (trainingAreaId) query = query.eq('context_area_id', trainingAreaId);
  if (contextType) query = query.eq('context_type', contextType);
  if (isFinal !== undefined) query = query.eq('is_final', isFinal);
  if (startDate) query = query.gte('evaluation_date', startDate);
  if (endDate) query = query.lte('evaluation_date', endDate);

  // Ordenação
  query = query.order(sortBy, { ascending: sortOrder === 'asc' });

  const { data, error } = await query;

  if (error) {
    console.error('[evaluationService] getEvaluationsUnified error:', error);
    return [];
  }

  return data || [];
}

// ============================================================================
// NOVA: Agregações por perfil
// ============================================================================
export async function getEvaluationStats(trainingAreaId, contextType = 'ACADEMIC') {
  if (!canUseEvaluationApi()) return null;

  const { data, error } = await supabase
    .rpc('calc_evaluation_stats', {
      p_training_area_id: trainingAreaId,
      p_context_type: contextType
    });

  if (error) {
    console.error('[evaluationService] getEvaluationStats error:', error);
    return null;
  }

  return data;
}

// ============================================================================
// NOVA: Export por perfil com governança
// ============================================================================
export async function exportEvaluationsReportByProfile(profileRole, filters = {}) {
  const evaluations = await getEvaluationsUnified(filters);

  if (!evaluations.length) return [];

  // Governar colunas por role
  const columns = {
    'SUPER_ADMIN': [
      'student_name', 'evaluator_name', 'area_name', 'subject',
      'score', 'context_type', 'evaluation_date', 'is_final', 'feedback'
    ],
    'ADMIN_1': [
      'student_name', 'evaluator_name', 'subject',
      'score', 'evaluation_date', 'is_final'
    ],
    'COORDINATOR': [
      'student_name', 'subject', 'score', 'evaluation_date', 'is_final'
    ],
    'TEACHER': [
      'student_name', 'subject', 'score', 'evaluation_date'
    ],
    'STUDENT': [
      'subject', 'score', 'evaluation_date', 'feedback'
    ],
    'COMPANY': [
      'student_name', 'subject', 'score', 'evaluation_date'
    ]
  };

  const allowedColumns = columns[profileRole] || columns['STUDENT'];

  // Mapear dados para colunas permitidas
  return evaluations.map(ev => {
    const row = {};
    if (allowedColumns.includes('student_name')) row.student = ev.student?.full_name;
    if (allowedColumns.includes('evaluator_name')) row.evaluator = ev.evaluator?.full_name;
    if (allowedColumns.includes('area_name')) row.area = ev.area?.name;
    if (allowedColumns.includes('subject')) row.subject = ev.subject;
    if (allowedColumns.includes('score')) row.score = ev.score?.toFixed(2);
    if (allowedColumns.includes('context_type')) row.type = ev.context_type;
    if (allowedColumns.includes('evaluation_date')) row.date = ev.evaluation_date;
    if (allowedColumns.includes('is_final')) row.final = ev.is_final ? 'Sim' : 'Não';
    if (allowedColumns.includes('feedback')) row.feedback = ev.feedback;
    return row;
  });
}

// ============================================================================
// NOVA: Contagem agregada por contexto
// ============================================================================
export async function getEvaluationCountByContext(trainingAreaId) {
  if (!canUseEvaluationApi()) return { academic: 0, internship: 0 };

  const { data, error } = await supabase
    .from('evaluations_unified')
    .select('context_type', { count: 'exact' })
    .eq('context_area_id', trainingAreaId);

  if (error) {
    console.error('[evaluationService] getEvaluationCountByContext error:', error);
    return { academic: 0, internship: 0 };
  }

  const academic = data?.filter(d => d.context_type === 'ACADEMIC').length || 0;
  const internship = data?.filter(d => d.context_type === 'INTERNSHIP').length || 0;

  return { academic, internship };
}
```

**Validação:**
- [ ] `getEvaluationsUnified()` retorna array consolidado
- [ ] Filtros funcionam (studentId, trainingAreaId, contextType, etc.)
- [ ] Export por perfil mostra colunas corretas

---

### 1.4 Criar RPC Supabase para Estatísticas

**Arquivo:** `docs/architecture/EVALUATIONS_STATS_RPC.sql`

```sql
-- ============================================================================
-- RPC: calc_evaluation_stats
-- Calcula estatísticas de avaliações por área e contexto
-- ============================================================================

DROP FUNCTION IF EXISTS public.calc_evaluation_stats(uuid, varchar) CASCADE;

CREATE OR REPLACE FUNCTION public.calc_evaluation_stats(
  p_training_area_id uuid,
  p_context_type varchar
)
RETURNS TABLE (
  total_count bigint,
  avg_score numeric,
  min_score numeric,
  max_score numeric,
  median_score numeric,
  std_dev numeric,
  final_count bigint,
  draft_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint,
    AVG(score)::numeric,
    MIN(score)::numeric,
    MAX(score)::numeric,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY score)::numeric,
    STDDEV(score)::numeric,
    COUNT(*) FILTER (WHERE is_final = TRUE)::bigint,
    COUNT(*) FILTER (WHERE is_final = FALSE)::bigint
  FROM public.evaluations_unified
  WHERE context_area_id = p_training_area_id
    AND context_type = p_context_type;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

### 1.5 Validação de Contrato Unificado

**Testes a executar (em `src/test/evaluations.unified.test.js`):**

```javascript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  getEvaluationsUnified,
  exportEvaluationsReportByProfile,
  getEvaluationCountByContext
} from '../services/evaluationService.js';

describe('Contrato Unificado de Avaliações', () => {
  let testTrainingAreaId = '...'; // ID válido do teste

  it('retorna avaliações unificadas com joins', async () => {
    const evals = await getEvaluationsUnified({ trainingAreaId: testTrainingAreaId });
    expect(Array.isArray(evals)).toBe(true);
    // Validar estrutura normalizada
    if (evals.length > 0) {
      expect(evals[0]).toHaveProperty('id');
      expect(evals[0]).toHaveProperty('student_id');
      expect(evals[0]).toHaveProperty('score');
      expect(evals[0]).toHaveProperty('context_type'); // 'ACADEMIC' ou 'INTERNSHIP'
    }
  });

  it('exporta com colunas governadas por perfil STUDENT', async () => {
    const report = await exportEvaluationsReportByProfile('STUDENT', { trainingAreaId: testTrainingAreaId });
    expect(Array.isArray(report)).toBe(true);
    if (report.length > 0) {
      // STUDENT só vê: subject, score, date, feedback
      expect(report[0]).toHaveProperty('subject');
      expect(report[0]).toHaveProperty('score');
      expect(report[0]).toHaveProperty('date');
      expect(report[0]).toHaveProperty('feedback');
      // STUDENT não vê: evaluator, area, student_name
      expect(report[0]).not.toHaveProperty('evaluator');
    }
  });

  it('retorna contagem por contexto', async () => {
    const counts = await getEvaluationCountByContext(testTrainingAreaId);
    expect(counts).toHaveProperty('academic');
    expect(counts).toHaveProperty('internship');
    expect(typeof counts.academic).toBe('number');
    expect(typeof counts.internship).toBe('number');
  });
});
```

---

## 2. ENTREGÁVEIS FASE 1

| Artefato | Status | Notas |
|----------|--------|-------|
| **EVALUATIONS_UNIFIED_VIEW.sql** | ⏳ Pronto | SQL pronta, executar no Supabase |
| **EVALUATIONS_STATS_RPC.sql** | ⏳ Pronto | RPC para métricas, executar no Supabase |
| **evaluationService.js expandido** | ⏳ Código pronto | Novas funções para agregação e export governado |
| **evaluations.unified.test.js** | ⏳ Pronto | 3 testes de validação de contrato |
| **Documentação de Fase 1** | ✅ Feita | Este arquivo |

---

## 3. CHECKLIST DE CONCLUSÃO FASE 1

- [ ] `EVALUATIONS_UNIFIED_VIEW.sql` executado no Supabase
- [ ] `EVALUATIONS_STATS_RPC.sql` executado no Supabase
- [ ] `evaluationService.js` expandido com 5 novas funções
- [ ] `evaluations.unified.test.js` cria e todos os testes passam
- [ ] Build produção sem erros
- [ ] View `evaluations_unified` retorna dados de ambas as tabelas
- [ ] RPC `calc_evaluation_stats` funciona
- [ ] Export por perfil respeita governança de colunas

---

## 4. PRÓXIMOS PASSOS (Fase 2)

Após Fase 1 aprovada:
1. Formalizar matriz de RBAC/visibilidade por perfil
2. Implementar middlewares de autorização no frontend (RequirePermission.jsx)
3. Criar testes de acesso por perfil × ação (bloqueio de escalação de privilégio)

---

**Fim Fase 1 Planejamento**
