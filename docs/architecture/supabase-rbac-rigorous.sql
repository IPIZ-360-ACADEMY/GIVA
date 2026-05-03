-- ============================================================
-- GIVA IPIZ - RBAC rigoroso (users/courses/classes/docs/jobs/apps)
-- Isolado em schema rbac para não quebrar estruturas legadas.
-- ============================================================

create schema if not exists rbac;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'user_role'
      and n.nspname = 'rbac'
  ) then
    create type rbac.user_role as enum (
      'SUPER_ADMIN',
      'ADMIN',
      'COORDINATOR',
      'TEACHER',
      'STUDENT',
      'COMPANY'
    );
  end if;
end
$$;

create table if not exists rbac.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role rbac.user_role not null,
  created_at timestamptz not null default now()
);

create table if not exists rbac.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  coordinator_id uuid references rbac.users(id) on delete restrict
);

create table if not exists rbac.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  course_id uuid not null references rbac.courses(id) on delete cascade
);

create table if not exists rbac.class_teachers (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references rbac.classes(id) on delete cascade,
  teacher_id uuid not null references rbac.users(id) on delete cascade,
  unique (class_id, teacher_id)
);

create table if not exists rbac.class_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references rbac.classes(id) on delete cascade,
  student_id uuid not null references rbac.users(id) on delete cascade,
  unique (class_id, student_id)
);

create table if not exists rbac.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_url text not null,
  owner_id uuid not null references rbac.users(id) on delete cascade,
  class_id uuid references rbac.classes(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists rbac.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  company_id uuid not null references rbac.users(id) on delete restrict,
  course_id uuid not null references rbac.courses(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists rbac.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references rbac.jobs(id) on delete cascade,
  student_id uuid not null references rbac.users(id) on delete cascade,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  unique (job_id, student_id),
  constraint applications_status_check check (upper(status) in ('PENDING', 'ACCEPTED', 'REJECTED'))
);

create index if not exists idx_rbac_courses_coordinator on rbac.courses(coordinator_id);
create index if not exists idx_rbac_classes_course on rbac.classes(course_id);
create index if not exists idx_rbac_class_teachers_class on rbac.class_teachers(class_id);
create index if not exists idx_rbac_class_teachers_teacher on rbac.class_teachers(teacher_id);
create index if not exists idx_rbac_class_students_class on rbac.class_students(class_id);
create index if not exists idx_rbac_class_students_student on rbac.class_students(student_id);
create index if not exists idx_rbac_documents_owner on rbac.documents(owner_id);
create index if not exists idx_rbac_documents_class on rbac.documents(class_id);
create index if not exists idx_rbac_jobs_company on rbac.jobs(company_id);
create index if not exists idx_rbac_jobs_course on rbac.jobs(course_id);
create index if not exists idx_rbac_applications_job on rbac.applications(job_id);
create index if not exists idx_rbac_applications_student on rbac.applications(student_id);

create or replace function rbac.current_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create or replace function rbac.current_user_role()
returns rbac.user_role
language sql
stable
as $$
  select u.role
  from rbac.users u
  where u.id = auth.uid()
  limit 1;
$$;

create or replace function rbac.is_super_admin()
returns boolean
language sql
stable
as $$
  select
    coalesce(
      (select rbac.current_user_role() = 'SUPER_ADMIN'::rbac.user_role),
      false
    )
    or coalesce(public.current_app_role() = 'SUPER_ADMIN', false);
$$;

create or replace function rbac.is_admin_or_super()
returns boolean
language sql
stable
as $$
  select rbac.is_super_admin() or rbac.current_user_role() = 'ADMIN'::rbac.user_role;
$$;

create or replace function rbac.user_has_role(p_user_id uuid, p_role rbac.user_role)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from rbac.users u
    where u.id = p_user_id
      and u.role = p_role
  );
$$;

create or replace function rbac.is_coordinator_for_course(p_course_id uuid)
returns boolean
language sql
stable
as $$
  select rbac.is_super_admin()
    or rbac.is_admin_or_super()
    or exists (
      select 1
      from rbac.courses c
      where c.id = p_course_id
        and c.coordinator_id = auth.uid()
    );
$$;

create or replace function rbac.is_teacher_for_class(p_class_id uuid)
returns boolean
language sql
stable
as $$
  select rbac.is_super_admin()
    or rbac.is_admin_or_super()
    or exists (
      select 1
      from rbac.class_teachers ct
      where ct.class_id = p_class_id
        and ct.teacher_id = auth.uid()
    );
$$;

