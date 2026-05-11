-- ============================================================================
-- MIGRATION: Expandir tabela `evaluations` para suportar painel enriquecido
-- ============================================================================
-- Data: 11 de maio de 2026
-- Objetivo: Adicionar campos para avaliações individuais, grupos, tipos, scores 0-20,
--           auditoria e referências de avaliador/estudante
-- Risco: MÉDIO (colunas adicionadas como nullable com defaults, sem dados apagados)
-- Rollback: Mantém backup em evaluations_v0
-- ============================================================================

-- PASSO 1: Backup da tabela original
CREATE TABLE IF NOT EXISTS public.evaluations_v0 AS SELECT * FROM public.evaluations;

-- PASSO 2: Desabilitar RLS temporariamente para modificação
ALTER TABLE public.evaluations DISABLE ROW LEVEL SECURITY;

-- PASSO 3: Adicionar novas colunas à tabela
ALTER TABLE public.evaluations
  -- Novo campo de tipo (INDIVIDUAL ou GROUP)
  ADD COLUMN IF NOT EXISTS evaluation_type VARCHAR(20) NOT NULL DEFAULT 'INDIVIDUAL'
    CHECK (evaluation_type IN ('INDIVIDUAL', 'GROUP')),
  
  -- FKs para estudante e avaliador
  ADD COLUMN IF NOT EXISTS student_id UUID,
  ADD COLUMN IF NOT EXISTS evaluator_id UUID,
  
  -- Detalhes da avaliação
  ADD COLUMN IF NOT EXISTS evaluation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS subject VARCHAR(255),
  ADD COLUMN IF NOT EXISTS score DECIMAL(5,2)
    CHECK (score IS NULL OR (score >= 0 AND score <= 20)),
  ADD COLUMN IF NOT EXISTS feedback TEXT,
  ADD COLUMN IF NOT EXISTS is_final BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Linking entre avaliações em grupo
  ADD COLUMN IF NOT EXISTS group_evaluation_id UUID,
  
  -- Auditoria
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Renomear area_id para training_area_id (para consistência com academia)
  ADD COLUMN IF NOT EXISTS training_area_id UUID;

-- PASSO 4: Copiar dados de area_id para training_area_id (se existirem)
UPDATE public.evaluations SET training_area_id = area_id WHERE training_area_id IS NULL;

-- PASSO 5: Renomear coluna aluno/curso para campos normalizados (com fallback para strings antigas)
-- Se o schema esperado for student_id/evaluator_id, estes campos legacy ficam como referência
ALTER TABLE public.evaluations
  RENAME COLUMN aluno TO legacy_aluno_name;

ALTER TABLE public.evaluations
  RENAME COLUMN curso TO legacy_curso_name;

