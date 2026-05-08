-- ============================================================
-- GIVA IPIZ — Super Admin RPCs
-- Objetivo: Funções de gestão de utilizadores para SUPER_ADMIN
-- Pré-requisito: supabase-company-rls-hardening.sql (is_admin_user)
-- Execução: Supabase SQL Editor
-- ============================================================

-- Extensão necessária para bcrypt (criação de utilizadores)
create extension if not exists pgcrypto;

-- ============================================================
-- 0) Migração: normalizar valores legados de moderation_status
--    Converte 'approved' → 'active' (valor antigo não suportado)
-- ============================================================
update public.user_profiles
set moderation = 'active'::public.moderation_status
where moderation::text = 'approved';

-- ============================================================
-- 1) Política: admin pode actualizar qualquer perfil
-- ============================================================
drop policy if exists "profiles_update_admin" on public.user_profiles;

create policy "profiles_update_admin"
  on public.user_profiles
  for update
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- ============================================================
-- 2) Listar todos os utilizadores (ADMIN_1 + SUPER_ADMIN)
-- ============================================================
drop function if exists public.admin_list_users();
create or replace function public.admin_list_users()
returns table(
  id           uuid,
  email        text,
  display_name text,
  avatar_url   text,
  bio          text,
  type         text,
  moderation   text,
  role         text,
  created_at   timestamptz
)
language plpgsql
security definer
as $$
begin
  if not public.is_admin_user() then
    raise exception 'Acesso negado: requer privilegios de administrador';
  end if;

  return query
  select
    up.id::uuid,
    u.email::text,
    up.display_name::text,
    up.avatar_url::text,
    up.bio::text,
    up.type::text,
    up.moderation::text,
    coalesce(u.raw_app_meta_data ->> 'role', 'authenticated')::text as role,
    up.created_at::timestamptz
  from public.user_profiles up
  left join auth.users u on u.id = up.id
  order by up.created_at desc
  limit 500;
end;
$$;

-- ============================================================
-- 3) Alterar JWT role de um utilizador (SUPER_ADMIN apenas)
-- ============================================================
create or replace function public.admin_set_user_role(
  p_target_uid uuid,
  p_new_role   text
)
returns void
language plpgsql
security definer
as $$
begin
  if public.current_app_role() <> 'SUPER_ADMIN' then
    raise exception 'Acesso negado: requer SUPER_ADMIN';
  end if;

  if p_new_role not in ('SUPER_ADMIN', 'ADMIN_1', 'COMPANY', 'authenticated') then
    raise exception 'Role invalido. Valores aceites: SUPER_ADMIN, ADMIN_1, COMPANY, authenticated';
  end if;

  if not exists (select 1 from auth.users where id = p_target_uid) then
    raise exception 'Utilizador nao encontrado';
  end if;

  update auth.users
  set
    raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', p_new_role),
    updated_at = now()
  where id = p_target_uid;
end;
$$;

  -- ============================================================
  -- 3.1) Definir area_id no JWT metadata (SUPER_ADMIN apenas)
  -- ============================================================
  create or replace function public.admin_set_user_area(
    p_target_uid uuid,
    p_area_id    uuid
  )
  returns void
  language plpgsql
  security definer
  as $$
  begin
    if public.current_app_role() <> 'SUPER_ADMIN' then
      raise exception 'Acesso negado: requer SUPER_ADMIN';
    end if;

    if p_area_id is null then
      raise exception 'area_id e obrigatorio';
    end if;

    if not exists (select 1 from auth.users where id = p_target_uid) then
      raise exception 'Utilizador nao encontrado';
    end if;

    if not exists (select 1 from public.training_area where id = p_area_id and is_active = true) then
      raise exception 'Area de formacao invalida ou inactiva';
    end if;

    update auth.users
    set
      raw_app_meta_data = raw_app_meta_data || jsonb_build_object('area_id', p_area_id::text),
      updated_at = now()
    where id = p_target_uid;
  end;
  $$;

