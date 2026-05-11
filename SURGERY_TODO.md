# 🩺 TODO — CIRURGIA PROFUNDA E COMPLETA AO SISTEMA GIVA-IPIZ

> **Objetivo:** Remover o desnecessário, redundante e não funcional  
> **Prioridade:** Alta — Dívida Técnica Crítica  
> **Estimativa:** 8-12 semanas (part-time)

---

## ⚠️ AVISO PRÉ-CIRURGIA

**FAÇA BACKUP ANTES DE CADA FASE!**

```bash
# Backup completo antes de iniciar
cd e:/Projectos/ipiz/GIVA
git add -A
git commit -m "BACKUP: pré-cirurgia sistema"
git push origin main
```

---

## 📋 TODO: FASE 1 — ESTABILIZAÇÃO CRÍTICA (Semana 1-2)

### 1.1 🔴 CRÍTICO: Corrigir Race Condition no Auth

**Problema:** `AuthContext.jsx` pode redirectar utilizador antes de `userProfile` carregado, causando derivação errada de tipo.

**Ficheiros:** `src/contexts/AuthContext.jsx`, `src/utils/accessControl.js`

```jsx
// TODO em AuthContext.jsx:
// - [ ] Separar bootstrap em fases explícitas:
//   1️⃣ Carregar session (JWT)
//   2️⃣ Carregar userProfile (DB)
//   3️⃣ Apenas depois setLoading(false)
// - [ ] Remover sessionStorage para dados sensíveis (processNumber)
// - [ ] Adicionar loading state "phase" para debugging
```

- [ ] **1.1.1** Identificar e corrigir race condition em `bootstrap()` (linha ~140)
- [ ] **1.1.2** Adicionar `loadingPhase` state: `'idle' | 'session' | 'profile' | 'ready'`
- [ ] **1.1.3** Remover `processNumber` do `sessionStorage` ou usar `crypto` para guardar
- [ ] **1.1.4** Testar fluxo: login → redirect → acesso correto

### 1.2 🔴 CRÍTICO: Consolidar Migrações SQL Redundantes

**Problema:** 50+ ficheiros SQL em `docs/architecture/` com políticas sobrepostas.

**Estimativa:** ~15 ficheiros são redundantes ou contraditórios.

```sql
-- TODO em docs/architecture/:
-- - [ ] Listar todas as tabelas com RLS active
-- - [ ] Identificar políticas duplicadas por tabela
-- - [ ] Criar schema unificado: migrations/consolidado/
```

- [ ] **1.2.1** Executar script de auditoria RLS:
  ```sql
  SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
  FROM pg_policies 
  WHERE schemaname = 'public'
  ORDER BY tablename, policyname;
  ```
- [ ] **1.2.2** Mapear cada tabela → políticas existentes
- [ ] **1.2.3** Identificar duplicações (ex: `user_profiles` tem 4+ políticas de INSERT?)
- [ ] **1.2.4** Consolidar em `migrations/consolidado/01-rls-unified.sql`
- [ ] **1.2.5** Arquivar ficheiros antigos em `migrations/legacy/`

### 1.3 🔴 CRÍTICO: Remover Conversões ADMIN_1 Legadas

**Problema:** Código converte `ADMIN_1` → `COORDINATOR` em 3+ locais.

**Ficheiros:** `authService.js`, `accessControl.js`

- [ ] **1.3.1** Executar busca global: `grep -r "ADMIN_1" src/`
- [ ] **1.3.2** Documentar todos os pontos de conversão
- [ ] **1.3.3** Padronizar: COORDINATOR apenas (remover ADMIN_1)
- [ ] **1.3.4** Se DB tem ADMIN_1, criar migração para migrar para COORDINATOR

---

## 📋 TODO: FASE 2 — REFACTORING DOS MONOLITOS (Semana 3-4)

### 2.1 🟡 ALTA: Dividir DashboardPage Monolítico

**Problema:** 1600+ linhas num componente — impossível testar/manter.

**Objetivo:** Extrair ~10 hooks menores.

```jsx
// TODO: Novo estrutura DashboardPage/
// ├── useDashboardKPIs()      → kpis calculation
// ├── useOperationalPulse()    → real-time sync
// ├── useInternshipStats()      → aggregation
// ├── useDistribution()        → distribution builders
// └── useDashboardFilters()      → query/state
```

- [ ] **2.1.1** Criar pasta `src/hooks/dashboard/`
- [ ] **2.1.2** Extrair `useKPIs()` — retornando `kpis`, `comparativeKpis`, loading
- [ ] **2.1.3** Extrair `useOperationalPulse()` �� polling + subscriptions
- [ ] **2.1.4** Extrair `useDistribution()` — area/course/class builders
- [ ] **2.1.5** Extrair `useInternshipStats()` — filtering + aggregation
- [ ] **2.1.6** Refatorar DashboardPage para usar hooks
- [ ] **2.1.7** Verificar que testes existentes ainda passam

