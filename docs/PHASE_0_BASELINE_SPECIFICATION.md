# Fase 0: Baseline Técnico e Congelamento de Escopo

**Objetivo:** Consolidar inventário atual de avaliações, confirmar fontes de verdade e estabelecer Definition of Done por perfil para o painel enriquecido.

**Data:** 11 de maio de 2026  
**Status:** ✅ Em execução  
**Esforço Estimado:** 4h (análise + especificação + primeiras correções críticas)

---

## 1. INVENTÁRIO ATUAL: FONTES DE VERDADE

### 1.1 Tabelas de Dados

| Tabela | Contexto | Estado | Lacunas |
|--------|----------|--------|---------|
| **evaluations** | Avaliações académicas (treino/turmas) | ⚠️ Básica | Sem `created_by` detalhado, sem `evaluation_type`, sem `score` (0-20), sem `evaluation_date`, sem `is_final`, sem rastreabilidade |
| **intern_evaluations** | Avaliações de estágio | ✅ Rica | Dimensões (1-5), fases validadas, `signed_by_company`, histórico de assinatura |
| **company_progress** | Contexto de estágio (linking) | ✅ Integrado | Campos `student_assessment_rating`, `company_assessment_rating`, `progression_stage` |
| **intern_followup_logs** | Diário de acompanhamento | ✅ Suporte | Presença, notas, desempenho semanal |
| **users_profiles / app_user** | Informações de utilizador | ✅ Disponível | Role, área, tipo de conta |

**Conclusão:** Tabela `evaluations` precisa ser expandida significativamente para suportar contrato enriquecido.

---

### 1.2 Serviços JS Ativos

| Serviço | Funções | Status | Lacunas |
|---------|---------|--------|---------|
| **evaluationService.js** | CRUD individual/grupo, export CSV | ✅ Básico | Sem filtros avançados, sem agregações, sem bulk ops |
| **internFollowupService.js** | Logs, objetivos, avaliações de estágio | ✅ Completo | Bem estruturado |
| **companyProgressService.js** | Fetch progresso, timeline | ✅ Presente | Sem agregações multi-aluno |

**Conclusão:** Serviços existem mas precisam ser expandidos para queries complexas, agregações e multi-view.

---

### 1.3 Rotas e Acesso Atuais

| Perfil | Rota `/avaliacoes` | Menu | Ações Permitidas | Status |
|--------|-------------------|------|------------------|--------|
| **SUPER_ADMIN** | ✅ Sim | Sim | Ver tudo, criar, editar, exportar | ✅ OK |
| **ADMIN_1** | ✅ Sim | Sim | Ver tudo (não mostrado no menu) | ⚠️ Menu falta |
| **COORDINATOR** | ✅ Sim | Sim | Ver sua área, criar | ✅ OK |
| **TEACHER** | ❌ **NÃO** | **Não existe** | **Bloqueado** | 🔴 **CRÍTICO** |
| **STUDENT** | ✅ Sim | Sim | Ver próprias | ✅ OK |
| **COMPANY** | ❌ Não | Não | Sem acesso direto | ✅ OK (usa `/empresa`) |
| **EXTERNAL** | ❌ Não | Não | Sem acesso | ✅ OK |

**Conclusão:** TEACHER está bloqueado de acesso a avaliações; é a lacuna crítica nº 1.

---

### 1.4 RLS e Segurança Atuais

**Estado das Policies em `supabase-core-admin.sql`:**
```sql
-- SELECT: SUPER_ADMIN, ADMIN_1, cross_area_scope, OU area_id = current_area_id()
-- INSERT: Mesmas regras MAIS created_by = auth.uid()
-- UPDATE/DELETE: Não definidas (gap crítico!)
```

**Lacunas Identificadas:**
- ❌ Sem validação de `evaluator_id` autorizado na área
- ❌ Sem check se user é professor da turma/área
- ❌ Sem UPDATE/DELETE policies
- ❌ Sem audit trail de mudanças
- ❌ Sem isolamento de `group_evaluation_id` em cascata

**Conclusão:** RLS precisa ser fortalecida significativamente.

---

## 2. CRITÉRIOS DE ACEITE POR PERFIL (Definition of Done)

### 2.1 SUPER_ADMIN / ADMIN_1

