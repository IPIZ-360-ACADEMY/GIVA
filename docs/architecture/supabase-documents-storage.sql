insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  true,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "documents_storage_select" on storage.objects;
drop policy if exists "documents_storage_insert" on storage.objects;
drop policy if exists "documents_storage_update" on storage.objects;
drop policy if exists "documents_storage_delete" on storage.objects;

create policy "documents_storage_select" on storage.objects
for select to authenticated
using (
  bucket_id = 'documents'
  and (
    public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
    or public.has_cross_area_scope()
    or split_part(name, '/', 1) = public.current_area_id()::text
  )
);

create policy "documents_storage_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'documents'
  and (
    public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
    or public.has_cross_area_scope()
    or split_part(name, '/', 1) = public.current_area_id()::text
  )
);

create policy "documents_storage_update" on storage.objects
for update to authenticated
using (
  bucket_id = 'documents'
  and (
    public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
    or public.has_cross_area_scope()
    or split_part(name, '/', 1) = public.current_area_id()::text
  )
)
with check (
  bucket_id = 'documents'
  and (
    public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
    or public.has_cross_area_scope()
    or split_part(name, '/', 1) = public.current_area_id()::text
  )
);

create policy "documents_storage_delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'documents'
  and (
    public.current_app_role() in ('SUPER_ADMIN', 'ADMIN_1')
    or public.has_cross_area_scope()
    or split_part(name, '/', 1) = public.current_area_id()::text
  )
);