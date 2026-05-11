# ⏳ HANDOFF: Fase 1 Pronta para Execução

**Data:** 11 de maio de 2026 11:15 UTC  
**Status:** ✅ Fase 0 Completa | ⏳ Fase 1 Pronta para Iniciar  
**Duração Estimada Fase 1:** 6-8h (pode ser feita hoje ou amanhã)

---

## 🎯 O QUE FAZER AGORA

### PASSO 1: Executar Migrations SQL no Supabase (15-20 min)

**Local:** Supabase Dashboard → SQL Editor → Novo Query

**Arquivo 1:** Copiar conteúdo de `/docs/architecture/MIGRATION_EVALUATIONS_V2_PHASE0.sql`
- Expande tabela `evaluations` com campos: `evaluation_type`, `student_id`, `evaluator_id`, `evaluation_date`, `subject`, `score` (0-20), `feedback`, `is_final`, `group_evaluation_id`, `updated_at`, `training_area_id`
- Cria trigger para atualizar `updated_at` automaticamente
- Reabilita RLS com policies completas
- **Tempo:** ~10 min

**Validação pós Arquivo 1:**
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name='evaluations' 
ORDER BY ordinal_position;
-- Deve listar 17 colunas (verificar se `student_id`, `score`, `is_final` existem)
```

**Arquivo 2:** Copiar conteúdo de `/docs/architecture/EVALUATIONS_RLS_POLICIES_COMPLETE.sql`
- Adiciona UPDATE policy (só criador ou admin edita)
- Adiciona DELETE policy (admin ou criador deleta)
- **Tempo:** ~5 min

**Validação pós Arquivo 2:**
```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename='evaluations';
-- Deve listar 5 policies: select_scoped, insert_scoped, update_scoped, delete_scoped
```

---

### PASSO 2: Executar View SQL no Supabase (10-15 min)

**Arquivo 3:** Copiar conteúdo de `/docs/architecture/EVALUATIONS_UNIFIED_VIEW.sql`
- Cria view `evaluations_unified` que consolida `evaluations` + `intern_evaluations`
- Normaliza scores: académica 0-20 → 0-5, estágio já 0-5
- Adiciona campos descritivos (context_type, source_type, etc.)
- **Tempo:** ~10 min

**Validação pós Arquivo 3:**
```sql
SELECT COUNT(*) FROM evaluations_unified;
-- Deve retornar total de avaliações de ambas as tabelas

SELECT DISTINCT context_type FROM evaluations_unified;
-- Deve retornar: ACADEMIC, INTERNSHIP (ou vazio se sem dados)
```

---

### PASSO 3: Executar RPC de Analytics no Supabase (10-15 min)

**Arquivo 4:** Copiar conteúdo de `/docs/architecture/EVALUATIONS_STATS_RPC.sql`
- Cria 5 funções de RPC:
  1. `calc_evaluation_stats()` — métricas agregadas
  2. `get_evaluation_distribution()` — distribuição de scores
  3. `compare_evaluators()` — consistência entre avaliadores
  4. `get_evaluation_trends()` — evolução temporal
  5. `get_student_evaluation_ranking()` — ranking por performance
- **Tempo:** ~15 min

**Validação pós Arquivo 4:**
```sql
-- Teste 1
SELECT * FROM public.calc_evaluation_stats(NULL, 'ACADEMIC');

-- Teste 2
SELECT * FROM public.get_evaluation_distribution(NULL, 'ACADEMIC');
-- Se retornar sem erro = OK
```

---

### PASSO 4: Integrar JS no evaluationService.js (2-3h)

**Arquivo:** `src/services/evaluationService.js`

**Adicionar 5 novas funções** (copiar do `PHASE_1_CONTRACT_SPECIFICATION.md`):

```javascript
1. getEvaluationsUnified(filters)
   - Query a view com suporte a filtros: studentId, trainingAreaId, contextType, dateRange
   - Retorna array normalizado

2. getEvaluationStats(trainingAreaId, contextType)
   - Chama RPC calc_evaluation_stats
   - Retorna: total, avg, min, max, median, std_dev, final_count, draft_count

3. getEvaluationDistribution(trainingAreaId, contextType)
   - Chama RPC get_evaluation_distribution
   - Retorna buckets de distribuição para gráficos

4. exportEvaluationsReportByProfile(profileRole, filters)
   - Exporta colunas governadas por role
   - SUPER_ADMIN: todas; STUDENT: apenas suas

5. getEvaluationCountByContext(trainingAreaId)
   - Retorna contagem académica vs estágio