### 2.2 🟡 ALTA: Dividir AdminPage Monolítico

**Problema:** 700+ linhas num único componente.

**Objetivo:** Criar sub-componentes por feature.

```jsx
// TODO: Novo estrutura AdminPage/
// ├── components/
// │   ├── CompanyApprovalPanel.jsx
// │   ├── PostModerationPanel.jsx
// │   ├── UserManagementPanel.jsx
// │   ├── StudentRegisterPanel.jsx
// │   ├── ClassesPanel.jsx
// │   └── AnnouncementPanel.jsx
// └── hooks/
//     └── useAdminStats.js
```

- [ ] **2.2.1** Criar pasta `src/components/admin/`
- [ ] **2.2.2** Extrair `CompanyApprovalPanel` — approve/reject logic
- [ ] **2.2.3** Extrair `PostModerationPanel` — moderate logic
- [ ] **2.2.4** Extrair `UserManagementPanel` — user list + edit
- [ ] **2.2.5** Extrair `StudentRegisterPanel` — registration form
- [ ] **2.2.6** Extrair `ClassesPanel` — classes CRUD
- [ ] **2.2.7** Extrair `AnnouncementPanel` — broadcast
- [ ] **2.2.8** Refatorar AdminPage para composition

### 2.3 🟡 ALTA: Centralizar Autorização (RBAC)

**Problema:** Lógica de permissões duplicada em 3+ locais.

**Objetivo:** 1 fonte de verdade.

```jsx
// TODO: Novo src/contexts/PermissionsContext.jsx
// - usePermissions() → {
//   can: {
//     viewAll: ...,
//     manageUsers: ...,
//     moderateContent: ...,
//     registerStudent: ...,
//   },
//   roles: [...],
// }
```

- [ ] **2.3.1** Criar `src/contexts/PermissionsContext.jsx`
- [ ] **2.3.2** Implementar `resolvePermissions(role, type)` centralizado
- [ ] **2.3.3** Migrar `RequireAuth.jsx` para usar PermissionsContext
- [ ] **2.3.4** Migrar todos os `canUseXxxApi()` para permissions
- [ ] **2.3.5** Remover duplicações em `accessControl.js`

---

## 📋 TODO: FASE 3 — LIMPEZA DE DESPERDÍCIOS (Semana 5-6)

### 3.1 🟡 MÉDIA: Remover Código Morto

**Problema:** Funções/chamadas nunca utilizadas.

**Comandos de diagnóstico:**
```bash
# Encontrar funções não exportadas
grep -r "function\|const.*=" src/utils/ --include="*.js" | head -50

# Encontrar imports não usados (ESLint)
npx eslint --no-eslintrc --ext .js,.jsx src --rule "no-unused-vars: warn" 2>/dev/null || echo "ESLint não configurado"
```

- [ ] **3.1.1** Executar busca por funções não exportadas
- [ ] **3.1.2** Identificar utilitários órfãos
- [ ] **3.1.3** Remover functions semusage em `src/utils/`
- [ ] **3.1.4** Verificar componentes não renders em `src/components/`
- [ ] **3.1.5** Remover pages não utilizadas em App.jsx

### 3.2 🟡 MÉDIA: Limpar ficheiros CSS Duplicados

**Problema:** Múltiplos ficheiros de estilo com regras sobrepostas.

**Lista atual:**
- `style-modern.css` (principal)
- `style-dark-mode-overrides.css`
- possibly: `tailwind.css` ou legado

```css
/* TODO: Consolidar em style tokens */
:root {
  --color-primary: #3b82f6;
  --color-accent: #8b5cf6;
  /* ... */
}
```

- [ ] **3.2.1** Consolidar todos os tokens em `style-tokens.css`
- [ ] **3.2.2** Migrar `style-modern.css` para usar tokens
- [ ] **3.2.3** Remover overrides redundantes
- [ ] **3.2.4** Eliminar se `style-dark-mode-overrides.css` só tem `!important`

### 3.3 🟢 BAIXA: Limpar rotas legadas

**Problema:** Redirects para rotas antigas em `App.jsx`.

```jsx
// LEGACY_PATH_REDIRECTS — quantos ainda são usados?
// /est.html → /estagios
// /turmas.html → /turmas
// etc.
```

- [ ] **3.3.1** Analisar Google Analytics para rotas legadas
- [ ] **3.3.2** Manter apenas redirect com traffic > 0
- [ ] **3.3.3** Documentar rotas deprecated para possível remoção futura

---

## 📋 TODO: FASE 4 — MODERNIZAÇÃO (Semana 7-8)

### 4.1 🟢 BAIXA: Adicionar TypeScript Progressivo

**Problema:** Sem tipos — erros só aparecem em runtime.