-- ============================================================
-- 4) Criar novo utilizador na plataforma (SUPER_ADMIN apenas)
-- ============================================================
drop function if exists public.admin_create_platform_user(text, text, text, text, text, text, boolean);
create or replace function public.admin_create_platform_user(
  p_email        text,
  p_password     text,
  p_display_name text,
  p_type         text,
  p_role         text,
  p_moderation   text    default 'active',
  p_require_password_change boolean default true,
  p_process_number text  default null,
  p_area_id        text  default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid      uuid;
  v_area_id  uuid;
  v_app_meta jsonb;
begin
  if public.current_app_role() <> 'SUPER_ADMIN' then
    raise exception 'Acesso negado: requer SUPER_ADMIN';
  end if;

  if p_email is null or trim(p_email) = '' then
    raise exception 'Email e obrigatorio';
  end if;

  if p_password is null or length(p_password) < 8 then
    raise exception 'Password deve ter pelo menos 8 caracteres';
  end if;

  if p_type not in ('student', 'company', 'external', 'admin') then
    raise exception 'Tipo invalido. Valores aceites: student, company, external, admin';
  end if;

  if p_role not in ('SUPER_ADMIN', 'ADMIN_1', 'COMPANY', 'authenticated') then
    raise exception 'Role invalido';
  end if;

  if exists (select 1 from auth.users where email = lower(trim(p_email))) then
    raise exception 'Ja existe um utilizador com este email';
  end if;

  -- Validar e converter area_id (obrigatório para ADMIN_1)
  if p_role = 'ADMIN_1' then
    if p_area_id is null or trim(p_area_id) = '' then
      raise exception 'area_id e obrigatorio para o role ADMIN_1';
    end if;
    begin
      v_area_id := p_area_id::uuid;
    exception when invalid_text_representation then
      raise exception 'area_id tem formato UUID invalido';
    end;
    if not exists (select 1 from public.training_area where id = v_area_id and is_active = true) then
      raise exception 'Area de formacao invalida ou inactiva';
    end if;
  end if;

  v_uid := gen_random_uuid();

  -- Construir app_metadata (role + area_id opcional)
  v_app_meta := jsonb_build_object('role', p_role);
  if v_area_id is not null then
    v_app_meta := v_app_meta || jsonb_build_object('area_id', v_area_id::text);
  end if;

  -- Criar utilizador auth
  insert into auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    aud,
    role
  ) values (
    v_uid,
    '00000000-0000-0000-0000-000000000000',
    lower(trim(p_email)),
    extensions.crypt(p_password, extensions.gen_salt('bf'::text)),
    now(),
    v_app_meta,
    jsonb_build_object(
      'display_name', p_display_name,
      'must_change_password', coalesce(p_require_password_change, true)
    ),
    now(),
    now(),
    'authenticated',
    'authenticated'
  );

  -- Criar perfil (o trigger pode já ter inserido uma linha com type='external')
  insert into public.user_profiles (id, display_name, type, moderation)
  values (
    v_uid,
    p_display_name,
    p_type::public.account_type,
    p_moderation::public.moderation_status
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    type         = excluded.type,
    moderation   = excluded.moderation;

  -- Para alunos: criar registo em student_accounts com número de processo
  if p_type = 'student' and p_process_number is not null and trim(p_process_number) <> '' then
    insert into public.student_accounts (id, process_number)
    values (v_uid, trim(p_process_number))
    on conflict (id) do update set
      process_number = excluded.process_number;
  end if;

  return v_uid;
end;
$$;

-- ============================================================
-- 5) Permissões: somente utilizadores autenticados invocam
-- ============================================================
revoke execute on function public.admin_list_users()                                             from public;
revoke execute on function public.admin_set_user_role(uuid, text)                                from public;
revoke execute on function public.admin_set_user_area(uuid, uuid)                                from public;
revoke execute on function public.admin_create_platform_user(text, text, text, text, text, text, boolean, text, text) from public;

