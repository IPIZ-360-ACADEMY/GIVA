-- Run in Supabase SQL Editor as admin
-- Replace emails/UUIDs with your real values.

-- 1) Ensure each app user has app_metadata.role and app_metadata.area_id.
-- 2) Optional: add scopes = ['cross_area'] for users that can see all areas.

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object(
    'role', 'SUPER_ADMIN',
    'area_id', '11111111-1111-1111-1111-111111111111',
    'scopes', jsonb_build_array('cross_area')
  )
where email = 'admin@giva.ao';

-- Verify
select
  email,
  raw_app_meta_data ->> 'role' as role,
  raw_app_meta_data ->> 'area_id' as area_id,
  raw_app_meta_data -> 'scopes' as scopes
from auth.users
order by created_at desc;
