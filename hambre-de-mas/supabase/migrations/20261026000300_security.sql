-- Hambre de Más · permisos y Row Level Security
--
-- Regla general: el navegador solo usa la clave anónima y la sesión del
-- usuario, así que todo lo que no esté permitido aquí es imposible desde el
-- cliente aunque alguien manipule el JavaScript. Las operaciones delicadas
-- (crear pedidos, confirmar pagos) solo las ejecuta el servidor con la
-- service role, que nunca se expone al navegador.

-- ---------------------------------------------------------------------------
-- Permisos de tabla (explícitos, sin depender de los privilegios por defecto)
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Catálogo: lectura pública, escritura de administradores (RLS).
grant select on public.categories, public.products, public.product_images, public.product_variants
  to anon, authenticated;
grant insert, update, delete on public.categories, public.products, public.product_images
  to authenticated;
grant insert, delete on public.product_variants to authenticated;
-- El stock solo se cambia con admin_set_stock (queda registrado) o con los pedidos.
grant update (sku, name, price_cents, compare_at_price_cents, is_active, position)
  on public.product_variants to authenticated;

grant select on public.inventory_movements to authenticated;
grant select, insert, update, delete on public.promotions to authenticated;

-- Perfiles: cada cliente puede editar sus datos, nunca su rol.
grant select on public.profiles to authenticated;
grant update (full_name, phone, marketing_opt_in) on public.profiles to authenticated;

grant select, insert, update, delete on public.addresses to authenticated;

-- Pedidos: lectura del propio pedido; los admin solo actualizan el envío.
grant select on public.orders, public.order_items, public.order_events to authenticated;
grant update (fulfillment_status, tracking_carrier, tracking_number, tracking_url, admin_notes)
  on public.orders to authenticated;

-- Opiniones: lectura pública de las aprobadas; los compradores escriben las suyas.
grant select on public.reviews to anon, authenticated;
grant insert (product_id, rating, title, body, author_name) on public.reviews to authenticated;
grant update (status) on public.reviews to authenticated;
grant delete on public.reviews to authenticated;

grant select, delete on public.newsletter_subscribers to authenticated;

-- Funciones que puede llamar el navegador.
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.has_purchased(uuid) to authenticated;
grant execute on function public.admin_set_stock(uuid, integer) to authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;

-- Funciones solo para el servidor (service role).
revoke execute on function public.create_order(jsonb) from public, anon, authenticated;
revoke execute on function public.mark_order_paid(uuid, text, text, integer, text) from public, anon, authenticated;
revoke execute on function public.release_order(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.expire_stale_orders() from public, anon, authenticated;
revoke execute on function public.mark_order_refunded(text, integer, boolean) from public, anon, authenticated;

-- Funciones de trigger: nadie las llama directamente.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.promotions enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.stripe_events enable row level security;
alter table public.reviews enable row level security;
alter table public.newsletter_subscribers enable row level security;

-- Perfiles
create policy "Cada usuario ve su perfil" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "Cada usuario edita su perfil" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Categorías
create policy "Categorías publicadas visibles" on public.categories
  for select to anon, authenticated
  using (is_published or (select public.is_admin()));

create policy "Admin gestiona categorías" on public.categories
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Productos
create policy "Productos publicados visibles" on public.products
  for select to anon, authenticated
  using (status = 'published' or (select public.is_admin()));

create policy "Admin gestiona productos" on public.products
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Imágenes de productos publicados visibles" on public.product_images
  for select to anon, authenticated
  using (
    exists (select 1 from public.products p where p.id = product_id and p.status = 'published')
    or (select public.is_admin())
  );

create policy "Admin gestiona imágenes" on public.product_images
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Variantes de productos publicados visibles" on public.product_variants
  for select to anon, authenticated
  using (
    exists (select 1 from public.products p where p.id = product_id and p.status = 'published')
    or (select public.is_admin())
  );

create policy "Admin gestiona variantes" on public.product_variants
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admin ve movimientos de inventario" on public.inventory_movements
  for select to authenticated
  using ((select public.is_admin()));

-- Promociones: los códigos solo los valida el servidor.
create policy "Admin gestiona promociones" on public.promotions
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Direcciones
create policy "Cada usuario gestiona sus direcciones" on public.addresses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Admin ve direcciones" on public.addresses
  for select to authenticated
  using ((select public.is_admin()));

-- Pedidos
create policy "Cada cliente ve sus pedidos" on public.orders
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Admin actualiza el envío" on public.orders
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Líneas de pedidos visibles" on public.order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.user_id = (select auth.uid()) or (select public.is_admin()))
    )
  );

create policy "Historial de pedidos visible" on public.order_events
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );

-- stripe_events: sin políticas, solo la service role.

-- Opiniones
create policy "Opiniones aprobadas visibles" on public.reviews
  for select to anon, authenticated
  using (status = 'approved' or user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Compradores escriben opiniones" on public.reviews
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.has_purchased(product_id)));

create policy "Admin modera opiniones" on public.reviews
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Autor o admin borran opiniones" on public.reviews
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Newsletter: las altas las hace el servidor; los admin consultan y borran.
create policy "Admin gestiona newsletter" on public.newsletter_subscribers
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
