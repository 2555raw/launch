-- Hambre de Más · traducciones del catálogo
--
-- El español sigue en las columnas de siempre (name, subtitle, description…).
-- Las demás lenguas van en `translations`, con la misma forma por idioma:
--
--   products.translations = {
--     "en": {
--       "name": "…", "subtitle": "…", "badge": "…", "description": "…",
--       "includes": ["…"], "specs": [{ "label": "…", "value": "…" }],
--       "recipe": { "youAdd": ["…"], "steps": [{ "title": "…", "text": "…" }], "tips": ["…"] },
--       "variants": { "SKU": "nombre de la variante" },
--       "imageAlts": ["…"], "seoTitle": "…", "seoDescription": "…"
--     }
--   }
--   categories.translations = { "en": { "name": "…", "tagline": "…", "description": "…" } }
--
-- Lo que falte en un idioma se muestra en español.

alter table public.products
  add column translations jsonb not null default '{}'::jsonb
    check (jsonb_typeof(translations) = 'object');

alter table public.categories
  add column translations jsonb not null default '{}'::jsonb
    check (jsonb_typeof(translations) = 'object');

comment on column public.products.translations is 'Textos traducidos por idioma (p. ej. {"en": {"name": …}}). Ver migración 20261028000100.';
comment on column public.categories.translations is 'Textos traducidos por idioma (p. ej. {"en": {"name": …}}).';

-- La búsqueda también encuentra los productos por su nombre en inglés.
create or replace function public.products_search_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_text := lower(extensions.unaccent(
    'extensions.unaccent'::regdictionary,
    concat_ws(' ', new.name, new.subtitle, new.description, array_to_string(new.tags, ' '),
      new.translations -> 'en' ->> 'name', new.translations -> 'en' ->> 'subtitle', new.translations -> 'en' ->> 'description')
  ));
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger products_search_text on public.products;
create trigger products_search_text
  before insert or update of name, subtitle, description, tags, status, translations on public.products
  for each row execute function public.products_search_text();
