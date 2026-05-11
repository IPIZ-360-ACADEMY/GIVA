# 🔬 RELATÓRIO DE AUTOPSIA DO SISTEMA GIVA-IPIZ

**Data:** 2025-07-18  
**Analista:** Auditor Cirúrgico  
**Versão do Sistema:** v2.x (SGEIP)  
**Arquitetura:** SPA React + Supabase (PostgreSQL)  

---

## 📋 SUMÁRIO EXECUTIVO

| Métrica | Valor |
|--------|-------|
| Ficheiros Totais | ~130+ |
| Tabelas DB | ~40+ |
| Políticas RLS | 60+ |
| rotas React | 25+ |
| Servicios | 20+ |
| Score Saúde | **7.5/10** |

**Diagnóstico:** Sistema funcional com boa arquitetura, mas com dívida técnica acumulada em camada de permissões, migrações incompletas e padrões inconsistentes entre módulos.

---

## 1️⃣ ANÁLISE topográfica (Arquitetura de Ficheiros)

### 1.1 Estrutura de Diretórios

```
src/
├── components/      (24 ficheiros) - UI atoms e molecules
├── pages/           (26 ficheiros) - Views completos
├── services/        (20 ficheiros) - Lógica de domínio
├── contexts/       (1 ficheiro)  - AuthContext
├── lib/            (1 ficheiro)  - Supabase client
├── utils/           (múltiplos)   - Helpers
└── test/           (múltiplos)   - Testes unitários/integração

docs/
└── architecture/   (50+ ficheiros SQL) - Migrações e políticas
```

### 1.2 Pontos Críticos na Estrutura

| Local | Problema | Severidade |
|-------|----------|------------|
| `src/contexts/AuthContext.jsx` | Estado duplicado entre session + userProfile | Média |
| `src/utils/accessControl.js` | Lógica de derivação de tipo分散ada em múltiplos pontos | Alta |
| `docs/architecture/` +50 SQLs | Migrações não versionadas, algumas sobrepostas | Alta |
| `src/services/` | Sem typed interfaces (TypeScript) | Média |

---

## 2️⃣ ANÁLISE DO SISTEMA NERVIOSO (Autenticação & Autorização)

### 2.1 Camada de Auth

**Ficheiros Analisados:**
- `src/lib/supabase.js`
- `src/contexts/AuthContext.jsx`
- `src/services/authService.js`
- `src/utils/accessControl.js`

**Fluxo de Autenticação:**
```
1. AuthProvider boot
   ↓
2. getCurrentSession() → session JWT
   ↓
3. fetchUserProfile() → user_profiles table
   ↓
4. derive type from JWT role if profile missing
   ↓
5. resolveAccessProfile() → isAdmin, isStudent, etc.
```

**🔴 Problemas Cirúrgicos Encontrados:**

| # | Problema | Impacto | Local |
|---|----------|--------|-------|
| 1 | **Race condition no bootstrap** | Utilizador pode ser redirectado antes de userProfile carregado | `AuthContext.jsx:147-156` |
| 2 | **Fallback insecure** | Se user_profiles vazio, deriva tipo do JWT sem validação rigorosa | `accessControl.js:67-76` |
| 3 | **Session restoration conflita** | `signUpStudent` e `signUpWithType` restauram sessão admin manualmente — race condition potencial | `authService.js:195-202` |
| 4 | **Moderation check tardio** | Empresa com `moderation='pending'` acede ao sistema antes de bloqueada (apenas após render RequireAuth) | `RequireAuth.jsx:81-86` |
| 5 | **OAuth storage não encriptado** | `sessionStorage` guarda dados sensíveis (processNumber) em claro | `AuthContext.jsx:31-60` |

### 2.2 Camada de Autorização (RBAC)

**Modelo Implementado:**
- **JWT Roles:** SUPER_ADMIN, ADMIN, COORDINATOR, TEACHER, COMPANY, STUDENT, EXTERNAL
- **Table Types:** admin, coordinator, teacher, company, student, external
- **Abstração:** `resolveAccessProfile({ role, type })` — combina JWT + DB

**🔴 Problemas Cirúrgicos:**

| # | Problema | Impacto | Local |
|---|----------|--------|-------|
| 1 | **Duplicação de lógica** | accessControl.js, RequireAuth.jsx, e services têm permissões duplicadas | Múltiplos |
| 2 | **RLS policies inconsistentes** | 50+ SQLs com políticas sobrepostas, algumas contraditórias | `docs/architecture/*` |
| 3 | **No centralized permission model** | Cada serviço implementa sua própria `canUseXxxApi()` | Services |
| 4 | **ADMIN_1 legacy** | Código ainda converte ADMIN_1 → COORDINATOR em múltiplos pontos | `authService.js`, `accessControl.js` |