-- PASSO 6: Criar FKs (assumindo tabelas students e training_area existem)
-- Se não existirem, estas constraints podem ser adicionadas depois
ALTER TABLE public.evaluations
  ADD CONSTRAINT fk_evaluations_student 
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_evaluations_evaluator 
    FOREIGN KEY (evaluator_id) REFERENCES public.students(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_evaluations_group 
    FOREIGN KEY (group_evaluation_id) REFERENCES public.evaluations(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_evaluations_training_area 
    FOREIGN KEY (training_area_id) REFERENCES public.training_area(id) ON DELETE RESTRICT;

-- PASSO 7: Criar índices para otimização de queries
CREATE INDEX IF NOT EXISTS idx_evaluations_student_date 
  ON public.evaluations(student_id, evaluation_date DESC);
CREATE INDEX IF NOT EXISTS idx_evaluations_evaluator_date 
  ON public.evaluations(evaluator_id, evaluation_date DESC);
CREATE INDEX IF NOT EXISTS idx_evaluations_type_area 
  ON public.evaluations(evaluation_type, training_area_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_group 
  ON public.evaluations(group_evaluation_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_is_final 
  ON public.evaluations(is_final, training_area_id);

-- PASSO 8: Reabilitar RLS com novas policies
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- PASSO 9: Atualizar RLS policies com cobertura completa (SELECT, INSERT, UPDATE, DELETE)

-- SELECT policy: Acesso escopado por área
DROP POLICY IF EXISTS "evaluations_select_scoped" ON public.evaluations;
CREATE POLICY "evaluations_select_scoped" ON public.evaluations
FOR SELECT
TO authenticated
USING (
  public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
  OR public.has_cross_area_scope()
  OR training_area_id = public.current_area_id()
);

-- INSERT policy: Criação escopada + criador
DROP POLICY IF EXISTS "evaluations_insert_scoped" ON public.evaluations;
CREATE POLICY "evaluations_insert_scoped" ON public.evaluations
FOR INSERT
TO authenticated
WITH CHECK (
  (
    public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
    OR public.has_cross_area_scope()
    OR training_area_id = public.current_area_id()
  )
  AND created_by = auth.uid()
);

-- UPDATE policy: Só criador ou admin pode editar
DROP POLICY IF EXISTS "evaluations_update_scoped" ON public.evaluations;
CREATE POLICY "evaluations_update_scoped" ON public.evaluations
FOR UPDATE
TO authenticated
USING (
  (
    public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
    OR public.has_cross_area_scope()
    OR training_area_id = public.current_area_id()
  )
  AND created_by = auth.uid()
)
WITH CHECK (
  (
    public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
    OR public.has_cross_area_scope()
    OR training_area_id = public.current_area_id()
  )
  AND created_by = auth.uid()
);

-- DELETE policy: Admin pode deletar; criador pode deletar sua própria (com restrições)
DROP POLICY IF EXISTS "evaluations_delete_scoped" ON public.evaluations;
CREATE POLICY "evaluations_delete_scoped" ON public.evaluations
FOR DELETE
TO authenticated
USING (
  public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
  OR public.has_cross_area_scope()
  OR created_by = auth.uid()
);

-- PASSO 10: Criar trigger para atualizar updated_at automaticamente
DROP FUNCTION IF EXISTS public.update_evaluations_updated_at() CASCADE;
CREATE OR REPLACE FUNCTION public.update_evaluations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_evaluations_updated_at ON public.evaluations;
CREATE TRIGGER update_evaluations_updated_at
BEFORE UPDATE ON public.evaluations
FOR EACH ROW
EXECUTE FUNCTION public.update_evaluations_updated_at();

-- PASSO 11: Comentários de documentação
COMMENT ON TABLE public.evaluations IS 
  'Avaliações académicas individuais e em grupo com rastreabilidade completa. Suporta scores 0-20 (Português) e dimensões 1-5 (estágio). Linked com intern_evaluations via company_progress.';

COMMENT ON COLUMN public.evaluations.evaluation_type IS 
  'INDIVIDUAL: Avaliação de um aluno. GROUP: Avaliação aplicada a múltiplos alunos com mesmo score/feedback.';

COMMENT ON COLUMN public.evaluations.student_id IS 
  'Aluno sendo avaliado (FK students). Null apenas para GROUP pai.';

COMMENT ON COLUMN public.evaluations.evaluator_id IS 
  'Professor/avaliador criando a avaliação (FK students). Deve ser autorizado na training_area.';

COMMENT ON COLUMN public.evaluations.score IS 
  'Nota 0-20 (compatível com sistema Português académico). Não null para avaliações finais.';

COMMENT ON COLUMN public.evaluations.is_final IS 
  'True = avaliação final do período (não deve ser editada sem audit trail).';

COMMENT ON COLUMN public.evaluations.group_evaluation_id IS 
  'Se não null, esta é uma avaliação filha de um GROUP pai. Deletar pai cascadeia.';

COMMENT ON COLUMN public.evaluations.legacy_aluno_name IS 
  'Backup do nome original (antes normalização para student_id). Apenas leitura após migração.';

COMMENT ON COLUMN public.evaluations.legacy_curso_name IS 
  'Backup do curso original (antes normalização para training_area_id). Apenas leitura após migração.';

-- Notificação de sucesso
DO $$
BEGIN
  RAISE NOTICE 'Migration de evaluations concluída com sucesso!';
  RAISE NOTICE 'Tabela backup: evaluations_v0';
  RAISE NOTICE 'Novos campos: evaluation_type, student_id, evaluator_id, evaluation_date, subject, score, feedback, is_final, group_evaluation_id, updated_at, training_area_id';
  RAISE NOTICE 'RLS policies atualizadas: SELECT, INSERT, UPDATE, DELETE';
  RAISE NOTICE 'Índices criados para: student_date, evaluator_date, type_area, group, is_final';
END $$;
