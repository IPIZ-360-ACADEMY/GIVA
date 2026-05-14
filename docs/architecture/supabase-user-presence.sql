-- Presença real para a comunidade GIVA/IPIZ.
-- Esta tabela guarda o último contacto activo de cada utilizador autenticado.

create table if not exists public.user_presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  status text not null default 'online',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_presence_status_check check (status in ('online', 'offline'))
);

create or replace function public.touch_user_presence_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_presence_updated_at on public.user_presence;
create trigger trg_user_presence_updated_at
before update on public.user_presence
for each row
execute function public.touch_user_presence_updated_at();

alter table public.user_presence enable row level security;

drop policy if exists "presence_select_authenticated" on public.user_presence;
create policy "presence_select_authenticated"
on public.user_presence
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "presence_write_own_row" on public.user_presence;
create policy "presence_insert_own_row"
on public.user_presence
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "presence_update_own_row" on public.user_presence;
create policy "presence_update_own_row"
on public.user_presence
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter publication supabase_realtime add table public.user_presence;