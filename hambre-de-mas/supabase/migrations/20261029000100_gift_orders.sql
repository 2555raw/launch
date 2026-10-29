-- Pedidos para regalar: se envían sin precios y con un mensaje en la tarjeta.
alter table public.orders
  add column is_gift boolean not null default false,
  add column gift_message text check (char_length(gift_message) <= 300);

comment on column public.orders.is_gift is 'Regalo: el paquete va sin precios ni factura impresa.';
comment on column public.orders.gift_message is 'Mensaje para la tarjeta de regalo (opcional).';