**Deve conseguir:**
- ✅ Ver todas avaliações (todas áreas)
- ✅ Criar avaliação individual/grupo em qualquer área
- ✅ Editar/deletar avaliações (com auditoria)
- ✅ Exportar report consolidado (todas áreas, filtros avançados)
- ✅ Ver métricas agregadas globais
- ✅ Aprovar/rejeitar avaliações em workflow
- ✅ Acessar trilha de auditoria completa

**Testes:**
```javascript
- [ ] Pode acessar /avaliacoes sem redirecionamento
- [ ] Vê lista completa de avaliações de todas áreas
- [ ] Consegue filtrar por período, avaliador, tipo
- [ ] Export inclui todas colunas + metadados
```

---

### 2.2 COORDINATOR

**Deve conseguir:**
- ✅ Ver avaliações **apenas da sua área**
- ✅ Criar avaliação individual/grupo **na sua área**
- ✅ Editar avaliação da sua área
- ✅ Exportar report **da sua área**
- ✅ Ver métricas da sua área
- ✅ Aprovar/rejeitar avaliações **da sua área**
- ❌ Ver avaliações de outras áreas

**Testes:**
```javascript
- [ ] Pode acessar /avaliacoes com rota protegida
- [ ] Vê lista filtrada apenas área_id = sua_area
- [ ] Botão criar está visível
- [ ] Não consegue editar/deletar avaliação de outra área (RLS nega)
- [ ] Export mostra apenas sua área
```

---

### 2.3 TEACHER

**Deve conseguir:**
- ✅ Acessar `/avaliacoes` (agora adicionado ao menu)
- ✅ Ver avaliações das suas classes/turmas
- ✅ Criar avaliação individual/grupo para alunos suas classes
- ✅ Editar avaliações que criou
- ✅ Exportar report das suas classes
- ❌ Ver avaliações de outras turmas/professores

**Testes:**
```javascript
- [ ] Pode acessar /avaliacoes com rota protegida
- [ ] Vê avaliações apenas de turmas onde é professor
- [ ] Botão criar está visível
- [ ] Consegue criar avaliação com seus alunos
- [ ] Export mostra apenas suas classes
```

---

### 2.4 STUDENT

**Deve conseguir:**
- ✅ Ver próprias avaliações (acadêmicas + estágio)
- ✅ Ver avaliações finais após aprovação
- ✅ Exportar próprio relatório
- ✅ Ver histórico completo com datas
- ❌ Criar/editar avaliações
- ❌ Ver avaliações de outros alunos

**Testes:**
```javascript
- [ ] Pode acessar /avaliacoes com rota protegida
- [ ] Vê apenas próprias avaliações (student_id = auth.uid())
- [ ] Não consegue clicar em botões de criar/editar
- [ ] Export só suas avaliações
```

---

### 2.5 COMPANY

**Deve conseguir:**
- ✅ Preencher avaliações de estágio (MIDTERM/FINAL) de seus estagiários
- ✅ Assinar avaliações (`signed_by_company`)
- ✅ Ver histórico de avaliações de seus estagiários
- ✅ Exportar relatório dos seus estagiários
- ❌ Ver avaliações acadêmicas
- ❌ Acessar `/avaliacoes` (redirecionar para `/empresa`)

**Testes:**
```javascript
- [ ] Redireciona de /avaliacoes para /empresa
- [ ] Em /empresa, consegue clicar em "Avaliar" para seus estagiários
- [ ] Modal de avaliação valida stage (MIDTERM/FINAL)
- [ ] Consegue assinar avaliação
- [ ] Não consegue editar avaliação assinada
```

---

### 2.6 EXTERNAL

**Deve conseguir:**
- ✅ Sem acesso a avaliações (bloqueado)
- ✅ Possivelmente ver agregações públicas se houver relatório público
- ❌ Acessar `/avaliacoes`

**Testes:**
```javascript
- [ ] Redireciona de /avaliacoes para /home ou /login
- [ ] Não consegue clicar em menu de avaliações (se houver)
```

---

## 3. LACUNAS CRÍTICAS IDENTIFICADAS (P0 - Bloqueia Fase 1)

### 3.1 🔴 TEACHER não tem rota `/avaliacoes` em menu

