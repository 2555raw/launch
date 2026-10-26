-- Hambre de Más · funciones y triggers
--
-- Las funciones security definer fijan search_path = '' y califican todos los
-- nombres para que nadie pueda secuestrarlas con objetos en otro esquema.

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger categories_touch before update on public.categories
  for each row execute function public.touch_updated_at();
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
create trigger product_variants_touch before update on public.product_variants
  for each row execute function public.touch_updated_at();
create trigger promotions_touch before update on public.promotions
  for each row execute function public.touch_updated_at();
create trigger addresses_touch before update on public.addresses
  for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();
create trigger reviews_touch before update on public.reviews
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Perfiles: se crean solos al registrarse
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------

-- Texto normalizado (minúsculas, sin tildes) para la búsqueda.
create or replace function public.products_search_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_text := lower(extensions.unaccent(
    'extensions.unaccent'::regdictionary,
    concat_ws(' ', new.name, new.subtitle, new.description, array_to_string(new.tags, ' '))
  ));
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger products_search_text
  before insert or update of name, subtitle, description, tags, status on public.products
  for each row execute function public.products_search_text();

-- El precio "desde" del producto es el de su variante activa más barata, y su
-- stock total la suma de las variantes activas.
create or replace function public.sync_product_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := case when tg_op = 'DELETE' then old.product_id else new.product_id end;
  v_price integer;
  v_compare integer;
  v_stock integer;
begin
  select pv.price_cents, pv.compare_at_price_cents
  into v_price, v_compare
  from public.product_variants pv
  where pv.product_id = target and pv.is_active
  order by pv.price_cents asc, pv.position asc
  limit 1;

  select coalesce(sum(pv.stock), 0)::integer into v_stock
  from public.product_variants pv
  where pv.product_id = target and pv.is_active;

  update public.products
  set price_cents = coalesce(v_price, 0),
      compare_at_price_cents = v_compare,
      total_stock = v_stock
  where id = target;
  return null;
end;
$$;

create trigger product_variants_sync_price
  after insert or update of price_cents, compare_at_price_cents, is_active, product_id, stock or delete
  on public.product_variants
  for each row execute function public.sync_product_price();

-- Todo cambio de stock queda registrado. Las funciones de pedidos indican el
-- motivo con set_config('app.stock_reason', ...) dentro de la transacción.
create or replace function public.log_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reason text := coalesce(nullif(current_setting('app.stock_reason', true), ''), 'manual');
  order_ref uuid := nullif(current_setting('app.order_id', true), '')::uuid;
begin
  if tg_op = 'INSERT' then
    if new.stock <> 0 then
      insert into public.inventory_movements (variant_id, delta, stock_after, reason, created_by)
      values (new.id, new.stock, new.stock, 'initial', (select auth.uid()));
    end if;
  elsif new.stock is distinct from old.stock then
    insert into public.inventory_movements (variant_id, delta, stock_after, reason, order_id, created_by)
    values (new.id, new.stock - old.stock, new.stock, reason, order_ref, (select auth.uid()));
  end if;
  return null;
end;
$$;

create trigger product_variants_log_stock
  after insert or update of stock on public.product_variants
  for each row execute function public.log_stock_movement();

-- ---------------------------------------------------------------------------
-- Direcciones: una sola predeterminada por usuario
-- ---------------------------------------------------------------------------

create or replace function public.addresses_single_default()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_default then
    update public.addresses
    set is_default = false
    where user_id = new.user_id and id <> new.id and is_default;
  end if;
  return new;
end;
$$;

create trigger addresses_single_default
  before insert or update of is_default on public.addresses
  for each row execute function public.addresses_single_default();

-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------

