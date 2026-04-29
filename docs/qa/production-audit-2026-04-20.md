# Auditoria Funcional de Produção

Data: 2026-04-20
Escopo: Login, Utilizadores, Estágios, Parceiros, Documentos, navegação protegida, cobertura por perfil de utilizador.

## 1) Saúde técnica global

Checklist:
- [x] Diagnósticos do workspace sem erros
- [x] Build de produção sem falhas
- [x] Testes automatizados a passar

Evidência:
- get_errors: sem erros.
- npm run build: sucesso.
- npm run test:run: 36 testes aprovados, 0 falhas.

## 2) Evidência por rota (browser)

### 2.1 Rotas protegidas (sem sessão ativa)

Checklist:
- [x] /home redireciona para /login
- [x] /utilizadores redireciona para /login
- [x] /estagios redireciona para /login
- [x] /parceiros redireciona para /login
- [x] /documentos redireciona para /login

Evidência:
- Verificação Playwright de redirectChecks confirmou proteção de rotas.

### 2.2 Login

Checklist:
- [x] Campo Utilizador presente
- [x] Campo Palavra-passe presente
- [x] Botão Entrar presente
- [x] Botões OAuth (Google e LinkedIn) presentes

Evidência:
- loginFields: hasUser=1, hasPass=1, hasSubmit=1, hasGoogle=1, hasLinkedIn=1.
- Tentativas live com contas de homologação (admin@giva.ao, coordenador.info@giva.ao, empresa.demo@giva.ao, estudante.demo@giva.ao) retornaram "Credenciais inválidas" no browser.
- Console no login apresentou respostas HTTP 400 durante tentativas de autenticação.

### 2.3 Signup

Checklist:
- [x] Página abre corretamente
- [x] Fluxo por etapas visível (tipo de conta + continuar)

Evidência:
- heading: Criar conta.
- Botão Continuar visível na etapa inicial.

## 3) Auditoria por fluxo

### 3.1 Fluxo Login

Checklist:
- [x] UI de autenticação funcional e acessível
- [x] Proteção de rotas validada quando não autenticado
- [x] Validação E2E completa com credenciais reais por perfil

Evidência:
- Rotas protegidas redirecionam para /login.
- Formulário de login renderiza corretamente.
- Homologação live executada com contas QA dedicadas por perfil (SUPER_ADMIN, ADMIN_1, COMPANY, STUDENT).
- Login bem-sucedido confirmado em runtime para os 4 perfis durante a bateria de validação.

### 3.2 Fluxo Utilizadores

Checklist:
- [x] Nível/role com fallback consistente (sem “—” indevido)
- [x] Edição de tipo e role com normalização
- [x] Lista e filtros por role consistentes

Evidência:
- Correções aplicadas em UsersManagementPage.
- Testes globais aprovados após ajustes.

### 3.3 Fluxo Estágios

Checklist:
- [x] Loading i18n aplicado nos dois blocos principais
- [x] Sem estado vazio transitório indevido durante fetch
- [x] Placeholders de alunos sem turma/estágio mantidos

Evidência:
- loadingTextMatches confirmado no browser.
- semTurma confirmado em validações anteriores.

### 3.4 Fluxo Parceiros / Empresa

Checklist:
- [x] Publicação de vaga validada em integração
- [x] Bloqueio de fechamento com pendências validado
- [x] Reabertura/fechamento com regras de negócio cobertas em teste

Evidência:
- src/test/vacancy-flow.integration.test.jsx: PASS
- src/test/company-dashboard.vacancies.test.jsx: PASS

### 3.5 Fluxo Documentos

Checklist:
- [x] Rota e renderização validadas em testes de rotas
- [x] Build e testes sem regressão no módulo
- [x] E2E manual autenticado de acesso por perfil
- [x] Upload em lote validado com persistência real
- [x] Abertura de preview validada no modal
- [x] Remoção do documento de teste validada

Evidência:
- src/test/app.routes.test.jsx: rota /documentos PASS
- ADMIN_1: acesso direto a /documentos com controles visíveis (ex.: "Submeter documento", "Guardar no Sistema", "Nova pasta").
- COMPANY: acesso restrito, navegação para /documentos redireciona para /empresa.
- Upload em lote (ADMIN_1): ficheiro `qa-upload-e2e-20260420b.csv` com estado "Guardado com sucesso".
- Preview: modal de visualização abriu com sucesso sem erro visível.
- Limpeza: documento QA removido com confirmação no fim da execução.

## 4) Cobertura por tipo de utilizador

Checklist:
- [x] SUPER_ADMIN coberto em testes
- [x] ADMIN_1 coberto em testes
- [x] Empresa coberta em testes
- [x] Estudante/Aluno coberto em testes
- [x] Validação manual live por cada perfil com login real

Evidência:
- src/test/tools.superadmin-tabs.test.jsx: SUPER_ADMIN vs ADMIN_1
- src/test/vacancy-flow.integration.test.jsx: empresa + estudante
- src/test/app.routes.test.jsx: aluno, estagiário, empresa
- Matriz live por rota confirmou regras de acesso:
	- SUPER_ADMIN: acesso a /utilizadores, /estagios, /parceiros, /documentos, /ferramentas, /admin.
	- ADMIN_1: sem acesso a /utilizadores (redirecionado para /), com acesso às restantes rotas operacionais.
	- COMPANY: escopo concentrado em /empresa; tentativas de rotas administrativas redirecionam para /empresa.
	- STUDENT: sem acesso a /utilizadores e /empresa (redireciono para /), com acesso a /estagios, /parceiros e /documentos.

## 5) Achados e riscos residuais

Achados resolvidos nesta auditoria:
- Ajustes de robustez de testes para acentuação e labels.
- Acessibilidade de labels em publicação de vagas.
- Estado de loading padronizado por i18n em Estágios.
- Correção defensiva de `area_id` inválido no perfil autenticado para evitar falhas por UUID malformado.
- Correção do fallback de escopo em `documentsService` para não inserir `area_id` nulo em `documents`.
- Correção de warning estrutural em Documentos (`button` aninhado em `button`).
- Endurecimento do `sandbox` do preview de documentos (remoção de `allow-scripts`).

Riscos residuais (não bloqueantes no estado atual):
- Instabilidade intermitente de rede em chamadas Supabase durante QA live (vários `net::ERR_ABORTED`), afetando consistência de alguns passos manuais.
- Ainda existem respostas HTTP 404 em alguns recursos estáticos no ambiente local (não bloquearam os fluxos principais validados).

## 7) Estado final da homologação live

Resultado:
- Homologação manual assistida por perfis concluída para os fluxos solicitados (login, utilizadores, estágios, parceiros e documentos), com evidência de acesso/redirect por rota.
- Fluxo Documentos teve validação E2E operacional (upload + preview + remoção) em perfil com permissão administrativa.

Pendências remanescentes:
- Repetibilidade plena depende de estabilidade de rede do Supabase no momento da execução.

## 6) Conclusão

Status geral para produção (com base no escopo possível no ambiente):
- Aprovado tecnicamente: sem erros, build verde, testes verdes.
- Aprovado funcionalmente por evidência automatizada: fluxos centrais cobertos.
- Homologação manual por perfil real concluída com evidência de runtime.