create or replace function rbac.is_student_in_course(p_course_id uuid, p_student_id uuid default auth.uid())
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from rbac.class_students cs
    join rbac.classes cl on cl.id = cs.class_id
    where cl.course_id = p_course_id
      and cs.student_id = p_student_id
  );
$$;

create or replace function rbac.can_access_class(p_class_id uuid)
returns boolean
language sql
stable
as $$
  select
    rbac.is_super_admin()
    or rbac.is_admin_or_super()
    or rbac.is_teacher_for_class(p_class_id)
    or exists (
      select 1
      from rbac.classes cl
      join rbac.courses c on c.id = cl.course_id
      where cl.id = p_class_id
        and c.coordinator_id = auth.uid()
    );
$$;

create or replace function rbac.can_student_apply(p_job_id uuid, p_student_id uuid default auth.uid())
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from rbac.jobs j
    where j.id = p_job_id
      and rbac.is_student_in_course(j.course_id, p_student_id)
  );
$$;

create or replace function rbac.prevent_self_role_change()
returns trigger
language plpgsql
as $$
begin
  if old.role is distinct from new.role then
    if not rbac.is_super_admin() then
      raise exception 'Role nao pode ser alterado diretamente';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rbac_prevent_self_role_change on rbac.users;
create trigger trg_rbac_prevent_self_role_change
before update on rbac.users
for each row execute function rbac.prevent_self_role_change();

create or replace function rbac.assign_course_coordinator(p_course_id uuid, p_coordinator_id uuid)
returns rbac.courses
language plpgsql
security definer
as $$
declare
  v_course rbac.courses;
begin
  if not rbac.is_admin_or_super() then
    raise exception 'Acesso negado';
  end if;

  if not rbac.user_has_role(p_coordinator_id, 'COORDINATOR'::rbac.user_role) then
    raise exception 'Utilizador nao possui role COORDINATOR';
  end if;

  update rbac.courses
  set coordinator_id = p_coordinator_id
  where id = p_course_id
  returning * into v_course;

  if v_course.id is null then
    raise exception 'Curso nao encontrado';
  end if;

  return v_course;
end;
$$;

create or replace function rbac.assign_teacher_to_class(p_class_id uuid, p_teacher_id uuid)
returns rbac.class_teachers
language plpgsql
security definer
as $$
declare
  v_row rbac.class_teachers;
begin
  if not rbac.is_admin_or_super() and not rbac.is_coordinator_for_course((select course_id from rbac.classes where id = p_class_id)) then
    raise exception 'Acesso negado';
  end if;

  if not rbac.user_has_role(p_teacher_id, 'TEACHER'::rbac.user_role) then
    raise exception 'Utilizador nao possui role TEACHER';
  end if;

  insert into rbac.class_teachers (class_id, teacher_id)
  values (p_class_id, p_teacher_id)
  on conflict (class_id, teacher_id) do update set teacher_id = excluded.teacher_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function rbac.enroll_student_in_class(p_class_id uuid, p_student_id uuid)
returns rbac.class_students
language plpgsql
security definer
as $$
declare
  v_row rbac.class_students;
begin
  if not rbac.is_admin_or_super() and not rbac.can_access_class(p_class_id) then
    raise exception 'Acesso negado';
  end if;

  if not rbac.user_has_role(p_student_id, 'STUDENT'::rbac.user_role) then
    raise exception 'Utilizador nao possui role STUDENT';
  end if;

  insert into rbac.class_students (class_id, student_id)
  values (p_class_id, p_student_id)
  on conflict (class_id, student_id) do update set student_id = excluded.student_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function rbac.create_application(p_job_id uuid, p_student_id uuid default auth.uid())
returns rbac.applications
language plpgsql
security definer
as $$
declare
  v_app rbac.applications;
begin
  if p_student_id is null then
    raise exception 'Aluno invalido';
  end if;

  if p_student_id <> auth.uid() and not rbac.is_admin_or_super() then
    raise exception 'Acesso negado';
  end if;

  if not rbac.user_has_role(p_student_id, 'STUDENT'::rbac.user_role) then
    raise exception 'Apenas STUDENT pode candidatar-se';
  end if;

  if not rbac.can_student_apply(p_job_id, p_student_id) then
    raise exception 'Aluno nao pertence ao curso da vaga';
  end if;

  insert into rbac.applications (job_id, student_id, status)
  values (p_job_id, p_student_id, 'PENDING')
  on conflict (job_id, student_id) do update
    set status = excluded.status
  returning * into v_app;

  return v_app;
end;
$$;

create or replace function rbac.evaluate_application(p_application_id uuid, p_status text)
returns rbac.applications
language plpgsql
security definer
as $$
declare
  v_app rbac.applications;
  v_job_company uuid;
  v_status text;