-- Crea un pedido pendiente y reserva el stock en una sola transacción.
--
-- La aplicación calcula el presupuesto con precios leídos en el servidor y lo
-- pasa aquí; esta función vuelve a comprobar, con las filas bloqueadas, que
-- cada precio sigue siendo el mismo, que hay stock y que la promoción es
-- válida. Si algo no cuadra, aborta sin dejar nada a medias.
--
-- Solo la puede ejecutar la service role (el servidor de la tienda).
create or replace function public.create_order(p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid := gen_random_uuid();
  v_number bigint;
  v_item record;
  v_subtotal integer := 0;
  v_promo public.promotions%rowtype;
  v_promo_id uuid := nullif(p_order ->> 'promotion_id', '')::uuid;
begin
  if jsonb_typeof(p_order -> 'items') <> 'array' or jsonb_array_length(p_order -> 'items') = 0 then
    raise exception 'empty_cart' using errcode = 'P0001';
  end if;

  if v_promo_id is not null then
    select * into v_promo from public.promotions where id = v_promo_id for update;
    if not found
      or not v_promo.is_active
      or (v_promo.starts_at is not null and v_promo.starts_at > now())
      or (v_promo.ends_at is not null and v_promo.ends_at <= now())
      or (v_promo.max_redemptions is not null and v_promo.times_redeemed >= v_promo.max_redemptions)
    then
      raise exception 'promotion_invalid' using errcode = 'P0001';
    end if;
  end if;

  perform set_config('app.stock_reason', 'order', true);
  perform set_config('app.order_id', v_order_id::text, true);

  insert into public.orders (
    id, user_id, email, customer_name, phone, shipping_address,
    subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
    promotion_id, promotion_code, expires_at
  ) values (
    v_order_id,
    nullif(p_order ->> 'user_id', '')::uuid,
    lower(p_order ->> 'email'),
    p_order ->> 'customer_name',
    nullif(p_order ->> 'phone', ''),
    p_order -> 'shipping_address',
    (p_order ->> 'subtotal_cents')::integer,
    (p_order ->> 'discount_cents')::integer,
    (p_order ->> 'shipping_cents')::integer,
    (p_order ->> 'tax_cents')::integer,
    (p_order ->> 'total_cents')::integer,
    v_promo_id,
    case when v_promo_id is not null then v_promo.code end,
    coalesce((p_order ->> 'expires_at')::timestamptz, now() + interval '35 minutes')
  )
  returning number into v_number;

  -- Agrupa por variante y bloquea en orden de id para evitar interbloqueos
  -- entre dos compras simultáneas.
  for v_item in
    with requested as (
      select (i ->> 'variant_id')::uuid as variant_id,
             sum((i ->> 'quantity')::integer)::integer as quantity,
             min((i ->> 'unit_price_cents')::integer) as min_price,
             max((i ->> 'unit_price_cents')::integer) as max_price
      from jsonb_array_elements(p_order -> 'items') as i
      group by 1
    )
    select r.variant_id, r.quantity, r.min_price, r.max_price,
           v.price_cents, v.stock, v.is_active, v.name as variant_name, v.sku,
           p.id as product_id, p.name as product_name, p.slug as product_slug,
           p.status as product_status, p.tax_rate_bps,
           (select pi.url from public.product_images pi
             where pi.product_id = p.id order by pi.position, pi.created_at limit 1) as image_url
    from requested r
    left join public.product_variants v on v.id = r.variant_id
    left join public.products p on p.id = v.product_id
    order by r.variant_id
  loop
    if v_item.price_cents is null then
      raise exception 'variant_not_found' using errcode = 'P0001', detail = v_item.variant_id::text;
    end if;

    -- Bloquea la fila de la variante hasta el final de la transacción.
    perform 1 from public.product_variants where id = v_item.variant_id for update;
    select stock, price_cents, is_active into v_item.stock, v_item.price_cents, v_item.is_active
    from public.product_variants where id = v_item.variant_id;

    if not v_item.is_active or v_item.product_status <> 'published' then
      raise exception 'variant_unavailable' using errcode = 'P0001', detail = v_item.variant_id::text;
    end if;
    if v_item.quantity < 1 or v_item.quantity > 99 then
      raise exception 'invalid_quantity' using errcode = 'P0001', detail = v_item.variant_id::text;
    end if;
    if v_item.min_price <> v_item.price_cents or v_item.max_price <> v_item.price_cents then
      raise exception 'price_changed' using errcode = 'P0001', detail = v_item.variant_id::text;
    end if;
    if v_item.stock < v_item.quantity then
      raise exception 'insufficient_stock' using errcode = 'P0001', detail = v_item.variant_id::text;
    end if;

    update public.product_variants
    set stock = stock - v_item.quantity
    where id = v_item.variant_id;

    insert into public.order_items (
      order_id, product_id, variant_id, product_name, product_slug, variant_name, sku,
      image_url, unit_price_cents, quantity, tax_rate_bps, line_total_cents
    ) values (
      v_order_id, v_item.product_id, v_item.variant_id, v_item.product_name, v_item.product_slug,
      v_item.variant_name, v_item.sku, v_item.image_url, v_item.price_cents, v_item.quantity,
      v_item.tax_rate_bps, v_item.price_cents * v_item.quantity
    );

    v_subtotal := v_subtotal + v_item.price_cents * v_item.quantity;
  end loop;

  if v_subtotal <> (p_order ->> 'subtotal_cents')::integer then
    raise exception 'subtotal_mismatch' using errcode = 'P0001';
  end if;

  if v_promo_id is not null and v_subtotal < v_promo.min_subtotal_cents then
    raise exception 'promotion_invalid' using errcode = 'P0001';
  end if;

  insert into public.order_events (order_id, kind, message)
  values (v_order_id, 'created', 'Pedido creado y stock reservado');

  return jsonb_build_object('id', v_order_id, 'number', v_number);
end;
$$;

-- Marca un pedido como pagado. Es idempotente: se puede llamar desde el
-- webhook y desde la página de confirmación sin duplicar nada.
create or replace function public.mark_order_paid(
  p_order_id uuid,
  p_session_id text,
  p_payment_intent_id text,
  p_amount_total integer,
  p_currency text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;

  if v_order.status in ('paid', 'refunded') then
    return 'already_paid';
  end if;

  if v_order.stripe_checkout_session_id is not null
     and v_order.stripe_checkout_session_id <> p_session_id then
    insert into public.order_events (order_id, kind, message, data)
    values (p_order_id, 'review', 'Pago recibido desde una sesión de Stripe distinta',
            jsonb_build_object('session_id', p_session_id));
    update public.orders set status = 'requires_review', stripe_payment_intent_id = p_payment_intent_id
    where id = p_order_id;
    return 'requires_review';
  end if;

  if p_amount_total <> v_order.total_cents or lower(p_currency) <> v_order.currency then
    insert into public.order_events (order_id, kind, message, data)
    values (p_order_id, 'review', 'El importe cobrado no coincide con el del pedido',
            jsonb_build_object('charged', p_amount_total, 'expected', v_order.total_cents, 'currency', p_currency));
    update public.orders set status = 'requires_review', stripe_payment_intent_id = p_payment_intent_id
    where id = p_order_id;
    return 'requires_review';
  end if;

  if v_order.status <> 'pending' then
    -- Llega un pago para un pedido cancelado o caducado (su stock ya se liberó).
    insert into public.order_events (order_id, kind, message, data)
    values (p_order_id, 'review', 'Pago recibido para un pedido que ya no estaba pendiente',
            jsonb_build_object('previous_status', v_order.status));
    update public.orders set status = 'requires_review', stripe_payment_intent_id = p_payment_intent_id,
      paid_at = now()
    where id = p_order_id;
    return 'requires_review';
  end if;

  update public.orders
  set status = 'paid',
      paid_at = now(),
      stripe_checkout_session_id = p_session_id,
      stripe_payment_intent_id = p_payment_intent_id
  where id = p_order_id;

  update public.products p
  set sales_count = p.sales_count + s.quantity
  from (
    select product_id, sum(quantity)::integer as quantity
    from public.order_items where order_id = p_order_id and product_id is not null
    group by product_id
  ) s
  where p.id = s.product_id;

  if v_order.promotion_id is not null then
    update public.promotions set times_redeemed = times_redeemed + 1 where id = v_order.promotion_id;
  end if;

  insert into public.order_events (order_id, kind, message, data)
  values (p_order_id, 'paid', 'Pago confirmado por Stripe',
          jsonb_build_object('payment_intent', p_payment_intent_id, 'amount', p_amount_total));

  return 'paid';
end;
$$;

-- Cancela o caduca un pedido pendiente y devuelve su stock. Idempotente.
create or replace function public.release_order(p_order_id uuid, p_status text, p_reason text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  if p_status not in ('cancelled', 'expired') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if v_order.status <> 'pending' then
    return v_order.status;
  end if;

  perform set_config('app.stock_reason', 'release', true);
  perform set_config('app.order_id', p_order_id::text, true);

  if not v_order.stock_released then
    for v_item in
      select variant_id, sum(quantity)::integer as quantity
      from public.order_items
      where order_id = p_order_id and variant_id is not null
      group by variant_id
      order by variant_id
    loop
      update public.product_variants set stock = stock + v_item.quantity where id = v_item.variant_id;
    end loop;
  end if;

  update public.orders
  set status = p_status, stock_released = true, cancelled_at = now()
  where id = p_order_id;

  insert into public.order_events (order_id, kind, message)
  values (p_order_id, p_status,
          coalesce(p_reason, case p_status when 'expired' then 'La sesión de pago caducó' else 'Pedido cancelado' end));

  return p_status;
end;
$$;

-- Libera los pedidos pendientes cuya reserva ha caducado. Pensada para
-- ejecutarse periódicamente (pg_cron o un cron externo); el webhook
-- checkout.session.expired ya cubre el caso normal.
create or replace function public.expire_stale_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    select id from public.orders
    where status = 'pending' and expires_at < now()
    order by expires_at
    limit 500
  loop
    perform public.release_order(v_id, 'expired', 'Reserva caducada sin pago');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Registra un reembolso notificado por Stripe.
create or replace function public.mark_order_refunded(
  p_payment_intent_id text,
  p_amount_refunded integer,
  p_fully_refunded boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders
  where stripe_payment_intent_id = p_payment_intent_id
  for update;
  if not found then
    return 'not_found';
  end if;

  if p_fully_refunded and v_order.status <> 'refunded' then
    update public.orders set status = 'refunded', refunded_at = now() where id = v_order.id;
  end if;

  insert into public.order_events (order_id, kind, message, data)
  values (v_order.id, 'refund',
          case when p_fully_refunded then 'Reembolso total' else 'Reembolso parcial' end,
          jsonb_build_object('amount_refunded', p_amount_refunded));

  return case when p_fully_refunded then 'refunded' else 'partially_refunded' end;
end;
$$;

-- Ajuste manual de stock desde el panel. Comprueba que quien llama es admin.
create or replace function public.admin_set_stock(p_variant_id uuid, p_stock integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_stock < 0 or p_stock > 1000000 then
    raise exception 'invalid_stock' using errcode = 'P0001';
  end if;
  perform set_config('app.stock_reason', 'manual', true);
  update public.product_variants set stock = p_stock where id = p_variant_id;
  return p_stock;
end;
$$;

-- Cifras del panel. security invoker: las RLS de admin hacen el resto.
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'revenue_total_cents', coalesce((select sum(total_cents) from public.orders where status = 'paid'), 0),
    'revenue_30d_cents', coalesce((select sum(total_cents) from public.orders
                                    where status = 'paid' and paid_at > now() - interval '30 days'), 0),
    'orders_paid', (select count(*) from public.orders where status = 'paid'),
    'orders_30d', (select count(*) from public.orders where status = 'paid' and paid_at > now() - interval '30 days'),
    'orders_pending', (select count(*) from public.orders where status = 'pending'),
    'orders_to_ship', (select count(*) from public.orders
                       where status = 'paid' and fulfillment_status in ('unfulfilled', 'preparing')),
    'orders_review', (select count(*) from public.orders where status = 'requires_review'),
    'customers', (select count(*) from public.profiles where role = 'customer'),
    'products_published', (select count(*) from public.products where status = 'published'),
    'low_stock', (select count(*) from public.product_variants v
                  join public.products p on p.id = v.product_id
                  where v.is_active and p.status = 'published' and v.stock <= 5),
    'reviews_pending', (select count(*) from public.reviews where status = 'pending'),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'revenue_cents', d.revenue, 'orders', d.orders) order by d.day)
      from (
        select gs::date as day,
               coalesce(sum(o.total_cents), 0)::integer as revenue,
               count(o.id)::integer as orders
        from generate_series(current_date - 13, current_date, interval '1 day') gs
        left join public.orders o on o.status = 'paid' and o.paid_at::date = gs::date
        group by gs
      ) d
    ), '[]'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(t) from (
        select p.name, p.slug, p.sales_count
        from public.products p
        where p.sales_count > 0
        order by p.sales_count desc
        limit 5
      ) t
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Opiniones: solo quien ha comprado el producto, siempre pendientes de moderar
-- ---------------------------------------------------------------------------

create or replace function public.has_purchased(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.user_id = (select auth.uid())
      and o.status = 'paid'
      and oi.product_id = p_product_id
  );
$$;

create or replace function public.reviews_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.user_id := coalesce((select auth.uid()), new.user_id);
  if not public.is_admin() then
    new.status := 'pending';
  end if;
  new.is_verified := exists (
    select 1
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    where o.user_id = new.user_id and o.status = 'paid' and oi.product_id = new.product_id
  );
  return new;
end;
$$;

create trigger reviews_before_insert
  before insert on public.reviews
  for each row execute function public.reviews_before_insert();
