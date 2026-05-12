# Relatório de Análise Crítica e Profunda do Sistema GIVA IPIZ

## 1. VISÃO GERAL DA ARQUITETURA

### 1.1 Estrutura de Frontend
- **Framework**: React 18 com Vite
- **Estado Global**: AuthContext (useAuth hook)
- **Gestão de Estado**: useState, useMemo, useCallback
- **Routing**: React Router v6
- **Estilização**: CSS custom com variáveis CSS (tema claro/escuro)
- **Autenticação**: Supabase Auth (OAuth + Email/Password)

### 1.2 Estrutura de Pastas
```
src/
├── components/          # Componentes reutilizáveis
│   ├── AppShell.jsx          # Layout principal + navegação
│   ├── RequireAuth.jsx       # Proteção de rotas
│   └── evaluations/           # Dashboard de avaliações
├── contexts/
│   └── AuthContext.jsx       # Contexto de autenticação
├── lib/
│   └── supabase.js           # Cliente Supabase
├── pages/              # Páginas principais
├── services/           # Serviços API
├── styles/             # CSS temático
└── utils/              # Utilitários
```

---

## 2. PONTOS CRÍTICOS IDENTIFICADOS

### 2.1 AUTENTICAÇÃO E AUTHORIZAÇÃO (ALTO RISCO)

#### Problema 2.1.1: Lógica de Acesso Fragmentada
| Ficheiro | Função | Risco |
|---------|-------|------|
| `src/utils/accessControl.js` | resolveAccessProfile, getRouteAccessRules | Lógica duplicada vs RequireAuth |
| `src/components/RequireAuth.jsx` | RBAC em tempo de renderização | Pode ser burlada |
| `src/contexts/AuthContext.jsx` | useAccessProfile hook | Estado pode estar desatualizado |

**Recomendação**: Consolidar toda lógica de acesso num único módulo verificado.

#### Problema 2.1.2: Validação Insuficiente de Sessão
```javascript
// AuthContext.jsx - Linha 147
const hasSession = Boolean(data.session) || Boolean(prevSession);
```
- Usa布尔 OR pode mascarar sessões inválidas
- Não verifica expiração tokens

**Recomendação**: Validar explicitamente tokens JWT.

#### Problema 2.1.3: Missing Error Handling
```javascript
// LoginPage.jsx - Linha 67
const normalizedIdentifier = await resolveAuthLoginEmail(identifier);
// Se falhar, continua mesmo sem valor válido
```

### 2.2 GESTÃO DE ESTADO (MÉDIO RISCO)

#### Problema 2.2.1: Race Conditions
```javascript
// AuthContext.jsx - Linha 85
await finalizePendingStudentOAuth(nextSession.user);
if (!active) return;  // Verificação correta
await fetchUserProfile(nextSession.user.id);
if (!active) return;  // Verificação correta
```
- Bom uso de flags, mas pode haver problemas se múltiplas chamadasoverlap

**Recomendação**: Usar AbortController para cancels.

#### Problema 2.2.2: Memory Leaks em Subscriptions
```javascript
// AuthContext.jsx - Linha 111
notifUnsubRef.current = subscribeToNotifications(userId, ...);
// Cleanup precisa ser verificado em todos os useEffect
```

#### Problema 2.2.3: Estado Local Desnecessário
```javascript
// AppShell.jsx - Linha 14
const [query] = useState("");  // Nunca atualizado!
```

### 2.3 SEGURANÇA DE DADOS (ALTO RISCO)

#### Problema 2.3.1: Dados Sensíveis em LocalStorage
```javascript
// AuthContext.jsx - Linha 23
sessionStorage.setItem(PENDING_STUDENT_OAUTH_STORAGE, ...);
// Armazena processNumber em storage - risco XSS
```

#### Problema 2.3.2: Sanitização Insuficiente
```javascript
// InternshipsPage.jsx - Linha 12
function toSafeText(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")  // Blacklist approach
    .replace(/[<>]/g, "");                //blacklist approach
}
```
- Abordagem por blacklist é arriscada
- NãoEscape JSON/XML properly

**Recomendação**: Usar DOMPurify ou equivalente.

#### Problema 2.3.3: URLs de img sem Validação
```javascript
// InternshipsPage.jsx - Linha 23
function toSafeImageUrl(value) {
  // data: URIs podem conter código injection
  if (raw.startsWith("data:image/")) {
    return raw;
  }
}
```

### 2.4 PERFORMANCE (MÉDIO RISCO)

#### Problema 2.4.1: Large Data Fetching
```javascript
// DashboardPage.jsx - Linha 85
const [internshipsRows, partnersRows, documentsRows, notificationsRows, areaRows] = await Promise.all([
  canUseInternshipsApi() ? listInternships() : Promise.resolve([]),
  // Carrega TUDO para admin - sem paginação
]);
```

#### Problema 2.4.2: Realtime Sem Limites
```javascript
// DashboardPage.jsx - Linha 133
supabase.channel("dashboard-pulse-sync")
  .on("postgres_changes", { event: "*", schema: "public", table: "job_applications" }, ...)
  .subscribe();
// Recebe TODAS as alterações, sem filtro
```

