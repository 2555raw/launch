-- Encargos de ediciones que todavía no se pueden comprar (p. ej. la caja de
-- Navidad). No se paga nada: se guarda quién la quiere y se le escribe para
-- confirmarla antes del envío. Las altas las hace el servidor; los admin
-- consultan y borran.
create table public.preorders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  quantity integer not null check (quantity between 1 and 10),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  locale text not null default 'es' check (locale in ('es', 'en')),
  created_at timestamptz not null default now(),
  -- Repetir el encargo con el mismo email actualiza la cantidad
  unique (variant_id, email)
);

create index preorders_product_idx on public.preorders (product_id, created_at desc);

revoke all on public.preorders from anon, authenticated;
grant all on public.preorders to service_role;
grant select, delete on public.preorders to authenticated;

alter table public.preorders enable row level security;

create policy "Admin gestiona encargos" on public.preorders
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
