-- =============================================================================
-- NORMALIZAÇÃO DA BASE DE DADOS — Remoção de Redundâncias
-- Data: 2026-05-01
-- Descrição: Remove tabelas sem uso, colunas não referenciadas no frontend
--             e campos denormalizados cujos dados canónicos existem noutras tabelas.
-- EXECUTAR NO SUPABASE SQL EDITOR
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABELAS SEM USO (0 rows, 0 referências no frontend)
-- -----------------------------------------------------------------------------

DROP TABLE IF EXISTS public.app_notifications CASCADE;
DROP TABLE IF EXISTS public.student_notes CASCADE;

-- -----------------------------------------------------------------------------
-- 2. COLUNA NÃO USADA EM student_accounts
--    training_area (text) nunca é lida pelo frontend.
--    O dado canónico fica em students.training_area_id → training_area.id
-- -----------------------------------------------------------------------------

ALTER TABLE public.student_accounts DROP COLUMN IF EXISTS training_area;

-- -----------------------------------------------------------------------------
-- 3. COLUNAS DENORMALIZADAS EM partners
--    vagas_total, vagas_preenchidas, vagas_disponiveis são contagens computadas
--    que nunca são lidas directamente pelo frontend (nenhum SELECT as usa).
--    Os dados canónicos de ocupação de vagas estão em partner_vacancies
--    (total_slots, filled_slots).
--    A coluna 'vagas' (capacidade declarada) é mantida — é usada pelo frontend.
-- -----------------------------------------------------------------------------

ALTER TABLE public.partners DROP COLUMN IF EXISTS vagas_disponiveis;
ALTER TABLE public.partners DROP COLUMN IF EXISTS vagas_total;
ALTER TABLE public.partners DROP COLUMN IF EXISTS vagas_preenchidas;

-- -----------------------------------------------------------------------------
-- 4. RPC OBSOLETA (actualizava partners.vagas_preenchidas — coluna removida acima)
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.increment_vagas_preenchidas(uuid, int);
DROP FUNCTION IF EXISTS public.increment_vagas_preenchidas(uuid);

-- =============================================================================
-- VERIFICAÇÃO PÓS-EXECUÇÃO
-- Execute estas queries para confirmar:
-- =============================================================================

-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--   ORDER BY table_name;

-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'student_accounts'
--   ORDER BY ordinal_position;

-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'partners'
--   ORDER BY ordinal_position;
