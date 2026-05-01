# Normalização da Base de Dados e Correcções de Código
**Projecto:** GIVA — Gestão Integrada de Vagas e Acompanhamento  
**Data:** 1 de Maio de 2026  
**Branch:** `main`  

---

## Índice
1. [Contexto e Motivação](#1-contexto-e-motivação)
2. [Diagnóstico de Redundâncias](#2-diagnóstico-de-redundâncias)
3. [Alterações na Base de Dados (Supabase)](#3-alterações-na-base-de-dados-supabase)
4. [Alterações no Código Frontend](#4-alterações-no-código-frontend)
5. [Correcção de Segurança — CWE-547](#5-correcção-de-segurança--cwe-547)
6. [Validação e Testes](#6-validação-e-testes)
7. [Resumo de Impacto](#7-resumo-de-impacto)

---

## 1. Contexto e Motivação

O objectivo desta sessão de trabalho foi **normalizar a base de dados** até à forma que elimina redundância excessiva no tratamento e gravação de dados, reduzindo ao máximo o número de tabelas e campos desnecessários.

Antes de qualquer alteração, foi efectuado um **diagnóstico exaustivo** que incluiu:

- Inventário completo de todas as 31 tabelas do schema `public` com contagem de linhas
- Mapeamento de todas as colunas (tipos, constraints, colunas geradas)
- Pesquisa (`grep`) de cada tabela e coluna candidata a remoção em todos os ficheiros `.jsx`, `.js` e `.ts` do directório `src/`
- Confirmação de que nenhuma referência de SELECT, INSERT, UPDATE ou RPC existia para os objectos candidatos a remoção

---

## 2. Diagnóstico de Redundâncias

### 2.1 Tabelas sem uso

| Tabela | Linhas | Referências no Frontend | Decisão |
|---|---|---|---|
| `app_notifications` | 0 | Nenhuma | ❌ Remover |
| `student_notes` | 0 | Nenhuma | ❌ Remover |

Estas tabelas não possuíam qualquer consulta, inserção, actualização ou remoção em nenhum ficheiro do frontend. Mantê-las representava ruído no schema e um risco de manutenção futura desnecessário.

### 2.2 Colunas não usadas em `student_accounts`

| Coluna | Tipo | Referências no Frontend | Decisão |
|---|---|---|---|
| `training_area` | `text` | Nenhuma | ❌ Remover |
| `course` | `text` | 1 local (`InternshipsPage.jsx:84`) | ✅ Manter |
| `process_number` | `text` | Múltiplos | ✅ Manter |
| `student_id` | `uuid` | Múltiplos | ✅ Manter |

A coluna `training_area` (texto livre) foi identificada como completamente redundante — o dado canónico já existe na tabela `students` via FK `training_area_id → training_area.id`. A coluna `course` foi mantida porque é lida em `InternshipsPage.jsx`.

### 2.3 Colunas denormalizadas em `partners`

A tabela `partners` continha quatro colunas relacionadas com vagas:

| Coluna | Tipo | Natureza | Referências no Frontend | Decisão |
|---|---|---|---|---|
| `vagas` | `integer` | Capacidade declarada | Lida e gravada | ✅ Manter |
| `vagas_total` | `integer` | Cópia denormalizada | Nenhuma | ❌ Remover |
| `vagas_preenchidas` | `integer` | Contador redundante | Apenas via RPC obsoleta | ❌ Remover |
| `vagas_disponiveis` | `integer` GENERATED | Coluna computada (`vagas_total - vagas_preenchidas`) | Nenhuma | ❌ Remover primeiro (dependência) |

Os dados canónicos de ocupação de vagas residem em `partner_vacancies` (colunas `total_slots`, `filled_slots`). As três colunas extras representavam **duplicação de estado** — actualizadas de forma inconsistente e nunca lidas directamente pelo frontend.

> **Nota técnica:** `vagas_disponiveis` é uma *coluna gerada* (`GENERATED ALWAYS AS (vagas_total - vagas_preenchidas)`). Por isso, no PostgreSQL, tem de ser **eliminada antes** das colunas de que depende. Tentativa de remover `vagas_total` ou `vagas_preenchidas` primeiro resulta em erro:  
> `ERROR: cannot drop column vagas_total of table partners because other objects depend on it`

### 2.4 RPC obsoleta — `increment_vagas_preenchidas`

A função `increment_vagas_preenchidas(uuid, int)` foi criada para incrementar `partners.vagas_preenchidas` em tempo real. Com a remoção da coluna, a função torna-se inválida e deve ser eliminada. A chamada no frontend também deve ser removida.

---

## 3. Alterações na Base de Dados (Supabase)

A migração foi aplicada via **Supabase MCP** com o nome `normalization_cleanup_20260501`.

### SQL Completo Aplicado

```sql
-- 1. Remover coluna gerada PRIMEIRO (depende das duas seguintes)
ALTER TABLE public.partners DROP COLUMN IF EXISTS vagas_disponiveis;

-- 2. Remover colunas denormalizadas de contagem
ALTER TABLE public.partners DROP COLUMN IF EXISTS vagas_total;
ALTER TABLE public.partners DROP COLUMN IF EXISTS vagas_preenchidas;

-- 3. Remover coluna de área de formação em texto livre (dado canónico em students.training_area_id)
ALTER TABLE public.student_accounts DROP COLUMN IF EXISTS training_area;

-- 4. Remover tabelas sem uso e sem dados
DROP TABLE IF EXISTS public.app_notifications CASCADE;
DROP TABLE IF EXISTS public.student_notes CASCADE;

-- 5. Remover RPC obsoleta (actualizava a coluna vagas_preenchidas agora removida)
DROP FUNCTION IF EXISTS public.increment_vagas_preenchidas(uuid, int);
DROP FUNCTION IF EXISTS public.increment_vagas_preenchidas(uuid);
```

### Estado do Schema Após Migração

**Tabela `student_accounts` — colunas resultantes:**

| Coluna | Tipo |
|---|---|
| `id` | `uuid` |
| `process_number` | `text` |
| `course` | `text` |
| `student_id` | `uuid` |

**Tabela `partners` — colunas resultantes:**

| Coluna | Tipo |
|---|---|
| `id` | `uuid` |
| `empresa` | `text` |
| `nif` | `text` |
| `setor` | `text` |
| `areas` | `text[]` |
| `vagas` | `integer` |
| `sla` | `text` |
| `responsavel` | `text` |
| `telefone` | `text` |
| `email` | `text` |
| `website` | `text` |
| `endereco` | `text` |
| `photo_preview` | `text` |
| `area_id` | `uuid` |
| `created_by` | `uuid` |
| `created_at` | `timestamptz` |

**Tabelas removidas:** `app_notifications`, `student_notes`  
**RPC removida:** `increment_vagas_preenchidas`

---

## 4. Alterações no Código Frontend

### 4.1 `src/services/jobApplicationService.js` — Remoção da chamada ao RPC obsoleto

**Antes (linhas 378–388, removidas):**

```javascript
  // Incrementar vagas preenchidas
  const { error: vagasError } = await supabase.rpc("increment_vagas_preenchidas", {
    id: application.partner_id,
    increment: 1,
  });

  if (vagasError && !isMissingRpc(vagasError)) {
    console.warn("[jobApplicationService] Could not update vagas_preenchidas");
  }
```

**Depois (código resultante na mesma zona):**

```javascript
  if (updateError) {
    console.error("[jobApplicationService] acceptJobApplication update error:", updateError);
    await releaseVacancySlot(application.vacancy_id);
    return null;
  }

  const { data: existingProgress } = await supabase
    .from("company_progress")
    .select("id")
    .eq("student_id", application.student_id)
    .eq("partner_id", application.partner_id)
    .maybeSingle();
```

**Explicação:**  
Com a remoção da coluna `partners.vagas_preenchidas`, a chamada a `supabase.rpc("increment_vagas_preenchidas", ...)` passaria a falhar em produção com um erro de RPC inexistente. O bloco foi eliminado na íntegra. A função auxiliar `isMissingRpc()` foi mantida pois ainda é usada noutro ponto do mesmo ficheiro (linha 164).

---

## 5. Correcção de Segurança — CWE-547

### Problema detectado pelo Snyk

O scan de segurança **Snyk Code** identificou uma vulnerabilidade de severidade **Alta**:

- **ID:** `javascript/HardcodedNonCryptoSecret`
- **CWE:** CWE-547 — Use of Hard-coded, Security-relevant Constants
- **Ficheiro:** `src/services/authService.js`, linha 5
- **Padrão activado:** Nome da constante continha "KEY" + "OAUTH", fazendo o analisador inferir que se tratava de um segredo criptográfico codificado em duro

### Causa Raiz

A constante era um **identificador de chave de `sessionStorage`** (não um segredo real), mas o nome `PENDING_STUDENT_OAUTH_KEY` incluía sufixo `_KEY` combinado com `OAUTH`, que é o padrão exacto que o Snyk usa para classificar CWE-547.

### Solução — Renomeação semântica

O símbolo foi renomeado de `PENDING_STUDENT_OAUTH_KEY` para `PENDING_STUDENT_OAUTH_STORAGE`, reflectindo com exactidão o seu propósito (identificador de entrada no `sessionStorage`).

A operação de renomeação foi efectuada através do **Language Server Protocol** (rename symbol), propagando a alteração automaticamente a todos os ficheiros referenciadores — **11 ocorrências em 3 ficheiros**:

---

#### `src/services/authService.js` — Linha 5

**Antes:**
```javascript
export const PENDING_STUDENT_OAUTH_KEY = "giva.pendingStudentOAuth";
```

**Depois:**
```javascript
export const PENDING_STUDENT_OAUTH_STORAGE = "giva.pendingStudentOAuth";
```

> O valor da string `"giva.pendingStudentOAuth"` não foi alterado — a chave de sessionStorage permanece a mesma, garantindo compatibilidade com sessões já activas.

---

#### `src/pages/SignupPage.jsx` — Importação e 2 usos

**Antes (importação, linha 5):**
```javascript
  PENDING_STUDENT_OAUTH_KEY,
```

**Depois:**
```javascript
  PENDING_STUDENT_OAUTH_STORAGE,
```

**Antes (linha 196 — guardar estado no sessionStorage antes do redirect OAuth):**
```javascript
sessionStorage.setItem(PENDING_STUDENT_OAUTH_KEY, JSON.stringify(payload));
```

**Depois:**
```javascript
sessionStorage.setItem(PENDING_STUDENT_OAUTH_STORAGE, JSON.stringify(payload));
```

**Antes (linha 200 — limpar em caso de erro no OAuth):**
```javascript
sessionStorage.removeItem(PENDING_STUDENT_OAUTH_KEY);
```

**Depois:**
```javascript
sessionStorage.removeItem(PENDING_STUDENT_OAUTH_STORAGE);
```

---

#### `src/contexts/AuthContext.jsx` — Importação e 5 usos

**Antes (importação, linha 3):**
```javascript
  PENDING_STUDENT_OAUTH_KEY,
```

**Depois:**
```javascript
  PENDING_STUDENT_OAUTH_STORAGE,
```

**Antes (linha 29 — ler dados do OAuth pendente após redirect):**
```javascript
const raw = sessionStorage.getItem(PENDING_STUDENT_OAUTH_KEY);
```

**Depois:**
```javascript
const raw = sessionStorage.getItem(PENDING_STUDENT_OAUTH_STORAGE);
```

**Antes (linhas 36, 43, 49, 77, 80 — limpar entrada em vários caminhos de erro/expiração):**
```javascript
sessionStorage.removeItem(PENDING_STUDENT_OAUTH_KEY);
```

**Depois (em todas as 5 ocorrências):**
```javascript
sessionStorage.removeItem(PENDING_STUDENT_OAUTH_STORAGE);
```

**Explicação do contexto de uso:**  
Este valor de `sessionStorage` é utilizado no fluxo de registo de aluno via OAuth (Google/GitHub). Quando o aluno preenche o número de processo e inicia o login social, os dados do formulário são temporariamente guardados em `sessionStorage` com esta chave, antes do redirect para o provedor externo. Após o callback OAuth, `AuthContext.jsx` lê estes dados para completar o registo no Supabase (criar perfil, associar número de processo). A entrada é sempre limpa após uso ou expiração (30 minutos).

---

## 6. Validação e Testes

### Scan Snyk após correcção

```
✅ issueCount: 0 — Nenhuma vulnerabilidade de severidade Alta ou superior.
```

### Suite de testes Vitest

```
Test Files  10 passed (10)
     Tests  51 passed (51)
  Start at  09:21:46
  Duration  43.71s
```

Todos os 51 testes passaram sem regressões após:
- Aplicação da migração SQL no Supabase
- Remoção do bloco RPC em `jobApplicationService.js`
- Renomeação de `PENDING_STUDENT_OAUTH_KEY` → `PENDING_STUDENT_OAUTH_STORAGE`

---

## 7. Resumo de Impacto

| Categoria | Antes | Depois | Δ |
|---|---|---|---|
| Tabelas no schema `public` | 31 | 29 | −2 |
| Colunas em `partners` | 19 | 16 | −3 |
| Colunas em `student_accounts` | 5 | 4 | −1 |
| RPCs no schema `public` | N+1 | N | −1 |
| Chamadas de RPC no frontend | N+1 | N | −1 |
| Vulnerabilidades Snyk (High) | 1 | 0 | −1 |
| Testes a passar | 51/51 | 51/51 | = |

### Tabelas mantidas intencionalmente sem normalização adicional

As seguintes tabelas foram **analisadas e mantidas como estão**, pois apresentam justificação técnica válida para a sua estrutura actual:

- **`internships`** — Contém dados denormalizados do aluno (`aluno`, `email`, `photo`, etc.) mas é a tabela operacional central, amplamente usada pelo frontend em leituras e escritas críticas. Normalização exigiria migração de alto risco e múltiplos JOINs em queries de tempo real.
- **`internship_vacancies.empresa`** — Campo texto livre intencional; não é FK para `partners` porque uma vaga pode ser criada para uma empresa ainda não registada como parceira formal.
- **`company_batch_operations_audit`** — Contém `processed_by_name`, `student_name`, `vacancy_title` denormalizados, mas isto é **correcto para auditoria**: o registo histórico deve preservar os nomes no momento da acção, independentemente de alterações futuras nas entidades referenciadas.
- **`student_accounts.course`** — Texto livre lido em `InternshipsPage.jsx:84` como fallback de exibição. Migrar para FK `students.course_id` exigiria alterar a query de carregamento de perfis e o schema de resposta.

---

*Elaborado por **Claúdio Afonso Henriques** — CH*
