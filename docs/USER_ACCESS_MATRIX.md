# Matriz de Acesso por Tipo e Nível de Utilizador

## Fonte de verdade no frontend

- Tipo de perfil (user_profiles.type): student, company, admin, external
- Nível de role (JWT app_metadata.role): SUPER_ADMIN, ADMIN_1, COMPANY, authenticated (e, pontualmente, STUDENT)
- Estado de moderação (user_profiles.moderation): active, pending, suspended

## Regras globais de autenticação

- Sem sessão autenticada: redireciona para /login
- Empresa com moderação pending: bloqueia navegação e mostra tela "Conta em análise"
- SUPER_ADMIN: acesso total
- ADMIN_1: acesso administrativo parcial
- COMPANY: acesso restrito ao contexto da empresa
- student/authenticated (não-admin): acesso ao percurso do aluno

## Rotas e acesso efetivo

### SUPER_ADMIN

- Pode aceder a todas as rotas da aplicação
- Inclui explicitamente: /admin, /ferramentas, /utilizadores
- Pode gerir utilizadores com capacidades elevadas (criação, eliminação, role, área)

### ADMIN_1 (Coordenador)

- Pode aceder a: /, /home, /estagios, /avaliacoes, /parceiros, /documentos, /turmas, /chat, /notificacoes, /config
- Pode aceder a: /admin e /ferramentas
- Não pode aceder a: /utilizadores

### COMPANY

- Pode aceder a: /empresa, /notificacoes, /chat, /config
- Qualquer outra rota autenticada redireciona para /empresa

### STUDENT / authenticated (não-admin)

- Pode aceder a: /, /home, /estagios, /parceiros, /avaliacoes, /documentos, /chat, /notificacoes, /config
- Pode aceder também a: /aluno, /perfil/:studentId, /progresso/:studentId, /perfil-publico/:userId
- Não pode aceder a: /admin, /ferramentas, /utilizadores

## Controlo de menu (visibilidade de navegação)

- SUPER_ADMIN: menu completo (inclui administração, ferramentas e utilizadores)
- ADMIN_1: menu operacional + /turmas, sem /utilizadores
- COMPANY: menu reduzido para empresa
- STUDENT: menu de percurso académico e comunicação
- Papel desconhecido/visitante autenticado: menu mínimo

## Gestão de utilizadores (página /utilizadores)

- Página visível apenas para SUPER_ADMIN
- ADMIN_1 e restantes perfis são redirecionados para /
- Operações sensíveis modeladas por RPC com requisito de role no backend:
  - admin_set_user_role: SUPER_ADMIN
  - admin_set_user_area: SUPER_ADMIN
  - admin_delete_user: SUPER_ADMIN
  - admin_list_users: ADMIN_1+

## Administração (página /admin)

- Acessível a ADMIN_1 e SUPER_ADMIN
- Fluxos de moderação de empresas/publicações e operações administrativas gerais

## Observações importantes (inconsistências a vigiar)

1. Modelo misto de identificação de aluno:
- O frontend trata aluno por type=student, role=STUDENT e role=authenticated
- Em gestão de utilizadores, role de aluno aparece como authenticated
- Recomendação: padronizar formalmente no backend e frontend para evitar casos ambíguos

2. Dependência dupla (type + role):
- Várias regras usam combinações de user_profiles.type e JWT role
- Recomendação: definir hierarquia oficial (ex.: role como autoridade principal e type como domínio funcional)

3. Controlo frontend não substitui autorização backend:
- O bloqueio por rota/menu é UX
- A autorização forte deve continuar a ser garantida por RPC/RLS no Supabase

## Referências de código

- src/components/RequireAuth.jsx
- src/components/AppShell.jsx
- src/contexts/AuthContext.jsx
- src/App.jsx
- src/pages/UsersManagementPage.jsx
- src/pages/AdminPage.jsx
- src/services/authService.js
- src/services/usersAdminService.js