begin
  v_status := upper(trim(coalesce(p_status, '')));
  if v_status not in ('PENDING', 'ACCEPTED', 'REJECTED') then
    raise exception 'Status invalido';
  end if;

  select j.company_id
  into v_job_company
  from rbac.applications a
  join rbac.jobs j on j.id = a.job_id
  where a.id = p_application_id;

  if not found then
    raise exception 'Candidatura nao encontrada';
  end if;

  if not rbac.is_admin_or_super() and v_job_company <> auth.uid() then
    raise exception 'Acesso negado';
  end if;

  update rbac.applications
  set status = v_status
  where id = p_application_id
  returning * into v_app;

  return v_app;
end;
$$;

grant usage on schema rbac to authenticated;
grant select, insert, update, delete on all tables in schema rbac to authenticated;
grant execute on all functions in schema rbac to authenticated;

alter table rbac.users enable row level security;
alter table rbac.courses enable row level security;
alter table rbac.classes enable row level security;
alter table rbac.class_teachers enable row level security;
alter table rbac.class_students enable row level security;
alter table rbac.documents enable row level security;
alter table rbac.jobs enable row level security;
alter table rbac.applications enable row level security;

-- users
create policy "rbac_users_select_scoped" on rbac.users
for select using (
  rbac.is_admin_or_super() or id = auth.uid()
);

create policy "rbac_users_insert_admin" on rbac.users
for insert with check (
  rbac.is_admin_or_super()
);

create policy "rbac_users_update_scoped" on rbac.users
for update using (
  rbac.is_admin_or_super() or id = auth.uid()
)
with check (
  rbac.is_admin_or_super() or id = auth.uid()
);

-- courses
create policy "rbac_courses_select_scoped" on rbac.courses
for select using (
  rbac.is_admin_or_super()
  or coordinator_id = auth.uid()
  or exists (
    select 1
    from rbac.classes cl
    join rbac.class_teachers ct on ct.class_id = cl.id
    where cl.course_id = courses.id
      and ct.teacher_id = auth.uid()
  )
  or rbac.is_student_in_course(courses.id, auth.uid())
);

create policy "rbac_courses_insert_admin" on rbac.courses
for insert with check (rbac.is_admin_or_super());

create policy "rbac_courses_update_admin" on rbac.courses
for update using (rbac.is_admin_or_super())
with check (rbac.is_admin_or_super());

create policy "rbac_courses_delete_admin" on rbac.courses
for delete using (rbac.is_admin_or_super());

-- classes
create policy "rbac_classes_select_scoped" on rbac.classes
for select using (
  rbac.can_access_class(id)
  or exists (
    select 1
    from rbac.class_students cs
    where cs.class_id = classes.id
      and cs.student_id = auth.uid()
  )
);

create policy "rbac_classes_insert_scoped" on rbac.classes
for insert with check (
  rbac.is_admin_or_super() or rbac.is_coordinator_for_course(course_id)
);

create policy "rbac_classes_update_scoped" on rbac.classes
for update using (
  rbac.is_admin_or_super() or rbac.can_access_class(id)
)
with check (
  rbac.is_admin_or_super() or rbac.is_coordinator_for_course(course_id)
);

create policy "rbac_classes_delete_scoped" on rbac.classes
for delete using (
  rbac.is_admin_or_super() or rbac.can_access_class(id)
);

-- class_teachers
create policy "rbac_class_teachers_select_scoped" on rbac.class_teachers
for select using (
  rbac.can_access_class(class_id)
  or teacher_id = auth.uid()
);

create policy "rbac_class_teachers_insert_scoped" on rbac.class_teachers
for insert with check (
  (rbac.is_admin_or_super() or rbac.can_access_class(class_id))
  and rbac.user_has_role(teacher_id, 'TEACHER'::rbac.user_role)
);

create policy "rbac_class_teachers_update_scoped" on rbac.class_teachers
for update using (
  rbac.is_admin_or_super() or rbac.can_access_class(class_id)
)
with check (
  (rbac.is_admin_or_super() or rbac.can_access_class(class_id))
  and rbac.user_has_role(teacher_id, 'TEACHER'::rbac.user_role)
);

create policy "rbac_class_teachers_delete_scoped" on rbac.class_teachers
for delete using (
  rbac.is_admin_or_super() or rbac.can_access_class(class_id)
);

-- class_students
create policy "rbac_class_students_select_scoped" on rbac.class_students
for select using (
  rbac.can_access_class(class_id)
  or student_id = auth.uid()
);

