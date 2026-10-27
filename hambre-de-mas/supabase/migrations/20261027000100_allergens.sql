-- Hambre de Más · alérgenos
--
-- Los 14 alérgenos de declaración obligatoria del Reglamento (UE) 1169/2011
-- (anexo II). Cada producto guarda tres listas:
--   allergens         lo que CONTIENE el kit que enviamos
--   allergen_traces   lo que PUEDE CONTENER (trazas, contaminación cruzada)
--   recipe_allergens  lo que añade la receta con los ingredientes frescos que pone el cliente

create or replace function public.valid_allergens(list text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select list <@ array[
    'gluten', 'crustaceos', 'huevos', 'pescado', 'cacahuetes', 'soja', 'leche',
    'frutos-de-cascara', 'apio', 'mostaza', 'sesamo', 'sulfitos', 'altramuces', 'moluscos'
  ]::text[];
$$;

alter table public.products
  add column allergens text[] not null default '{}' check (public.valid_allergens(allergens)),
  add column allergen_traces text[] not null default '{}' check (public.valid_allergens(allergen_traces)),
  add column recipe_allergens text[] not null default '{}' check (public.valid_allergens(recipe_allergens));

comment on column public.products.allergens is 'Alérgenos que contiene el kit (Reglamento UE 1169/2011).';
comment on column public.products.allergen_traces is 'Alérgenos que el kit puede contener en trazas.';
comment on column public.products.recipe_allergens is 'Alérgenos que añade la receta con los ingredientes frescos que pone el cliente.';

create index products_allergens_idx on public.products using gin (allergens);

grant execute on function public.valid_allergens(text[]) to anon, authenticated, service_role;
