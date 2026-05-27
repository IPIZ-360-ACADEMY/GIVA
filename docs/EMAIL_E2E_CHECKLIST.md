# Email E2E Checklist (Supabase + Resend)

## Escopo

Validar envio e UX dos fluxos:

- Recuperacao de senha (login)
- Ativacao/confirmacao de conta (signup)
- Reenvio de email na tela dedicada

## Pre-requisitos

- Frontend com:
  - VITE_EMAIL_PROVIDER=edge-first
  - VITE_SUPABASE_EMAIL_EDGE_FUNCTION=send-account-email
- Edge Function `send-account-email` publicada e ativa
- Secrets da function configurados:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
  - RESEND_API_KEY
  - EMAIL_FROM
  - APP_URL
  - EMAIL_ALLOWED_ORIGINS

## Execucao manual (local)

1. Iniciar app

```powershell
Push-Location "e:\Projectos\ipiz\GIVA"
npm run dev -- --host
```

2. Login admin de validacao

- Usuario: admin@giva.ao
- Senha: ipiz2026
- Esperado: acesso ao dashboard sem erro de auth

3. Fluxo de recuperacao

- Abrir login
- Preencher utilizador com email valido
- Clicar em Esqueci a senha
- Esperado:
  - navegar para /email-status?purpose=password-reset
  - mensagem de sucesso/confirmacao na tela
  - sem erro CORS no console

4. Reenvio na tela dedicada

- Clicar Reenviar email
- Esperado:
  - feedback de sucesso ou erro controlado
  - botao volta do estado "A reenviar..."
  - cooldown de reenvio (quando sucesso)

5. Fluxo de ativacao

- Criar conta no signup
- Quando exigir confirmacao, app deve abrir /email-status?purpose=activation
- Esperado:
  - tela mostra mascara de email
  - CTA de login e reenvio disponiveis

## Validacoes tecnicas

Comando rapido (PowerShell) para validar CORS + POST:

```powershell
Push-Location "e:\Projectos\ipiz\GIVA"
.\scripts\check-email-edge-function.ps1
```

1. Browser console

- Nao deve haver erro CORS para /functions/v1/send-account-email

2. Network

- OPTIONS send-account-email => 200
- POST send-account-email => 200

3. Logs da Edge Function

- Checar chamadas e payload de purpose (activation/password-reset)

## Troubleshooting rapido

1. CORS bloqueado

- Confirmar EMAIL_ALLOWED_ORIGINS contem origem exata do frontend (com protocolo e porta)

2. Erro 500 no envio

- Confirmar RESEND_API_KEY e EMAIL_FROM validos
- Confirmar dominio remetente verificado na Resend

3. Fallback acionado com erro final

- Testar temporariamente VITE_EMAIL_PROVIDER=auth-first para isolar problema da function