create policy "rbac_class_students_insert_scoped" on rbac.class_students
for insert with check (
  (rbac.is_admin_or_super() or rbac.can_access_class(class_id))
  and rbac.user_has_role(student_id, 'STUDENT'::rbac.user_role)
);

create policy "rbac_class_students_update_scoped" on rbac.class_students
for update using (
  rbac.is_admin_or_super() or rbac.can_access_class(class_id)
)
with check (
  (rbac.is_admin_or_super() or rbac.can_access_class(class_id))
  and rbac.user_has_role(student_id, 'STUDENT'::rbac.user_role)
);

create policy "rbac_class_students_delete_scoped" on rbac.class_students
for delete using (
  rbac.is_admin_or_super() or rbac.can_access_class(class_id)
);

-- documents
create policy "rbac_documents_select_scoped" on rbac.documents
for select using (
  rbac.is_admin_or_super()
  or (
    class_id is null
    and owner_id = auth.uid()
  )
  or (
    class_id is not null
    and (
      rbac.is_teacher_for_class(class_id)
      or exists (
        select 1
        from rbac.classes cl
        join rbac.courses c on c.id = cl.course_id
        where cl.id = documents.class_id
          and c.coordinator_id = auth.uid()
      )
    )
  )
);

create policy "rbac_documents_insert_scoped" on rbac.documents
for insert with check (
  rbac.is_admin_or_super()
  or (
    owner_id = auth.uid()
    and (
      class_id is null
      or rbac.can_access_class(class_id)
    )
  )
);

create policy "rbac_documents_update_scoped" on rbac.documents
for update using (
  rbac.is_admin_or_super()
  or owner_id = auth.uid()
  or (class_id is not null and rbac.can_access_class(class_id))
)
with check (
  rbac.is_admin_or_super()
  or owner_id = auth.uid()
  or (class_id is not null and rbac.can_access_class(class_id))
);

create policy "rbac_documents_delete_scoped" on rbac.documents
for delete using (
  rbac.is_admin_or_super()
  or owner_id = auth.uid()
  or (class_id is not null and rbac.can_access_class(class_id))
);

-- jobs
create policy "rbac_jobs_select_scoped" on rbac.jobs
for select using (
  rbac.is_admin_or_super()
  or company_id = auth.uid()
  or rbac.is_student_in_course(course_id, auth.uid())
  or exists (
    select 1
    from rbac.courses c
    where c.id = jobs.course_id
      and c.coordinator_id = auth.uid()
  )
  or exists (
    select 1
    from rbac.classes cl
    join rbac.class_teachers ct on ct.class_id = cl.id
    where cl.course_id = jobs.course_id
      and ct.teacher_id = auth.uid()
  )
);

create policy "rbac_jobs_insert_scoped" on rbac.jobs
for insert with check (
  rbac.is_admin_or_super()
  or (
    company_id = auth.uid()
    and rbac.user_has_role(auth.uid(), 'COMPANY'::rbac.user_role)
  )
);

create policy "rbac_jobs_update_scoped" on rbac.jobs
for update using (
  rbac.is_admin_or_super() or company_id = auth.uid()
)
with check (
  rbac.is_admin_or_super() or company_id = auth.uid()
);

create policy "rbac_jobs_delete_scoped" on rbac.jobs
for delete using (
  rbac.is_admin_or_super() or company_id = auth.uid()
);

-- applications
create policy "rbac_applications_select_scoped" on rbac.applications
for select using (
  rbac.is_admin_or_super()
  or student_id = auth.uid()
  or exists (
    select 1
    from rbac.jobs j
    where j.id = applications.job_id
      and j.company_id = auth.uid()
  )
);

create policy "rbac_applications_insert_scoped" on rbac.applications
for insert with check (
  student_id = auth.uid()
  and rbac.user_has_role(student_id, 'STUDENT'::rbac.user_role)
  and rbac.can_student_apply(job_id, student_id)
);

create policy "rbac_applications_update_scoped" on rbac.applications
for update using (
  rbac.is_admin_or_super()
  or exists (
    select 1
    from rbac.jobs j
    where j.id = applications.job_id
      and j.company_id = auth.uid()
  )
  or student_id = auth.uid()
)
with check (
  rbac.is_admin_or_super()
  or exists (
    select 1
    from rbac.jobs j
    where j.id = applications.job_id
      and j.company_id = auth.uid()
  )
  or student_id = auth.uid()
);

create policy "rbac_applications_delete_scoped" on rbac.applications
for delete using (
  rbac.is_admin_or_super() or student_id = auth.uid()
);
