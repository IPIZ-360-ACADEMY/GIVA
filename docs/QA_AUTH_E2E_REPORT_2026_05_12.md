# QA Auth E2E Report - 2026-05-12

## Escopo executado
- Item 1: auditoria técnica de configuração Auth/MFA/SMTP no Supabase.
- Item 2: teste E2E guiado de signup/login e fluxo MFA no frontend local.

## Ambiente
- Projeto: GIVA
- Frontend local: http://localhost:5173
- Banco: Supabase remoto do projeto
- Data: 2026-05-12

## Item 1 - Auditoria técnica Supabase

### 1) Migração de hardening aplicada
- Migração aplicada com sucesso: `supabase_auth_mfa_security_hardening_20260512_v2`.
- Ajuste de compatibilidade necessário: policies em `public.evaluations` usavam `created_by`, mas a tabela no ambiente remoto usa `evaluator_id`.
- Arquivo atualizado: `docs/architecture/supabase-auth-mfa-security-hardening.sql`.

### 2) Verificações de backend pós-migração
- Função existente: `public.handle_new_user_oauth`.
- Trigger existente: `auth.users` -> `trg_new_user_oauth`.
- Views endurecidas:
  - `public.user_profiles_with_email`
  - `public.company_accounts_quality`
- Grants observados nas views: apenas `postgres` e `service_role` (sem `anon` e sem `authenticated`).
- RLS em `public.evaluations`: ativo.
- Policies presentes:
  - `evaluations_select_scoped`
  - `evaluations_insert_scoped`
  - `evaluations_update_scoped`
  - `evaluations_delete_scoped`

### 3) Evidências operacionais de Auth/MFA
- `auth.users`: 32 usuários, 32 com `email_confirmed_at` preenchido.
- `auth.sessions`: somente `aal1` no momento da auditoria.
- `auth.mfa_factors`: encontrado fator `totp` em `unverified`.

### 4) Limites de observabilidade via SQL
- Configuração SMTP e flags administrativas de Auth (como exigir confirmação obrigatória de e-mail para novos cadastros) não ficaram diretamente auditáveis por SQL neste contexto.
- Conclusão: para fechar 100% o item de configuração administrativa, ainda é necessário validar no painel Auth do Supabase (ou por API administrativa específica).

## Item 2 - Teste E2E guiado (frontend)

### Fluxo validado
1. Logout e retorno à tela de login: ok.
2. Signup de conta visitante com e-mail novo: ok.
3. Pós-signup: usuário entrou diretamente na aplicação (`/home`), com sessão ativa.
4. Navegação para `Configurações > Segurança`: ok.
5. Início de enrollment MFA TOTP: ok.
6. Exibição de QR code + chave manual + campo de código: ok.

### Resultado funcional
- O fluxo de MFA no frontend está funcional até a etapa de confirmação do código TOTP.
- O comportamento de signup visitante no ambiente testado foi de sessão imediata (sem bloqueio por confirmação de e-mail antes do login).

## Riscos e pendências
- Ainda não validado fim-a-fim:
  - confirmação de e-mail em caixa real;
  - login bloqueado até confirmação (caso política de confirmação obrigatória esteja ativa);
  - elevação para `aal2` após informar código TOTP válido.
- Recomendação de segurança operacional:
  - rotacionar imediatamente qualquer credencial SMTP/IAM que tenha sido exposta em arquivo compartilhado.

## Conclusão
- Item 1: concluído tecnicamente no banco (migração + validações estruturais), com ressalva de que settings administrativos de Auth/SMTP exigem verificação no painel/API de administração.
- Item 2: concluído parcialmente com forte evidência de fluxo operacional no frontend; resta validação manual final com caixa de e-mail e app autenticadora para fechar o ciclo completo de confirmação e MFA `aal2`.

## Rodada da próxima checklist (executada)

### Checklist 1 - Política de confirmação de e-mail
- Evidência SQL (usuários mais recentes):
  - novos usuários criados em teste possuem `email_confirmed_at` preenchido imediatamente;
  - `confirmation_sent_at` está nulo nos últimos registros.
- Critério de aceite:
  - bloquear login antes de confirmação quando a política exigir confirmação obrigatória.
- Status desta rodada: **reprovado no ambiente atual** (comportamento observado é auto-confirmação/sessão imediata).

### Checklist 2 - MFA operacional e elevação de sessão
- Evidência SQL:
  - `auth.mfa_factors`: fator `totp` em `unverified`.
  - `auth.sessions`: sessões recentes apenas `aal1`.
- Evidência frontend:
  - página de segurança exibe QR code e chave manual corretamente;
  - etapa final de validação do código TOTP não foi concluída nesta rodada.
- Critério de aceite:
  - existir ao menos um fator `verified` e sessão `aal2` após challenge.
- Status desta rodada: **parcial/reprovado para aceite final** (fluxo de UI ok, sem prova de `aal2`).

### Checklist 3 - Configuração administrativa SMTP/Auth
- Tentativa de auditoria por SQL em `auth.instances` sem linhas acessíveis neste contexto.
- Critério de aceite:
  - confirmação documental no painel do Supabase de SMTP ativo e política desejada de confirmação por e-mail.
- Status desta rodada: **pendente** (exige validação no painel/admin API).

## Status final consolidado desta rodada
- Item 1: **concluído com ressalvas administrativas**.
- Item 2: **funcional no frontend, mas não homologado E2E completo** por falta de validação real de confirmação de e-mail e `aal2`.
