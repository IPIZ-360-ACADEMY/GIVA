-- ============================================================================
-- POLÍTICAS DE RLS COMPLETAS PARA `evaluations` (Fix #3)
-- ============================================================================
-- Complementa supabase-core-admin.sql com UPDATE e DELETE policies
-- Executar DEPOIS da migration MIGRATION_EVALUATIONS_V2_PHASE0.sql
-- ============================================================================

-- ============================================================================
-- UPDATE POLICY: Só criador ou admin pode editar avaliações
-- ============================================================================
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

-- ============================================================================
-- DELETE POLICY: Admin pode deletar; criador pode deletar sua própria
-- ============================================================================
DROP POLICY IF EXISTS "evaluations_delete_scoped" ON public.evaluations;
CREATE POLICY "evaluations_delete_scoped" ON public.evaluations
FOR DELETE
TO authenticated
USING (
  public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
  OR public.has_cross_area_scope()
  OR created_by = auth.uid()
);

-- Notificação
DO $$
BEGIN
  RAISE NOTICE 'UPDATE e DELETE policies de evaluations adicionadas com sucesso!';
END $$;
