-- 010_product_images_and_collages.sql
-- Phase 3d: private storage for the product images you upload, and the weekly-collage setting.
-- Safe to run more than once.

-- 1) Private bucket (only created on Supabase, where the storage schema exists).
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('product-images', 'product-images', false, 5242880, array['image/jpeg','image/png','image/webp'])
    on conflict (id) do nothing;

    -- Files live under <org_id>/<product_id>/<file>. Members can read, editors and above can add or remove.
    drop policy if exists product_images_select on storage.objects;
    create policy product_images_select on storage.objects for select to authenticated
      using (
        bucket_id = 'product-images'
        and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
        and app.is_member(((storage.foldername(name))[1])::uuid)
      );

    drop policy if exists product_images_insert on storage.objects;
    create policy product_images_insert on storage.objects for insert to authenticated
      with check (
        bucket_id = 'product-images'
        and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
        and app.has_role(((storage.foldername(name))[1])::uuid, array['owner','admin','editor'])
      );

    drop policy if exists product_images_delete on storage.objects;
    create policy product_images_delete on storage.objects for delete to authenticated
      using (
        bucket_id = 'product-images'
        and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
        and app.has_role(((storage.foldername(name))[1])::uuid, array['owner','admin','editor'])
      );
  end if;
end $$;

-- 2) Weekly collage setting for existing workspaces.
insert into public.settings (org_id, key, value, is_default, description)
select id, 'collage.weekly_enabled', 'true', true, 'DEFAULT: build a "top 5" collage package automatically the first time you open the app each week.'
from public.organizations
on conflict (org_id, key) do nothing;
