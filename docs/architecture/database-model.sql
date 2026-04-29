-- SGEIP v2.0 - Modelo base PostgreSQL (referencia)

create table area (
  id uuid primary key,
  code varchar(16) unique not null,
  name varchar(80) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table app_user (
  id uuid primary key,
  email varchar(160) unique not null,
  password_hash text not null,
  display_name varchar(120) not null,
  role varchar(24) not null,
  area_id uuid references area(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table course (
  id uuid primary key,
  area_id uuid not null references area(id),
  name varchar(120) not null,
  created_at timestamptz not null default now()
);

create table class_group (
  id uuid primary key,
  area_id uuid not null references area(id),
  course_id uuid not null references course(id),
  academic_year int not null,
  status varchar(16) not null check (status in ('ACTIVE', 'ARCHIVED')),
  created_at timestamptz not null default now(),
  unique(course_id, academic_year, status)
);

create table student (
  id uuid primary key,
  area_id uuid not null references area(id),
  class_group_id uuid not null references class_group(id),
  full_name varchar(140) not null,
  email varchar(160),
  state varchar(16) not null check (state in ('PENDING', 'ACTIVE', 'EXPIRED', 'ARCHIVED')),
  activation_date timestamptz,
  expiration_date timestamptz,
  created_at timestamptz not null default now()
);

create table internship (
  id uuid primary key,
  area_id uuid not null references area(id),
  student_id uuid not null references student(id),
  company_name varchar(140) not null,
  status varchar(24) not null,
  started_at timestamptz,
  expected_end_at timestamptz,
  created_at timestamptz not null default now()
);

create table document (
  id uuid primary key,
  area_id uuid not null references area(id),
  course_id uuid references course(id),
  title varchar(180) not null,
  file_url text not null,
  mime_type varchar(120) not null,
  file_size_bytes bigint not null,
  academic_year int,
  uploaded_by uuid not null references app_user(id),
  version int not null default 1,
  created_at timestamptz not null default now()
);

create table approval_request (
  id uuid primary key,
  area_id uuid not null references area(id),
  requested_by uuid not null references app_user(id),
  approved_by uuid references app_user(id),
  action varchar(80) not null,
  resource varchar(80) not null,
  resource_id uuid,
  status varchar(20) not null check (status in ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXECUTED')),
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table audit_event (
  id bigserial primary key,
  correlation_id uuid not null,
  area_id uuid references area(id),
  actor_id uuid references app_user(id),
  role varchar(24) not null,
  action varchar(100) not null,
  resource varchar(80) not null,
  resource_id uuid,
  status varchar(24) not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_event_created_at on audit_event(created_at desc);
create index idx_audit_event_actor on audit_event(actor_id, created_at desc);
create index idx_audit_event_area on audit_event(area_id, created_at desc);
create index idx_audit_event_action on audit_event(action, created_at desc);