**Estratégia:** Adicionar `.ts` gradualmente, começando por services.

```ts
// TODO: Novo src/services/authService.ts
// interface Session { user: User; ... }
// interface AuthProfile { role: string; ... }
// type UserRole = 'SUPER_ADMIN' | 'ADMIN' | ...
```

- [ ] **4.1.1** Criar tipos base em `src/types/index.ts`
- [ ] **4.1.2** Tipar `authService.js` → `authService.ts`
- [ ] **4.1.3** Tipar `supabase.js` → `supabase.ts`
- [ ] **4.1.4** Tipar serviços críticos (`postsService`, `internshipsService`)
- [ ] **4.1.5** Converter pagina a pagina para `.tsx`

### 4.2 🟢 BAIXA: Implementar Testes Unitários

**Problema:** Apenas 1 teste em `src/test/`.

**Objetivo:** 80% coverage em utilitários e hooks.

```bash
# Instalação
npm install -D vitest @testing-library/react @testing-library/user-event
```

- [ ] **4.2.1** Configurar Vitest
- [ ] **4.2.2** Testar `accessControl.js` (todas as funções)
- [ ] **4.2.3** Testar `processNumber.js` (validação)
- [ ] **4.2.4** Testar hooks extraídos em Fase 2
- [ ] **4.2.5** Testar componentes AdminPanel

### 4.3 🟢 BAIXA: Error Boundaries

**Problema:** Se crasha, mostra tela branca.

```jsx
// TODO: src/components/ErrorBoundary.jsx (existe)
// - [ ] Aplicar a cada Page em App.jsx
// - [ ] Adicionar fallback por rota
```

- [ ] **4.3.1** Verificar se ErrorBoundary já existe
- [ ] **4.3.2** Aplicar em torno de cada Suspense/Route
- [ ] **4.3.3** Adicionar UI de fallback por tipo de erro

---

## 📋 TODO: FASE 5 — OTIMIZAÇÃO FINAL (Semana 9-10)

### 5.1 🟢 BAIXA: Performance

- [ ] **5.1.1** Executar Lighthouse e documentar scores
- [ ] **5.1.2** Lazy load ChatPage (já tem, verificar)
- [ ] **5.1.3** Add `shouldComponentUpdate` ou React.memo em listas
- [ ] **5.1.4** Otimizar queries em DashboardPage

### 5.2 🟢 BAIXA: Segurança

- [ ] **5.2.1** Auditar todas as RPCs (security definer)
- [ ] **5.2.2** Remover credenciais de código (já ok com env vars)
- [ ] **5.2.3** Adicionar rate limiting no backend (se possível)

---

## ✅ CHECKLIST DE COMPLETEZA

| Fase | Tarefas | Completas |
|------|---------|-----------|
| 1 | Race Condition Auth | [ ] |
| 1 | Migrações SQL | [ ] |
| 1 | ADMIN_1 Legado | [ ] |
| 2 | Dashboard Monolito | [ ] |
| 2 | AdminPage Monolito | [ ] |
| 2 | RBAC Centralizado | [ ] |
| 3 | Código Morto | [ ] |
| 3 | CSS Duplicado | [ ] |
| 3 | Rotas Legadas | [ ] |
| 4 | TypeScript | [ ] |
| 4 | Testes | [ ] |
| 4 | Error Boundaries | [ ] |
| 5 | Performance | [ ] |
| 5 | Segurança | [ ] |
| **TOTAL** | **~30 tarefas** | **__/30** |

---

## 🚀 COMO EXECUTAR ESTE TODO

```bash
# 1. Backup!
git commit -a -m "BACKUP pré-cirurgia"

# 2. Executar Fase 1 (semanal)
# - Começar por 1.1 (crítico)
# - Testar manualmente após cada mudança

# 3. Fase 2 (refactoring)
# - Criar branch: git checkout -b refactor/dashboard-hooks
# - Mergiar após testes passarem

# 4. Cleanup (Fase 3)
# - Código morto: grep -r "never used" src/

# 5. Modernização (Fase 4)
# - TypeScript: npm install --save-dev typescript @types/react

# 6. Commit final
git commit -a -m "CIRURGIA: Sistema refactored e simplificado"
```

---

## ⚠️ ROLLBACK PLAN

Se algo correr mal:

```bash
# Вернути às último backup
git checkout HEAD~1 -- .

# Ou específico ficheiro
git checkout HEAD~1 -- src/contexts/AuthContext.jsx
```

---

## 📞 DEPENDÊNCIAS CRÍTICAS

| Dependência | Ação |
|------------|------|
| Supabase | Não modificar schema sem backup |
| Auth | Testar exhaustivamente após mudanças |
| Vercel | Verificar environment vars após deploy |

---

**Criado:** 2025-07-18  
**Por:** Auditor Cirúrgico  
**Versão:** 1.0
