# ANÁLISE CRÍTICA E PROFUNDA DO SISTEMA GIVA-IPIZ

## Sumário Executivo

Este documento apresenta uma análise técnica profunda de todo o sistema GIVA-IPIZ (Gestão de Inserção à Vida Ativa), identificando pontos críticos, vulnerabilidades, inconsistências architectureais e oportunidades de melhoria.

---

## 1. ANÁLISE DA ARQUITECTURA DO SISTEMA

### 1.1 Estrutura de Pastas

```
src/
├── components/       # Componentes reutilizáveis
├── contexts/      # React Context (AuthContext)
├── data/         # Dados estáticos
├── lib/          # Utilitários de baixo nível (Supabase)
├── pages/        # Páginas principais
├── services/     # Camada de serviços API
├── styles/       # CSS
├── test/        # Testes
└── utils/        # Funções utilitárias
```

### 1.2 Padrões Identificados

**POSITIVOS:**
- Lazy loading implementado em App.jsx (code splitting)
- Context API bem estruturado (AuthContext)
- Separação clara entre UI e lógica (services)
- Internacionalização (i18n) com fallback
- RBAC baseado em roles e tipos

**NEGATIVOS:**
- Mistura de responsabilidades em componentes grandes (ex: AdminPage.jsx ~900 linhas)
- Serviços sem tratamento consistente de erros
- Ausência de typed interfaces (TypeScript)
- Dados sensíveis em localStorage sem criptografia

---

## 2. ANÁLISE CRÍTICA POR FICHEIRO

### 2.1 src/lib/supabase.js

```javascript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isTestMode = import.meta.env.MODE === "test";

export const isSupabaseConfigured = !isTestMode && Boolean(supabaseUrl) && Boolean(supabaseAnonKey);
```

**PROBLEMAS IDENTIFICADOS:**
- ❌ Variáveis de ambiente não validadas
- ❌ Sem verificação de formato URL
- ❌ Sem fallback para ambiente de desenvolvimento
- ❌ Sem logging de configuração

```javascript
// RECOMENDAÇÃO:
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[supabase] Credenciais não configuradas - modo demo ativo");
}
if (supabaseUrl && !supabaseUrl.startsWith("https://")) {
  console.error("[supabase] URL inválida deve começar com https://");
}
```

### 2.2 src/contexts/AuthContext.jsx

```javascript
export function AuthProvider({ children }) {
  // ...
  const [loading, setLoading] = useState(true);
  const [loadingPhase, setLoadingPhase] = useState("idle");
  // ...
```

**PROBLEMAS IDENTIFICADOS:**
- ❌ Race conditions no carregamento de perfil
- ❌ Sem timeout para operações assíncronas
- ❌ sessionStorage usado para dados sensíveis (PENDING_STUDENT_OAUTH_STORAGE)
- ❌ Tratamento de erros inconsistente

**PONTOS CRÍTICOS:**

```javascript
// Linha 62: Timeout hardcoded de 30 minutos
const expired = Number.isFinite(createdAt) && createdAt > 0 && Date.now() - createdAt > 30 * 60 * 1000;
```

Este timeout deve ser configurável via variável de ambiente, não hardcoded.

### 2.3 src/utils/accessControl.js

```javascript
const KNOWN_ACCOUNT_TYPES = new Set(["student", "company", "admin", "external", "coordinator", "teacher"]);
const KNOWN_PLATFORM_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "ADMIN_1",
  "COORDINATOR",
  "TEACHER",
  "COMPANY",
  "STUDENT",
  "EXTERNAL",
  "authenticated",
]);
```

**PROBLEMAS IDENTIFICADOS:**
- ⚠️ ADMIN_1 como legado, mas ainda em uso
- ⚠️ Duplicação de lógica de normalização
- ⚠️Função `typeFromRole` pode derivar tipo incorretamente
- ❌sem logs de auditoria para negação de acesso

### 2.4 src/services/authService.js

```javascript
export async function signUpStudent(processNumber, password, displayName, studentDbId) {
  // Síntese de email interno
  const syntheticEmail = `aluno.${localPart}@${domain}`;
  
  // Restauração de sessão admin
  if (adminSession) {
    await supabase.auth.setSession({
      access_token: adminSession.access_token,
      refresh_token: adminSession.refresh_token,
    });
  }
}
```

**PROBLEMAS CRÍTICOS:**
1. ❌ **Injeção de email** - Email sintético pode conflito com domínio real
2. ❌ **Sessão restaurada sem validação** - Admin sessão restaurada sem verificar permissões
3. ❌ **Tratamento de erros inconsistente** - Coluna student_id tratados de forma diferente

