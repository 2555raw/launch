-- Hambre de Más · esquema principal
--
-- Todos los importes se guardan en céntimos de euro (integer) e incluyen IVA,
-- que es como se muestran los precios al consumidor en España. El tipo de IVA
-- de cada producto se guarda en puntos básicos (1000 = 10 %).
--
-- No se guarda ningún dato de tarjeta: el pago lo procesa Stripe y aquí solo
-- quedan los identificadores de la sesión y del PaymentIntent.

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Perfiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 30),
  role text not null default 'customer' check (role in ('customer', 'admin')),
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.role is
  'customer o admin. Solo se cambia desde SQL o con la service role: los clientes no tienen permiso de escritura sobre esta columna.';

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  tagline text check (char_length(tagline) <= 160),
  description text,
  level smallint check (level between 1 and 9),
  accent text not null default 'chef' check (accent in ('chef', 'teja', 'hoja', 'almendra')),
  image_url text,
  position integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  subtitle text check (char_length(subtitle) <= 200),
  description text not null default '',
  category_id uuid references public.categories (id) on delete set null,
  -- price_cents y compare_at_price_cents se derivan de la variante activa más
  -- barata (trigger sync_product_price) para poder ordenar y filtrar por precio.
  price_cents integer not null default 0 check (price_cents >= 0),
  compare_at_price_cents integer check (compare_at_price_cents is null or compare_at_price_cents > 0),
  tax_rate_bps integer not null default 1000 check (tax_rate_bps between 0 and 10000),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_featured boolean not null default false,
  is_demo boolean not null default false,
  badge text check (char_length(badge) <= 24),
  sales_count integer not null default 0 check (sales_count >= 0),
  -- Características filtrables: { "minutes": 20, "difficulty": 1, "servings": 2, "heat": "sin-fuego" }
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  -- Columnas derivadas para filtrar y ordenar desde la API.
  minutes integer generated always as ((attributes ->> 'minutes')::integer) stored,
  difficulty smallint generated always as ((attributes ->> 'difficulty')::smallint) stored,
  -- Suma del stock de las variantes activas (trigger sync_product_price).
  total_stock integer not null default 0 check (total_stock >= 0),
  -- Información técnica: [{ "label": "Alérgenos", "value": "Gluten, soja" }]
  specs jsonb not null default '[]'::jsonb check (jsonb_typeof(specs) = 'array'),
  -- Etiquetas de dieta y estilo: vegetariano, vegano, sin-gluten, picante...
  tags text[] not null default '{}',
  includes text[] not null default '{}',
  search_text text not null default '',
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 170),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_idx on public.products (category_id);
create index products_status_idx on public.products (status, published_at desc);
create index products_tags_idx on public.products using gin (tags);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  url text not null check (char_length(url) <= 1000),
  alt text not null default '' check (char_length(alt) <= 200),
  storage_path text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index product_images_product_idx on public.product_images (product_id, position);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique check (char_length(sku) between 1 and 64),
  name text not null check (char_length(name) between 1 and 80),
  -- Stripe no acepta cobros por debajo de 0,50 €.
  price_cents integer not null check (price_cents >= 50 and price_cents <= 1000000),
  compare_at_price_cents integer check (compare_at_price_cents is null or compare_at_price_cents > price_cents),
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_variants_product_idx on public.product_variants (product_id, position);

-- Registro de todos los movimientos de inventario (lo rellena un trigger).
create table public.inventory_movements (
  id bigint generated always as identity primary key,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  delta integer not null,
  stock_after integer not null,
  reason text not null check (reason in ('initial', 'manual', 'order', 'release')),
  order_id uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Promociones
-- ---------------------------------------------------------------------------

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,32}$'),
  description text check (char_length(description) <= 200),
  kind text not null check (kind in ('percent', 'fixed')),
  -- percent: 1..100 · fixed: céntimos
  value integer not null check (value > 0),
  min_subtotal_cents integer not null default 0 check (min_subtotal_cents >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  times_redeemed integer not null default 0 check (times_redeemed >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

-- ---------------------------------------------------------------------------
-- Direcciones de envío
-- ---------------------------------------------------------------------------

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text check (char_length(label) <= 40),
  full_name text not null check (char_length(full_name) between 1 and 120),
  phone text check (char_length(phone) <= 30),
  line1 text not null check (char_length(line1) between 1 and 160),
  line2 text check (char_length(line2) <= 160),
  city text not null check (char_length(city) between 1 and 80),
  province text not null check (char_length(province) between 1 and 80),
  postal_code text not null check (postal_code ~ '^[0-9]{5}$'),
  country text not null default 'ES' check (country ~ '^[A-Z]{2}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index addresses_user_idx on public.addresses (user_id);
create unique index addresses_one_default_idx on public.addresses (user_id) where is_default;

-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------

create sequence public.order_number_seq start with 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('public.order_number_seq'),
  user_id uuid references auth.users (id) on delete set null,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  customer_name text not null check (char_length(customer_name) between 1 and 120),
  phone text check (char_length(phone) <= 30),
  shipping_address jsonb not null check (jsonb_typeof(shipping_address) = 'object'),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'cancelled', 'expired', 'refunded', 'requires_review')),
  fulfillment_status text not null default 'unfulfilled'
    check (fulfillment_status in ('unfulfilled', 'preparing', 'shipped', 'delivered', 'returned')),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  total_cents integer not null check (total_cents >= 50),
  currency text not null default 'eur' check (currency = 'eur'),
  promotion_id uuid references public.promotions (id) on delete set null,
  promotion_code text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  -- Cuándo deja de valer la reserva de stock si no se paga.
  expires_at timestamptz not null default (now() + interval '35 minutes'),
  paid_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  stock_released boolean not null default false,
  tracking_carrier text check (char_length(tracking_carrier) <= 60),
  tracking_number text check (char_length(tracking_number) <= 80),
  tracking_url text check (char_length(tracking_url) <= 500),
  admin_notes text check (char_length(admin_notes) <= 2000),
  terms_accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_cents <= subtotal_cents),
  check (total_cents = subtotal_cents - discount_cents + shipping_cents),
  check (tax_cents <= total_cents)
);

create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_pending_expiry_idx on public.orders (expires_at) where status = 'pending';
create index orders_payment_intent_idx on public.orders (stripe_payment_intent_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_name text not null,
  product_slug text,
  variant_name text not null,
  sku text not null,
  image_url text,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity between 1 and 99),
  tax_rate_bps integer not null check (tax_rate_bps between 0 and 10000),
  line_total_cents integer not null,
  check (line_total_cents = unit_price_cents * quantity)
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  kind text not null,
  message text not null,
  data jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index order_events_order_idx on public.order_events (order_id, created_at);

-- Eventos de Stripe ya procesados: evita procesar dos veces el mismo webhook.
create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Opiniones (solo de compradores verificados, moderadas)
-- ---------------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text check (char_length(title) <= 100),
  body text not null check (char_length(body) between 10 and 2000),
  author_name text not null check (char_length(author_name) between 1 and 60),
  is_verified boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create index reviews_product_idx on public.reviews (product_id, status);

-- ---------------------------------------------------------------------------
-- Newsletter
-- ---------------------------------------------------------------------------

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  consent_text text not null,
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);