#### Problema 2.4.3: Memoização Incompleta
```javascript
// AppShell.jsx - Linha 58
const routeAccess = useMemo(
  () => getRouteAccessRules({
    isSuperAdmin,
    isAdmin,
    // Recria objeto a cada render quando dependências mudam
  }),
  [isSuperAdmin, isAdmin, isCoordinatorUser, isCompanyUser, isExternalUser, isStudentUser, isTeacherUser]
);
```

### 2.5 INTEGRIDADE E CONSISTÊNCIA (MÉDIO RISCO)

#### Problema 2.5.1: Tipos de Dados Misturados
```javascript
// internshipsService.js
nota: String(row.nota ?? ""),    // String
// PartnersService.js
vagas: String(row.vagas ?? ""),  // String
// evaluationService.js
score: row.score,            // Number (possivelmente undefined)
```

**Recomendação**: Definir esquemas TypeScript/Zod.

#### Problema 2.5.2: Validação Frágil
```javascript
// SignupPage.jsx - Linha 87
if (studentPassword.length < 8) { ... }
// Frontend validation only - fácil de bypassar
```

#### Problema 2.5.3: Missing Error Boundaries
```javascript
// main.jsx
<ErrorBoundary>
  <BrowserRouter>...</BrowserRouter>
</ErrorBoundary>
// Apenas um ErrorBoundary para toda app
```

### 2.6 I18N E LOCALIZAÇÃO (BAIXO RISCO)

#### Problema 2.6.1: Translations Duplicadas
- 3语言 (pt-BR, pt-PT, en)
- ~300 keys cada
- Algumas inconsistências entre pt-BR e pt-PT

#### Problema 2.6.2: Fallback Implícito
```javascript
// i18n.js -createTranslator
return current[key] ?? fallback[key] ?? key;
// Se key não existe, retorna key como string - podeconfundir debugging

### 2.7 INFRAESTRUTURA (CRÍTICO)

#### Problema 2.7.1: Ambientes Não Configurados
```javascript
// supabase.js
const isSupabaseConfigured = !isTestMode && Boolean(supabaseUrl) && Boolean(supabaseAnonKey);
// MODE=test usa dados mock mas não valida variáveis
```

#### Problema 2.7.2: Variáveis de Ambiente Faltantes
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_AUTH_EMAIL_DOMAIN
- VITE_APP_URL
- MODE (production/development/test)

---

## 3. RECOMENDAÇÕES POR PRIORIDADE

### CRÍTICO (Corrigir Imediatamente)
1. Implementar validação de tokens JWT (expiração, assinatura)
2. Adicionar sanitização DOM para user input
3. Implementar paginação em TODAS as listagens
4. Adicionar rate limiting em auth endpoints
5. Remover dados sensíveis de localStorage/sessionStorage

### ALTO (Corrigir em 2 Semanas)
1. TypeScript com esquemas definidos
2. Error boundaries por rota
3. Testes E2E de autenticação
4. Logging de operações administrativas
5. Backup automático de dados

### MÉDIO (Corrigir em 1 Mês)
1. Memoização consistente com useMemo/useCallback
2. Cleanup de subscriptions
3. Validação server-side de dados
4. Otimização de queries (paginação)
5. Cache de dados readonly

### BAIXO ( backlog)
1. TypeScript migration completa
2. Documentação de APIs
3. Testes unitários
4. CI/CD pipeline
5. Monitoring/alerting

---

## 4. SCORE DE SAÚDE DO SISTEMA

| Categoria | Score (0-100) |
|----------|---------------|
| Autenticação | 65 |
| Performance | 70 |
| Segurança | 55 |
| Manutenibilidade | 60 |
| Cobertura de testes | 25 |
| Documentação | 40 |
| **Média Global** | **52.5** |

---

## 5. FICHEIROS ANALISADOS

### Core
- `src/App.jsx` ✓
- `src/main.jsx` ✓
- `src/contexts/AuthContext.jsx` ✓
- `src/components/AppShell.jsx` ✓
- `src/components/RequireAuth.jsx` ✓
- `src/utils/accessControl.js` ✓
- `src/utils/i18n.js` ✓
- `src/lib/supabase.js` ✓

### Autenticação
- `src/pages/LoginPage.jsx` ✓
- `src/pages/SignupPage.jsx` ✓
- `src/services/authService.js` ✓

### Administrativo
- `src/pages/AdminPage.jsx` ✓
- `src/pages/DashboardPage.jsx` ✓
- `src/pages/InternshipsPage.jsx` ✓
- `src/pages/EvaluationsPageEnhanced.jsx` ✓

### Serviços
- `src/services/internshipsService.js` ✓
- `src/services/partnersService.js` ✓
- `src/services/evaluationService.js` ✓

---

*Relatório gerado em: 2026-05-12*
*Versão do Sistema: GIVA IPIZ v2.x*