```javascript
// LINHA 245-248: Tratamento de coluna não existente
const isMissingColumn = studentError?.message?.includes("column") && studentError?.message?.includes("student_id");
if (studentError && !isMissingColumn) return { data, error: studentError };
```

Este padrão deve ser um handler centralizado, não scattered.

### 2.5 src/pages/LoginPage.jsx

```javascript
const isProcessNumber = /^[A-Za-z]\d{1,4}A?$/.test(rawIdentifier);
const normalizedIdentifier = await resolveAuthLoginEmail(identifier);
```

**PROBLEMAS:**
- ❌ Regex pode não cobrir todos os formatos de processo
- ❌ Sem rate limiting
- ❌ Tentativas automáticas de registo sem notificação clara

### 2.6 src/pages/AdminPage.jsx

**MAIOR COMPONENTE DO SISTEMA (~900 linhas)**

```javascript
export function canAccessAdminPanel(role) {
  return String(role ?? "").toUpperCase() === "SUPER_ADMIN";
}
```

**PROBLEMAS CRÍTICOS:**
1. ❌ Função decheck duplicada (existe também em accessControl.js)
2. ❌ Múltiplas queries Supabase sem paginação
3. ❌ Sem proteção CSRF explícita
4. ❌ Operações sensíveis (approve/reject) sem verificação de estado anterior
5. ❌ Tentativas SQL diretas em useEffect (performance)

```javascript
// exemplo de query não otimizada (Linha ~380)
const [stats, setStats] = useState({ users: 0, companies: 0, posts: 0, pendingCompanies: 0, pendingPosts: 0 });

// 5 queries simultâneas - sem batch
const [/* ... */] = await Promise.all([
  supabase.from("user_profiles").select("*", { count: "exact", head: true }),
  supabase.from("user_profiles").select("*", { count: "exact", head: true }).eq("type", "company"),
  // ...
]);
```

### 2.7 src/pages/CompanyDashboardPage.jsx

**COMPONENTE CRÍTICO COM MÚLTIPLOS FLUXOS**

```javascript
// Batch processing sem proteção
async function handleBatchDecision(action) {
  for (const app of selectedPendingApps) {
    const ok = await acceptJobApplication(app.id, "Aprovada em ação em lote.");
    // Sem transação - se falhar no meio, sistema fica inconsistente
  }
}
```

**PROBLEMAS CRÍTICOS:**
1. ❌ Sem transação / Rollback
2. ❌ Sem verificação de estado antes de aceitar
3. ❌ audit logging incompleto
4. ❌ Sem verificação de disponibilidade de vaga

---

## 3. VULNERABILIDADES DE SEGURANÇA

### 3.1 Autenticação e Sessão

| # | Vulnerabilidade | Severidade | Ficheiro |
|---|----------------|-----------|---------|
| 1 | Sessão armazenada em sessionStorage sem criptografia | **CRÍTICA** | AuthContext.jsx |
| 2 | Restaurar sessão admin sem verificação | **ALTA** | authService.js |
| 3 | OAuth state não validado explicitamente | **ALTA** | LoginPage.jsx |
| 4 | Timeout de OAuth (30min) hardcoded | **MÉDIA** | AuthContext.jsx |

### 3.2 Autorização e Acesso

| # | Vulnerabilidade | Severidade | Ficheiro |
|---|----------------|-----------|---------|
| 1 | RBAC verificado no cliente apenas | **ALTA** | RequireAuth.jsx |
| 2 | Rota de admin não protegida server-side | **ALTA** | App.jsx |
| 3 | Perfis derivados automaticamente | **MÉDIA** | accessControl.js |
| 4 | Função de check duplicada | **BAIXA** | AdminPage.jsx |

### 3.3 Dados e Input

| # | Vulnerabilidade | Severidade | Ficheiro |
|---|----------------|-----------|---------|
| 1 | Input sanitization inconsistente | **ALTA** | InternshipsPage.jsx |
| 2 | Regex de validação fraca | **MÉDIA** | LoginPage.jsx |
| 3 | URLs de avatar permitidas sem validação | **MÉDIA** | InternshipsPage.jsx |
| 4 | Parsing JSON sem try/catch centralizado | **BAIXA** | Múltiplos |

### 3.4 Operações de Base de Dados

