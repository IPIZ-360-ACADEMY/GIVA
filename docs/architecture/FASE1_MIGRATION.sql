-- =============================================================================
-- FASE 1: BASE DE DADOS + RLS — REESTRUTURAÇÃO GIVA
-- Data: 12 mai 2026
-- Executar manualmente no Supabase SQL Editor
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. NOVA TABELA: letter_requests
-- Rastreamento de pedidos de carta (estágio, recomendação, emprego)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.letter_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('PROFESSIONAL_INTERNSHIP', 'CURRICULAR_INTERNSHIP', 'RECOMMENDATION', 'EMPLOYMENT')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED')),
  target_area TEXT, -- Área pretendida (para estágio profissional)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_letter_requests_student_id ON public.letter_requests(student_id);
CREATE INDEX idx_letter_requests_created_at ON public.letter_requests(created_at DESC);
CREATE INDEX idx_letter_requests_status ON public.letter_requests(status);

-- RLS: Estudante vê apenas os seus pedidos
ALTER TABLE public.letter_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY letter_requests_student_select ON public.letter_requests
  FOR SELECT
  USING (
    -- Estudante vê os seus pedidos
    student_id = (
      SELECT student_id FROM public.student_accounts WHERE id = auth.uid()
    )
    OR
    -- Admin/coordenador vê pedidos da sua área
    (SELECT (auth.jwt() ->> 'role')::text) IN ('SUPER_ADMIN', 'ADMIN', 'ADMIN_1', 'COORDINATOR')
  );

CREATE POLICY letter_requests_student_insert ON public.letter_requests
  FOR INSERT
  WITH CHECK (
    -- Estudante só pode criar pedidos para si mesmo
    student_id = (
      SELECT student_id FROM public.student_accounts WHERE id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 2. NOVA TABELA: import_logs
-- Log de importações Excel
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  imported_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  total_rows INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  errors_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_import_logs_imported_by ON public.import_logs(imported_by);
CREATE INDEX idx_import_logs_created_at ON public.import_logs(created_at DESC);

-- RLS: Apenas SUPER_ADMIN e ADMIN podem ver
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY import_logs_admin_select ON public.import_logs
  FOR SELECT
  USING (
    (SELECT (auth.jwt() ->> 'role')::text) IN ('SUPER_ADMIN', 'ADMIN', 'ADMIN_1')
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 3. NOVA TABELA: student_activity_log
-- Rastreamento de ações do estudante
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.student_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- ex: 'VIEWED_VAGA', 'APPLIED_VAGA', 'SUBMITTED_LETTER'
  resource TEXT NOT NULL, -- ex: 'vaga', 'letter', 'document'
  resource_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  details JSONB
);

CREATE INDEX idx_student_activity_log_student_id ON public.student_activity_log(student_id);
CREATE INDEX idx_student_activity_log_created_at ON public.student_activity_log(created_at DESC);

-- RLS: Estudante vê apenas as suas ações
ALTER TABLE public.student_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_activity_log_select ON public.student_activity_log
  FOR SELECT
  USING (
    student_id = (
      SELECT student_id FROM public.student_accounts WHERE id = auth.uid()
    )
    OR
    (SELECT (auth.jwt() ->> 'role')::text) IN ('SUPER_ADMIN', 'ADMIN', 'ADMIN_1')
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 4. ADICIONAR COLUNA: documents.student_id
-- Associar documentos a alunos específicos
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.documents
ADD COLUMN student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
ADD COLUMN letter_request_id UUID REFERENCES public.letter_requests(id) ON DELETE SET NULL;

CREATE INDEX idx_documents_student_id ON public.documents(student_id);

-- RLS: Atualizar políticas de documents para respeitar student_id
-- Nota: Isto pode quebrar RLS existentes — ajustar conforme necessário
CREATE POLICY documents_student_select ON public.documents
  FOR SELECT
  USING (
    -- Documento global (sem student_id)
    student_id IS NULL
    OR
    -- Documento do aluno (student vê seus documentos)
    student_id = (
      SELECT student_id FROM public.student_accounts WHERE id = auth.uid()
    )
    OR
    -- Admin vê todos
    (SELECT (auth.jwt() ->> 'role')::text) IN ('SUPER_ADMIN', 'ADMIN', 'ADMIN_1', 'COORDINATOR')
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 5. ADICIONAR COLUNAS: partner_vacancies (para FASE 6)
-- Data de início/fim, status, empresa
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.partner_vacancies
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED_BY_DATE', 'CLOSED_MANUALLY')),
ADD COLUMN IF NOT EXISTS company_account_id UUID REFERENCES public.company_accounts(id) ON DELETE SET NULL;

CREATE INDEX idx_partner_vacancies_start_date ON public.partner_vacancies(start_date);
CREATE INDEX idx_partner_vacancies_end_date ON public.partner_vacancies(end_date);
CREATE INDEX idx_partner_vacancies_status ON public.partner_vacancies(status);

-- ─────────────────────────────────────────────────────────────────────────
-- 6. STORAGE PATH CONVENTION
-- Criar regras de acesso para Supabase Storage
-- Nota: Deve ser configurado via Supabase Dashboard ou CLI
-- Path pattern: docs/{area_id}/{course_id}/{class_id}/{student_id}/
-- RLS policy: Estudante só acessa seus próprios documentos
-- ─────────────────────────────────────────────────────────────────────────

-- Exemplo de criação de bucket (comentado — fazer manualmente se necessário):
-- CREATE POLICY "student_documents_read" ON storage.objects
--   FOR SELECT
--   USING (
--     bucket_id = 'documents' AND
--     (auth.uid()::text = (string_to_array(name, '/'))[5])
--   );

-- ─────────────────────────────────────────────────────────────────────────
-- 7. VERIFICAÇÃO PÓS-MIGRAÇÃO
-- ─────────────────────────────────────────────────────────────────────────

-- Executar após aplicar as alterações acima:
-- SELECT 'letter_requests' AS table_name, COUNT(*) AS row_count FROM public.letter_requests
-- UNION ALL
-- SELECT 'import_logs', COUNT(*) FROM public.import_logs
-- UNION ALL
-- SELECT 'student_activity_log', COUNT(*) FROM public.student_activity_log;

-- Para validar RLS:
-- SET ROLE "authenticated";
-- SET app.jwt.claims.sub TO 'YOUR_STUDENT_UUID';
-- SELECT * FROM public.letter_requests; -- Deve devolver apenas registos do aluno