```

**Localização no arquivo:**
- Adicionar após `getStudentAverageGrade()` (linha ~120)

**Tempo:** ~2-3h (depende de familiaridade com código)

---

### PASSO 5: Criar Testes de Validação (1-1.5h)

**Arquivo:** `src/test/evaluations.unified.test.jsx` (novo)

**3 testes mínimos:**
```javascript
1. "retorna avaliações unificadas com joins"
   - Valida que getEvaluationsUnified() retorna array com context_type

2. "exporta com colunas governadas por perfil STUDENT"
   - Valida que export STUDENT não inclui evaluator_name

3. "retorna contagem por contexto"
   - Valida que getEvaluationCountByContext() retorna { academic, internship }
```

**Execução:**
```bash
npm test -- evaluations.unified.test.jsx
# Deve passar 3/3
```

**Tempo:** ~1-1.5h

---

### PASSO 6: Build e Validação Final (30 min)

```bash
# Build produção
npm run build
# Deve terminar com "✓ built in Xs" sem erros

# Rodar testes gerais
npm test
# Tudo deve passar
```

**Tempo:** ~30 min

---

### PASSO 7: Commit Fase 1 (10 min)

```bash
git add \
  docs/PHASE_1_CONTRACT_SPECIFICATION.md \
  docs/architecture/EVALUATIONS_UNIFIED_VIEW.sql \
  docs/architecture/EVALUATIONS_STATS_RPC.sql \
  src/services/evaluationService.js \
  src/test/evaluations.unified.test.jsx

git commit -m "Fase 1: Contrato de domínio unificado de avaliações

IMPLEMENTADO:
✅ View SQL evaluations_unified consolida académicas + estágio
✅ 5 RPC de analytics (stats, distribution, trends, comparativos)
✅ evaluationService.js expandido com 5 novas funções
✅ Testes de validação de contrato (3 cenários)
✅ Export governado por role

VALIDAÇÕES:
✓ SQL executa sem erros (Supabase)
✓ Views/RPC testadas manualmente
✓ JS integrado e testado
✓ Build prod sem warnings

PRÓXIMOS PASSOS (Fase 2):
1. Formalizar matriz de RBAC/visibilidade por perfil
2. Implementar middlewares de autorização frontend
3. Testes de acesso por perfil × ação"
```

---

## ⏱️ TIMELINE ESTIMADO

| Tarefa | Duração | Acumulado |
|--------|---------|-----------|
| PASSO 1-2: SQL migrations | 20-30 min | 20-30 min |
| PASSO 3: View + RPC | 20-30 min | 50 min |
| PASSO 4: JS integração | 2-3h | 3-3.5h |
| PASSO 5: Testes | 1-1.5h | 4-5h |
| PASSO 6: Build + validação | 30 min | 4.5-5.5h |
| PASSO 7: Commit | 10 min | 4.5-6h |
| **TOTAL** | | **~5-6h** |

---

## ⚠️ PONTOS DE ATENÇÃO

1. **SQL Migrations:** Executar em ordem (Arquivo 1 → 2 → 3 → 4)
2. **Backup:** Tabela backup `evaluations_v0` é criada automaticamente
3. **RLS:** Policies são copiadas corretamente; testar acesso por user diferente
4. **JS:** Usar `supabase.rpc()` para chamar funções RPC
5. **Testes:** Mock de dados pode ser necessário se Supabase vazio

---

## 📞 TROUBLESHOOTING RÁPIDO

| Problema | Solução |
|----------|---------|
| SQL erro "permission denied" | Usar account admin do Supabase |
| RPC retorna vazio | Validar se tabelas `evaluations` ou `intern_evaluations` têm dados |
| JS erro "function not found" | Verificar se RPC foi criada (SELECT proname FROM pg_proc WHERE proname LIKE 'calc%') |
| Build falha | Rodar `npm clean-install` e tentar novamente |
| Testes falham | Validar mocks de data em evaluations.unified.test.jsx |

---

## ✅ CHECKLIST PRÉ-FASE 2

- [ ] 4 arquivos SQL executados com sucesso no Supabase
- [ ] View `evaluations_unified` retorna dados consolidados
- [ ] 5 RPC de analytics criadas
- [ ] `evaluationService.js` expandido com 5 funções novas
- [ ] 3 testes de contrato passam
- [ ] Build prod sem erros
- [ ] Commit Fase 1 registrado no git
- [ ] Revisão de código OK (se aplicável)

---

## 🎯 PRÓXIMAS FASES (Apenas Contexto)

**Fase 2 (Dia após conclusão Fase 1):** RBAC matriz formal  
**Fase 3:** Hardening segurança  
**Fase 4:** UI multi-visão  
**Fase 5+:** UX, workflow, analytics, testes, rollout

---

**Fim Handoff Fase 1**