| # | Vulnerabilidade | Severidade | Ficheiro |
|---|----------------|-----------|---------|
| 1 | Batch sem transação | **CRÍTICA** | CompanyDashboard.jsx |
| 2 | Queries N+1 | **ALTA** | AdminPage.jsx |
| 3 | Sem paginação em listas | **ALTA** | AdminPage.jsx |
| 4 | Upserts sem conflict resolution clara | **MÉDIA** | authService.js |

---

## 4. INCONSISTÊNCIAS ARQUITECTURAIS

### 4.1 Duplicação de Código

1. **Função canAccessAdminPanel:**
   - src/pages/AdminPage.jsx (linha 17)
   - src/components/RequireAuth.jsx (usada indiretamente)

2. **Normalização deemail:**
   - src/utils/processNumber.js
   - src/services/authService.js (normalizeAuthIdentifier)

3. **Tratamento de erros Supabase:**
   - Cada serviço implementa seu próprio pattern

### 4.2 Estados de Erro Inconsistentes

```javascript
// Padrão 1:Retorna data null + error
return { data: null, error: new Error("...") };

// Padrão 2: Throws error
throw new Error("...");

// Padrão 3: Retorna tuple
const { data, error } = await supabase...
```

**IMPACTO:** Código cliente tem que tratar cada padrão diferentemente.

### 4.3 Gestión deEstado分部

| Serviço | Estado Inicial | Loading | Error Handling |
|---------|-------------|---------|------------|
| internshipsService | [] | booleano | throw |
| partnersService | null | booleano | throw |
| authService | null | booleano | return { data, error } |
| chatService | ? | ? | ? |

---

## 5. PERFORMANCE E OTIMIZAÇÃO

### 5.1 Problemas Identificados

1. **AdminPage.jsx**: 5 queries simultâneas sem cache
2. **DashboardPage.jsx**: setInterval a cada 30s (30000ms) com dados desnecessários
3. **CompanyDashboardPage.jsx**: Loop sequencial em batch processing
4. **AppShell.jsx**: Multiple useEffect com dependências não otimizadas

### 5.2 Métricas de Componente

| Componente | Linhas | Hooks | Queries |
|------------|-------|------|--------|
| AdminPage.jsx | ~900 | 12 | 5 |
| CompanyDashboardPage.jsx | ~750 | 15 | 4+ |
| DashboardPage.jsx | ~400 | 8 | 6+ |
| InternshipsPage.jsx | ~500 | 10 | 3 |

---

## 6. RECOMENDAÇÕES PRIORITÁRIAS

### 🔴 PRIORIDADE CRÍTICA (Semanas 1-2)

1. **Implementar transações para batch operations**
   - Substituir loop sequencial por transação Supabase
   - Adicionar rollback em caso de falha parcial

2. **Adicionar paginação**
   - Limitar resultados a 50-100 por query
   - Implementar cursor-based pagination

3. **Centralizar tratamento de erros**
   - Criar ErrorBoundary customizado
   - Padronizar retorno de serviços

4. **Proteger sessões**
   - Usar httpOnly cookies para refresh token
   - Implementar CSRF protection

### 🟠 PRIORIDADE ALTA (Semanas 3-4)

5. **Refatorar AdminPage.jsx**
   - Extrair subcomponentes
   - Implementar cache local

6. **Validação de input centralizada**
   - Criar schema de validação
   - Sanitizar todas as inputs

7. **Adicionar TypeScript**
   - Criar interfaces para dados
   - Tipar retornos de funções

8. **Logging de auditoria**
   - Logar tentativas de acesso negado
   - Registar operações administrativas

### 🟡 PRIORIDADE MÉDIA (Semanas 5-8)

9. **Otimizar queries**
   - Implementar select específico
   - Adicionar índices

10. **Testes automatizados**
    - Cobertura mínima de 60%
    - Testes de integração

11. **Documentação**
    - Documentar APIs
    - Criar runbooks

---

## 7. CONCLUSÃO

O sistema GIVA-IPIZ apresenta uma arquitetura funcional mas com dividas técnicas significativas:

### Forces Positivas:
- ✅ Separação clara de camadas (UI/serviços/dados)
- ✅ Context API bem implementado
- ✅ Supabase como backend serverless
- ✅ Internacionalização funcional

### Áreas Críticas:
- ❌ Segurança de sessão
- ❌ Operações batch sem transação
- ❌ Duplicação de código
- ❌ Tratamento de erros inconsistente

A refatoração deve seguir a ordem de prioridade definida na seção 6, começando pelas operações batch sem transação que podem causar inconsistência de dados.

---

*Relatório gerado em: ${new Date().toISOString()}*
*Sistema: GIVA-IPIZ v2.0*
*Analista: BLACKBOXAI Critical Analysis*