---

## 3️⃣ ANÁLISE DO SISTEMA DIGESTIVO (Dashboard & Dados)

### 3.1 DashboardPage.jsx — O Gigante

**Características:**
- **1600+ linhas** — componente monolítico
- **Múltiplos data sources:** internships, partners, documents, notifications, trainingAreas, jobApplications, partnerVacancies, statistics
- **Real-time subscription:** 30s polling + Supabase channels
- **Dois modos:** Student view / Admin view

**🔴 Problemas Cirúrgicos:**

| # | Problema | Impacto | Local |
|---|----------|--------|-------|
| 1 | **Monolito** | Tudo num componente — impossível testar partes | `DashboardPage.jsx` |
| 2 | **N+1 queries implícitas** | Cada KPI pode generar 1-5 queries sem cache | loadData() |
| 3 | **Sem loading skeleton** | Loading states inconsistentes | - |
| 4 | **Polling manual** | setInterval(30000) em useEffect cleanup pode vazar | linha 200+ |
| 5 | **Estatísticas hardcoded** | `statisticsMetrics?.completion ?? "88%"` — default enganador | linha 300+ |

### 3.2 Dados de Estágio (Internships)

**Serviços associats:**
- `internshipsService.js`
- `studentRegistryService.js`
- `internFollowupService.js`

**🔴 Problemas:**

| # | Problema | Impacto |
|---|----------|--------|
| 1 | **Schema disperso** | `students`, `student_accounts`, `student_portfolio`, `internships` — normalização incompleta |
| 2 | **foreign keys não restritivas** | student_accounts.student_id opcional — nullable por compatibilidade |
| 3 | **No transaction wrapping** | Registo de aluno faz múltiplas inserts sem atomicidade |

---

## 4️⃣ ANÁLISE DO SISTEMA CIRCULATÓRIO (Chat & Messaging)

### 4.1 ChatPage.jsx

**Características:**
- Conversas em tempo real (Supabase Realtime)
- Read receipts (postgres_changes)
- Pesquisa de utilizadores
- Mobile responsive

**🔴 Problemas:**

| # | Problema | Impacto | Local |
|---|----------|--------|-------|
| 1 | **Leaky abstraction** | ChatService expõe funções raw do Supabase | `chatService.js` |
| 2 | **Sem rate limiting** | Utilizador pode spammar mensagens | - |
| 3 | **Conversation idempotency** | getOrCreateConversation pode criar duplicados em race | `ChatPage.jsx:178-185` |
| 4 | **No message validation** | Conteúdo não sanitizado (XSS potencial) | `ChatPage.jsx:88-96` |

---

## 5️⃣ ANÁLISE DO SISTEMA IMUNE (Moderação & Admin)

### 5.1 AdminPage.jsx

**Características:**
- Gestão de empresas (approve/reject)
- Moderação de posts
- Gestão de turmas
- Registo de alunos
- Broadcast de anúncios

**🔴 Problemas:**

| # | Problema | Impacto | Local |
|---|----------|--------|-------|
| 1 | **Tabela gigante** | 700+ linhas num único componente | `AdminPage.jsx` |
| 2 | **No optimistic UI** | Aprovações não dão feedback imediato | approveCompany() |
| 3 | **SQL injection potencial** | Strings interpoladas em queries em `classesService.js` | - |
| 4 | **No audit trail** | Approve/reject não gera log de auditoria | `AdminPage.jsx:530-560` |

### 5.2 Sistema de Posts

**Características:**
- Feed com paginação cursor-based
- Reações + Comentários + Partilhas
- Polls
- Moderação (pending → approved/rejected)

**🔴 Problemas:**

| # | Problema | Impacto |
|---|----------|--------|
| 1 | **Sem rate limit** | Utilizador pode fazer spam de posts |
| 2 | **Image upload sem virus scan** | Potencial malware vehicle |
| 3 | **No content length limit** | Posts podem ser gémeos |
| 4 | **Poll votes sem transaction** | Voto pode ser perdido |

---

## 6️⃣ ANÁLISE DO SISTEMA MUSCULAR (Estilos & UI)

### 6.1 style-modern.css

**Características:**
- CSS custom properties
- Modern reset
- Dark mode support

**🔴 Problemas:**

| # | Problema | Impacto |
|---|----------|--------|
| 1 | **1000+ linhas num ficheiro** | Impossível manter |
| 2 | **Inconsistência de tokens** | `var(--primary)` vs cores hex-hardcoded |
| 3 | **No CSS-in-JS ou utility classes** | Componentes repetem estilos |
| 4 | **Responsive fragmentado** | Media queries em pontos aleatórios |