grant execute on function public.admin_list_users()                                              to authenticated;
grant execute on function public.admin_set_user_role(uuid, text)                                 to authenticated;
grant execute on function public.admin_set_user_area(uuid, uuid)                                 to authenticated;
grant execute on function public.admin_create_platform_user(text, text, text, text, text, text, boolean, text, text)  to authenticated;

-- ============================================================
-- 5.1) Garantir artefactos de conta ao alterar tipo (SUPER_ADMIN)
--      Chamado quando o super-admin muda o type de um utilizador existente.
-- ============================================================
create or replace function public.admin_ensure_account_artifacts(
  p_target_uid   uuid,
  p_type         text,
  p_display_name text   default null,
  p_process_number text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_ensured boolean := false;
  v_reason  text    := 'ok';
begin
  if public.current_app_role() <> 'SUPER_ADMIN' then
    raise exception 'Acesso negado: requer SUPER_ADMIN';
  end if;

  if p_target_uid is null then
    return jsonb_build_object('ensured', false, 'reason', 'invalid-input');
  end if;

  if p_type not in ('student', 'company', 'external', 'admin') then
    return jsonb_build_object('ensured', false, 'reason', 'invalid-type');
  end if;

  -- Actualizar o perfil
  update public.user_profiles
  set
    type         = p_type::public.account_type,
    display_name = coalesce(nullif(trim(p_display_name), ''), display_name)
  where id = p_target_uid;

  v_ensured := true;

  -- Para alunos: garantir registo em student_accounts
  if p_type = 'student' then
    if p_process_number is not null and trim(p_process_number) <> '' then
      insert into public.student_accounts (id, process_number)
      values (p_target_uid, trim(p_process_number))
      on conflict (id) do update set
        process_number = excluded.process_number;
    else
      -- Sem número de processo: criar registo mínimo se ainda não existir
      insert into public.student_accounts (id)
      values (p_target_uid)
      on conflict (id) do nothing;
      v_reason := 'student-no-process-number';
    end if;
  end if;

  return jsonb_build_object('ensured', v_ensured, 'reason', v_reason);
end;
$$;

revoke execute on function public.admin_ensure_account_artifacts(uuid, text, text, text) from public;
grant  execute on function public.admin_ensure_account_artifacts(uuid, text, text, text) to authenticated;

-- ============================================================
-- 7) Eliminar utilizador — remove auth + perfil (SUPER_ADMIN)
-- ============================================================
drop function if exists public.admin_delete_user(uuid);
create or replace function public.admin_delete_user(p_uid uuid)
returns void
language plpgsql
security definer
as $$
begin
  if public.current_app_role() <> 'SUPER_ADMIN' then
    raise exception 'Acesso negado: requer SUPER_ADMIN';
  end if;

  if not exists (select 1 from auth.users where id = p_uid) then
    raise exception 'Utilizador nao encontrado';
  end if;

  -- Garante que o admin nao se elimina a si proprio
  if p_uid = auth.uid() then
    raise exception 'Nao e possivel eliminar a propria conta';
  end if;

  -- Remove perfil (CASCADE elimina dados relacionados)
  delete from public.user_profiles where id = p_uid;

  -- Remove da autenticacao
  delete from auth.users where id = p_uid;
end;
$$;

revoke execute on function public.admin_delete_user(uuid) from public;
grant  execute on function public.admin_delete_user(uuid) to authenticated;

-- ============================================================
-- 6) Políticas para moderação de posts por admins
-- ============================================================
drop policy if exists "posts_select_admin" on public.posts;
drop policy if exists "posts_update_admin" on public.posts;

-- Admins vêem todos os posts (incluindo pendentes e rejeitados)
create policy "posts_select_admin"
  on public.posts for select
  to authenticated
  using (
    moderation = 'approved'
    or public.is_admin_user()
  );

-- Admins podem actualizar (moderar) qualquer post
create policy "posts_update_admin"
  on public.posts for update
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- ============================================================
-- Fim
-- ============================================================
