-- Email que pide opinión unos días después de la entrega.
alter table public.orders
  add column locale text not null default 'es' check (locale in ('es', 'en')),
  add column shipped_at timestamptz,
  add column delivered_at timestamptz,
  add column review_requested_at timestamptz;

-- Fecha de salida y de entrega: se rellenan solas al cambiar el estado del envío.
create or replace function public.stamp_fulfillment_dates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.fulfillment_status in ('shipped', 'delivered') and new.shipped_at is null then
    new.shipped_at := now();
  end if;
  if new.fulfillment_status = 'delivered' and new.delivered_at is null then
    new.delivered_at := now();
  end if;
  return new;
end;
$$;

create trigger orders_stamp_fulfillment
  before update of fulfillment_status on public.orders
  for each row execute function public.stamp_fulfillment_dates();

create index orders_review_request_idx on public.orders (shipped_at)
  where status = 'paid' and review_requested_at is null;
