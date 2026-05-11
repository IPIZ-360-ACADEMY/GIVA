-- =============================================================
-- LOGIN ALIASES (NIF / Processo / E-mail)
--
-- Objetivo:
--   Permitir login por identificadores usados no registo:
--   - aluno: número de processo
--   - empresa: NIF ou e-mail
--   - externo/admin: e-mail
--
-- Como usar no frontend:
--   rpc('resolve_login_email', { p_identifier: '<valor digitado>' })
-- =============================================================

create table if not exists public.auth_login_aliases (
  alias text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  login_email text not null,
  account_type text not null check (
    account_type in (
      'student',
      'company',
      'external',
      'admin',
      'coordinator',
      'teacher',
      'admin_1',
      'super_admin'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_auth_login_aliases_user_id
  on public.auth_login_aliases(user_id);

create index if not exists idx_auth_login_aliases_email
  on public.auth_login_aliases(login_email);

-- Atualiza updated_at em updates
create or replace function public.touch_auth_login_aliases_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_auth_login_aliases_updated_at on public.auth_login_aliases;
create trigger trg_auth_login_aliases_updated_at
before update on public.auth_login_aliases
for each row
execute function public.touch_auth_login_aliases_updated_at();

alter table public.auth_login_aliases enable row level security;

-- Leitura direta bloqueada por padrão (resolver via função security definer)
drop policy if exists "auth_login_aliases_no_direct_select" on public.auth_login_aliases;
create policy "auth_login_aliases_no_direct_select"
  on public.auth_login_aliases
  for select
  to authenticated, anon
  using (false);

-- O próprio utilizador autenticado pode gerir os aliases dele
-- (útil para fluxos autenticados de manutenção)
drop policy if exists "auth_login_aliases_owner_manage" on public.auth_login_aliases;
create policy "auth_login_aliases_owner_manage"
  on public.auth_login_aliases
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Resolve identificador de login para e-mail real no Supabase Auth.
-- SECURITY DEFINER para permitir lookup sem expor tabela inteira.
create or replace function public.resolve_login_email(p_identifier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_input text;
  v_alias_email text;
  v_student_process text;
begin
  v_input := lower(trim(coalesce(p_identifier, '')));
  if v_input = '' then
    return null;
  end if;

  -- Se já for e-mail, usa diretamente.
  if position('@' in v_input) > 0 then
    return v_input;
  end if;

  -- Alias explícito (NIF, processo, e-mail alternativo, etc.)
  select a.login_email
    into v_alias_email
  from public.auth_login_aliases a
  where lower(a.alias) = v_input
  limit 1;

  if v_alias_email is not null then
    return lower(v_alias_email);
  end if;

  -- Fallback de legado para alunos sem alias migrado:
  -- mesmo padrão do frontend (sem caracteres especiais)
  v_student_process := upper(regexp_replace(v_input, '[^A-Z0-9-]', '', 'g'));
  if v_student_process <> '' then
    return lower('aluno.' || v_student_process || '@giva.ao');
  end if;

  return null;
end;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;

comment on function public.resolve_login_email(text)
  is 'Resolve processo/NIF/e-mail para login_email real sem expor a tabela auth_login_aliases.';