**Arquivo:** [src/components/AppShell.jsx](src/components/AppShell.jsx#L100-L115)  
**Problema:** Falta `{ to: "/avaliacoes", icon: "grading", label: t("nav.evaluations") }` na seção do TEACHER  
**Impacto:** TEACHER não consegue navegar para painel de avaliações  
**Fix:** 1 linha no AppShell.jsx

---

### 3.2 🔴 Tabela `evaluations` é demasiado primitiva

**Arquivo:** [docs/architecture/supabase-core-admin.sql](docs/architecture/supabase-core-admin.sql#L1-L20)  
**Problema:** Tabela tem apenas `aluno`, `curso`, `nota`, `area_id`, sem:
- `student_id` (UUID, FK students)
- `evaluator_id` (UUID, FK students — professor)
- `evaluation_type` ('INDIVIDUAL' | 'GROUP')
- `evaluation_date` (timestamp)
- `subject` (texto da avaliação)
- `score` (decimal 0-20)
- `feedback` (texto)
- `is_final` (boolean)
- `group_evaluation_id` (UUID, para linking)
- `created_by` (UUID, FK users)
- `updated_at` (timestamp, para auditoria)

**Impacto:** Impossível suportar contrato de dados enriquecido  
**Fix:** Migration SQL para expandir schema (Fase 1)

---

### 3.3 🔴 RLS incompleta (sem UPDATE/DELETE policies)

**Arquivo:** [docs/architecture/supabase-core-admin.sql](docs/architecture/supabase-core-admin.sql#L24-L40)  
**Problema:** Só tem SELECT/INSERT; faltam UPDATE e DELETE  
**Impacto:** Qualquer um pode deletar avaliações (segurança crítica)  
**Fix:** Adicionar policies no próximo commit de Fase 0

---

### 3.4 🔴 Sem validação de `evaluator_id` autorizado

**Problema:** RLS não valida se `evaluator_id` é realmente professor/coordenador da área  
**Impacto:** Um utilizador pode registar avaliação como se fosse um professor diferente  
**Fix:** Trigger ou RLS enhanced (Fase 3)

---

### 3.5 ⚠️ Sem integração entre `evaluations` e `intern_evaluations`

**Problema:** São dois schemas desconectados; sem FK linking  
**Impacto:** Painel precisará fazer queries separadas (performance + complexidade)  
**Fix:** Decidir se manter separados com view unificada ou fazer FK (Fase 1)

---

### 3.6 ⚠️ RLS foca em `area_id` mas não em `training_area_id`

**Problema:** Tabela `evaluations` usa `area_id` mas funcionalidade académica usa `training_area_id`  
**Impacto:** Mismatch entre entidades; confusão no escopo  
**Fix:** Normalizar nomenclatura em Fase 1

---

## 4. PLANO DE EXECUÇÃO FASE 0

### 4.1 Fix Crítico #1: TEACHER no menu (30 min)

```jsx
// src/components/AppShell.jsx, linha ~104
if (isTeacherUser) {
  return [
    { to: "/home", icon: "public", label: "Comunidade" },
    { to: "/", icon: "dashboard", label: t("nav.dashboard") },
    { to: "/avaliacoes", icon: "grading", label: t("nav.evaluations") }, // ← ADICIONAR
    { to: "/rbac/vagas", icon: "work", label: "Vagas RBAC" },
    // ... resto
  ];
}
```

**Validação:**
- [ ] TEACHER consegue ver `/avaliacoes` no menu
- [ ] Clica e acessa página (sem erro 404)
- [ ] Retorna lista vazia ou suas avaliações (conforme lógica da página)

---

### 4.2 Fix Crítico #2: Schema `evaluations` expandido (1.5h)

**SQL Migration:**
```sql
-- Backup (copiar dados antigos para evaluations_v0)
CREATE TABLE public.evaluations_v0 AS SELECT * FROM public.evaluations;

-- Drop RLS temporariamente
ALTER TABLE public.evaluations DISABLE ROW LEVEL SECURITY;

-- Adicionar colunas novas
ALTER TABLE public.evaluations
  ADD COLUMN evaluation_type VARCHAR(20) NOT NULL DEFAULT 'INDIVIDUAL' CHECK (evaluation_type IN ('INDIVIDUAL', 'GROUP')),
  ADD COLUMN student_id UUID,
  ADD COLUMN evaluator_id UUID NOT NULL,
  ADD COLUMN evaluation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN subject VARCHAR(255),
  ADD COLUMN score DECIMAL(5,2) CHECK (score >= 0 AND score <= 20),
  ADD COLUMN feedback TEXT,
  ADD COLUMN is_final BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN group_evaluation_id UUID,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  RENAME COLUMN area_id TO training_area_id;

-- FKs (se tabelas existirem)
ALTER TABLE public.evaluations
  ADD CONSTRAINT fk_evaluations_student FOREIGN KEY (student_id) REFERENCES public.students(id),
  ADD CONSTRAINT fk_evaluations_evaluator FOREIGN KEY (evaluator_id) REFERENCES public.students(id),
  ADD CONSTRAINT fk_evaluations_group FOREIGN KEY (group_evaluation_id) REFERENCES public.evaluations(id);

-- Indices
CREATE INDEX idx_evaluations_student_date ON public.evaluations(student_id, evaluation_date DESC);
CREATE INDEX idx_evaluations_type_area ON public.evaluations(evaluation_type, training_area_id);
CREATE INDEX idx_evaluations_evaluator ON public.evaluations(evaluator_id);
CREATE INDEX idx_evaluations_group ON public.evaluations(group_evaluation_id);

-- Re-enable RLS
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
```

**Validação:**
- [ ] Schema aplicado sem erros
- [ ] Tabela antiga copiada para v0
- [ ] Nova estrutura está acessível via Supabase JS
- [ ] Tests de evaluationService.js passam

---

### 4.3 Fix Crítico #3: RLS completa com UPDATE/DELETE (1h)

**SQL:**
```sql
-- UPDATE policy
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

-- DELETE policy
DROP POLICY IF EXISTS "evaluations_delete_scoped" ON public.evaluations;
CREATE POLICY "evaluations_delete_scoped" ON public.evaluations
FOR DELETE
TO authenticated
USING (
  (
    public.current_app_role() IN ('SUPER_ADMIN', 'ADMIN_1')
    OR public.has_cross_area_scope()
  )
  OR created_by = auth.uid()
);
```

**Validação:**
- [ ] UPDATE só funciona se `created_by = auth.uid()` ou admin
- [ ] DELETE só funciona se admin ou criador
- [ ] Tentativa de UPDATE/DELETE por outro user retorna 403

---

### 4.4 Validation & Tests (1h)

**Checklist Pós-Fase 0:**
- [ ] TEACHER consegue navegar para `/avaliacoes`
- [ ] Tabela `evaluations` expandida com novos campos
- [ ] RLS completa (SELECT, INSERT, UPDATE, DELETE)
- [ ] Tests em `app.routes.test.jsx` passam (incluindo TEACHER)
- [ ] Tests de accessControl.js validam permissões de novo schema
- [ ] Build completa sem erros

**Comandos:**
```bash
npm run test -- app.routes.test.jsx
npm run test -- accessControl.test.js
npm run build
```

---

## 5. PRÓXIMOS PASSOS (Fase 1)

**Após Fase 0 aprovada:**
1. Criar `EvaluationsPanel.aggregated` — view unificado de evaluations + intern_evaluations
2. Expandir `evaluationService.js` com queries complexas (filtros, agregações, export por perfil)
3. Criar `EvaluationsDashboardPage.jsx` — novo painel multi-view por perfil
4. Integrar tests de RBAC por perfil × ação

---

## 6. DECISÕES ARQUITETURAIS CONGELADAS PARA ESTA ENTREGA

- ✅ Manter `evaluations` e `intern_evaluations` como tabelas separadas (unidas por view SQL em Fase 1)
- ✅ Normalizar nomenclatura para `training_area_id` em `evaluations`
- ✅ RLS será escopada por área + criador
- ✅ Auditoria via `created_by`, `updated_at` e eventual `evaluation_audits` (Fase 6)
- ✅ Sem coluna de `approval_status` nesta fase (adicionada em Fase 6)
- ✅ Export mantém formato CSV atual (expandido em Fase 8)

---

**Fase 0 Fim**