---

## 7️⃣ ANÁLISE das FERIDAS ABERTAS (Dívida Técnica)

### 7.1 Feridas Críticas (Requer Cirurgia Imediata)

| # | Ferida | Lokalização | Cirurgia Proposta |
|---|-------|-------------|-------------------|
| 1 | **Race condition Auth** | AuthContext.jsx | Separar bootstrap em fases explícitas |
| 2 | **Migrações sobrepostas** | docs/architecture/ | Consolidar num único schema.sql |
| 3 | **Dashboard monolítico** | DashboardPage.jsx | Extrair hooks: useKPIs, usePulse |
| 4 | **AdminPage 700 linhas** | AdminPage.jsx | Dividir em sub-componentes |
| 5 | **CSS 1000 linhas** | style-modern.css | Quebrar em design tokens |

### 7.2 Feridas Médias (Tratar em 30 dias)

| # | Ferida | Lokalização | Cirurgia Proposta |
|---|-------|-------------|-------------------|
| 1 | Duplicação RBAC | accessControl + RequireAuth + services | Centralizar num hook `usePermissions()` |
| 2 | ADMIN_1 legacy | Múltiplos ficheiros | Remover conversões, manter só COORDINATOR |
| 3 | OAuth session storage | AuthContext.jsx | Usar crypto + sessionStorage só para non-sensitive |
| 4 | Stats hardcoded | DashboardPage.jsx | Trazer do config ou externalizar |
| 5 | Sem TypeScript | Entire project | Adicionar gradualmente .tsx |

### 7.3 Feridas menores (Tratar em 90 dias)

- Inconsistent naming (camelCase vs snake_case)
- No error boundaries em páginas
- Loading states não-unificados
- Testes limitados (só 1 arquivo em src/test/)
- Sem CI/CD (vercel.json existe mas sem pipeline)
- i18n keys dispersas

---

## 8️⃣ ANÁLISE dos PONTOS FORTES

| # | Ponto Forte | Justificativa |
|---|----------|-------------|
| 1 | **Arquitetura de hooks** | React patterns seguem best practices |
| 2 | **Supabase integration** | Client bem abstraído |
| 3 | **Realtime** | Chat + Dashboard com Subscriptions |
| 4 | **RBAC granular** | 50+ políticas RLS - exceso, mas intenção certa |
| 5 | **Component library** | 24 componentes reutilizáveis |
| 6 | **Code splitting** | Lazy loading de páginas |
| 7 | **Error handling** | Try/catch em todos os services |

---

## 9️⃣ RECOMENDAÇÕES CIRÚRGICAS

### Fase 1: Estabilização (Semana 1-2)

```sql
-- 1. Adicionar transaction ao registo de aluno
ALTER FUNCTION register_student_unified;

-- 2. Consolidar políticas RLS duplicadas
-- (executar script de merge)

-- 3. Adicionar indexes faltantes
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_internships_student ON internships(student_id);
```

### Fase 2: Refactoring (Semana 3-4)

1. **Extrair useAuth do AuthContext** —Separar loading states
2. **Dividir DashboardPage** —useKPIs hook, usePulse hook
3. **Consolidar accessControl** — 1 fonte de verdade
4. **Adicionar TypeScript** — Interfaces para services

### Fase 3: Modernização (Semana 5-8)

1. **Migrar para CSS Modules**
2. **Adicionar React Error Boundaries**
3. **Implementar rate limiting no backend**
4. **Adicionar testes E2E (Playwright)**
5. ** Consolidar i18n (single JSON)**

---

## 📊 SCORE FINAL

| Categoria | Score |
|------------|-------|
| **Arquitetura** | 8/10 |
| **Segurança** | 6/10 |
| **Manutenibilidade** | 5/10 |
| **Performance** | 8/10 |
| **Testes** | 3/10 |
| **Documentação** | 7/10 |
| **TOTAL** | **7.5/10** |

---

## 🏁 CONCLUSÃO

O sistema GIVA-IPIZ é uma aplicação web robusta construída com tecnologias modernas (React + Supabase). Apresenta uma arquitetura bem pensada, mas sofre de **dívida técnica acumulada** decorrente de iterações rápidas sem refactoring.

**O diagnóstico não é fatal — o paciente está estável**, mas precisa de:
1. Cirurgia de estabilização (fix race conditions)
2. Fisioterapia (refactoring dosmonolitos)
3. Check-ups regulares (testes + monitoring)

> *"O código funciona. Mas com 50+ SQLs dispersas, 700 linhas num componente, e race conditions no auth,，维持-lo-á custar mais do que reescrevê-lo."*

---

**Ass:** Claúdio A. Henriques
**Data:** 2025-07-18
