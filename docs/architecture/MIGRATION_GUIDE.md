# GIVA IPIZ — Guia de Migrações SQL (Supabase)

Execute os ficheiros **pela ordem indicada** no Supabase SQL Editor.
Cada ficheiro é idempotente (`CREATE IF NOT EXISTS`, `DROP IF EXISTS`, etc.) — pode re-executar sem risco.

---

## Ordem de Execução

| # | Ficheiro | Descrição | Estado |
|---|----------|-----------|--------|
| 1 | `supabase-core-admin.sql` | Tabelas base (admin institucional) | Run se não existir |
| 2 | `supabase-partners.sql` | Parceiros e empresas base | Run se não existir |
| 3 | `supabase-user-profiles.sql` | Perfis de utilizador + RLS | Run se não existir |
| 4 | `supabase-signup-upgrade.sql` | ⚠️ **CRÍTICO** — `student_accounts`, `company_accounts`, `verify_student_process_number` RPC | **Necessário para signup de alunos** |
| 5 | `supabase-phase1-structure.sql` | `training_area`, `courses`, `students` base, `internships` | Run se não existir |
| 5a | `supabase-student-petitions.sql` | Pedidos de carta de alunos e RLS de escopo por área | Run se não existir |
| 6 | `supabase-company-rls-hardening.sql` | 🔒 **CRÍTICO** — reforço RLS para `job_applications`, `company_progress`, `company_accounts` | **Necessário para isolamento de empresa** |
| 7 | `supabase-chat.sql` | `conversations`, `messages`, `follows` + Realtime | **Necessário para o chat** |
| 8 | `supabase-notifications-v2.sql` | `user_notifications`, triggers de reação/comentário | **Necessário para notificações** |
| 9 | `supabase-social.sql` | Posts, reações, comentários | Run se não existir |
| 10 | `supabase-admin-academic.sql` | ✅ **EXECUTADO** — Fix FK notificações, `students` campos extra, `generate_process_number()`, RLS escopado de `students` + `student_portfolio` | ✅ Feito |
| 11 | `supabase-tools-permissions-fix.sql` | 🔧 Alinha permissões de `internships` e `internship_vacancies` com o frontend (ADMIN_1 + SUPER_ADMIN) | Recomendado |
| 12 | `supabase-training-area-courses-rls.sql` | 🔧 Corrige RLS de `training_area` e `courses` para seleção/criação/edição no painel Ferramentas | Recomendado |

---

## Verificar o que já existe

Cole este snippet no SQL Editor para ver as tabelas criadas:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

E para verificar funções RPC:

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;
```

---

## Ficheiros críticos em detalhe

### `supabase-signup-upgrade.sql` — **Necessário para login de alunos**

Cria:
- `student_accounts` (liga UUID do auth ao número de processo)
- `company_accounts` (dados adicionais de empresa)
- `verify_student_process_number(p_number TEXT)` — RPC que verifica se o processo existe na tabela `students` antes do aluno criar conta

Sem este ficheiro executado, ao clicar "Registar como Aluno" no signup aparece erro *"Erro de ligação"*.

### `supabase-chat.sql` — **Necessário para o chat**

Cria:
- `conversations` + `conversation_participants` + `messages`
- Trigger `trg_message_touch_conv` (atualiza `updated_at` da conversa)
- `create_conversation(other_user_id)` RPC usada por `getOrCreateConversation()`
- Realtime nos canais de mensagens

### `supabase-notifications-v2.sql` — **Necessário para notificações**

Cria:
- `user_notifications` (a tabela principal)
- Trigger `trg_notify_reaction` (notifica ao reagir a posts)
- `insert_notification()` helper SECURITY DEFINER

### `supabase-admin-academic.sql` — **Reaplicar para segurança de ownership**

Este ficheiro agora também aplica hardening de RLS para:
- `public.students`: acesso escopado a admin, aluno dono do registo e empresas com vínculo real (candidatura/progresso)
- `public.student_portfolio`: ownership por aluno/admin e leitura de empresa apenas quando existir vínculo real

Se o ambiente foi provisionado com versão anterior deste ficheiro (com `students_select_all`/`students_update_admin` permissivos), reexecute o script para remover políticas amplas.

---

## Variáveis de ambiente

Confirmar que `.env` (ou Vercel Environment Variables) tem:

```
VITE_SUPABASE_URL=https://pniwewlldopizfwrvneo.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key do projecto>
VITE_AUTH_EMAIL_DOMAIN=giva.ipiz.ao   # domínio do email sintético para alunos
```

A variável `VITE_AUTH_EMAIL_DOMAIN` define o sufixo do email gerado para alunos:
`aluno.IPIZ-2026-0001@giva.ipiz.ao`

---

## Após executar todos os SQL

1. Verificar Realtime em Supabase → Database → Replication:
   - `user_notifications` deve estar publicada
   - `messages` deve estar publicada

2. Criar pelo menos uma `training_area` para o formulário de registo de alunos funcionar:
```sql
INSERT INTO public.training_area (code, name, color_hex, icon_name, display_order)
VALUES
  ('INFO',    'Informática',      '#3b82f6', 'computer',    1),
  ('ELEC',    'Electricidade',    '#f59e0b', 'bolt',        2),
  ('MECA',    'Mecânica',         '#6b7280', 'settings',    3),
  ('BIOQUIM', 'Bioquímica',       '#10b981', 'science',     4),
  ('CONTA',   'Contabilidade',    '#8b5cf6', 'calculate',   5)
ON CONFLICT (code) DO NOTHING;
```
