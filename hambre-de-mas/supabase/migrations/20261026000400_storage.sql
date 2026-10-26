-- Hambre de Más · almacenamiento de imágenes de producto
--
-- Bucket público de lectura (las fotos se sirven por URL pública); solo los
-- administradores pueden subir, sustituir o borrar archivos.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Admin sube imágenes de producto" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and (select public.is_admin()));

create policy "Admin actualiza imágenes de producto" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()))
  with check (bucket_id = 'product-images' and (select public.is_admin()));

create policy "Admin borra imágenes de producto" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));

-- Necesaria para listar/sobrescribir desde el panel con la sesión del admin.
create policy "Admin lista imágenes de producto" on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));
