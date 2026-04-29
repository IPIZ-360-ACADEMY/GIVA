# SGEIP v2.0 - Arquitetura Enterprise

## 1. Visao Geral
SGEIP v2.0 adota arquitetura modular por dominio (DDD + Clean Architecture), com isolamento logico por area academica e trilha de auditoria imutavel para operacoes sensiveis.

Objetivos principais:
- Seguranca e rastreabilidade total de operacoes.
- Escalabilidade horizontal com API stateless.
- Separacao forte de responsabilidades no frontend e backend.
- Evolucao para modelo multi-instituicao (SaaS-ready).

## 2. Dominios (Bounded Contexts)
- Identity & Access Management (IAM)
- Academic Structure (Areas, Cursos, Turmas)
- Student Lifecycle
- Internship Management
- Document Management System (DMS)
- Notification Engine
- Audit & Logging
- Event Scheduling
- Archive & Historical Data

## 3. Arquitetura Logica (Camadas)
- Presentation: SPA/MPA modular por modulo, UI por Atomic Design.
- Application: Use Cases (orquestracao, validacoes e regras transversais).
- Domain: Entidades, Value Objects, regras de negocio e contratos.
- Infrastructure: repositorios, fila, storage, provider de auth e observabilidade.

## 4. Multi-Tenant Logico por Area
Tenant key: `area_id`
- TI
- EIE
- MECA
- TLQB

Regras:
- Todo registro de dominio academico possui `area_id`.
- Nenhum acesso cross-area sem permissao explicita (`scope:cross_area`).
- Coordenador (Admin2) opera somente na propria area.

## 5. Modelo de Permissoes
Papéis:
- SUPER_ADMIN (global)
- ADMIN_1 (gatekeeper de acoes sensiveis)
- ADMIN_2 (coordenador por area)
- STUDENT (escopo proprio)

Controle:
- RBAC para autorizacao base.
- ABAC opcional por atributos (`area_id`, `resource_owner`, `criticality`).
- Approval Flow para operacoes sensiveis iniciadas por Admin2.

## 6. Approval Flow
Estados de requisicao:
- PENDING_APPROVAL
- APPROVED
- REJECTED
- EXECUTED

Fluxo:
1. Admin2 solicita acao sensivel.
2. Sistema cria `approval_request` com snapshot `before`.
3. Admin1/Super Admin aprova ou rejeita.
4. Em aprovacao, comando e executado e evento final e persistido.

## 7. Auditoria Imutavel (Event Sourcing Light)
Todo comando gera evento de auditoria append-only.

Campos minimos:
- actor_id
- role
- area_id
- action
- resource
- resource_id
- timestamp
- before_json
- after_json
- status
- correlation_id

Regras:
- Sem UPDATE/DELETE em eventos.
- Apenas leitura para Admin1 e Super Admin.
- Filtros: data, usuario, acao, area, status.

## 8. Frontend Elite (Atomic Design)
Estrutura CSS implementada:
- tokens
- base
- layout
- components
- utilities
- responsive

Cada objeto visual critico (botao, card, tabela, formulario, navegacao, modal, toast) foi segregado em ficheiros dedicados.

## 9. NFRs
- Responsividade total (mobile-first + breakpoints 1150/960/560).
- Compatibilidade browser: fallback progressivo para recursos modernos.
- Seguranca: JWT+refresh, hash forte, rate limit, anti-XSS/CSRF/SQLi.
- Observabilidade: logs estruturados, metricas e tracing distribuido.

## 10. Prontidao de Producao
Checklist:
- Containers (Docker + Compose/Kubernetes)
- CI/CD com quality gates
- Backup e retention policy
- Alertas operacionais (SLO/SLI)
- Plano de disaster recovery

## 11. Relatorio Final - As-Is vs Target

### 11.1 As-Is (estado atual validado)
- Frontend em arquitetura modular por dominios e paginas, com bootstrap central.
- Legado mantido como adapter transversal com delegacao progressiva para dominios modernos.
- CSS atomic design aplicado com separacao por tokens/base/layout/componentes/utilitarios/responsivo.
- Scripts inline removidos das paginas principais operacionais.
- Responsividade reforcada com breakpoints adicionais e ajustes para touch/coarse pointer/reduced motion.
- Compatibilidade cross-browser por fallback progressivo para recursos modernos.

Dominios ativos no frontend:
- `ux.module.js`
- `shell.module.js`
- `navigation.module.js`
- `iam.module.js`
- `auth-guard.module.js`
- `internship.module.js`
- `document.module.js`
- `ux-feedback.module.js`

Paginas com modulos dedicados:
- `est.page.js`
- `alumno.page.js`
- `avaliacoes.page.js`
- `parc.page.js`
- `notif.page.js`
- `statis.page.js`
- `config.page.js`

### 11.2 Target (estado enterprise desejado)
- Remocao total do adapter legado (`app.legacy.js`) apos migracao de 100% das responsabilidades.
- Dominios frontend totalmente orientados por contratos de API e eventos internos.
- Backend stateless com JWT/refresh, trilha de auditoria append-only e approval flow completo.
- Observabilidade com logs estruturados e metricas por dominio (frontend + backend).
- Pipeline CI/CD com gates de seguranca, testes automatizados e verificacao de regressao visual.

### 11.3 Gap Analysis
- Gap 1: ainda existe adapter legado para compatibilidade de runtime.
- Gap 2: camada backend enterprise ainda representada em blueprint/documentacao, nao em servicos produtivos completos.
- Gap 3: validacao de seguranca automatica (SAST/SCA) ainda depende de execucao operacional no pipeline.

### 11.4 Proximos Passos Recomendados
1. Extrair restante de `app.legacy.js` para dominios modernos e eliminar adapter.
2. Introduzir contratos versionados de API para IAM, DMS, Notification e Internship.
3. Automatizar testes E2E cross-browser e testes de regressao visual responsiva.
4. Integrar scans de seguranca e quality gates no CI/CD.
