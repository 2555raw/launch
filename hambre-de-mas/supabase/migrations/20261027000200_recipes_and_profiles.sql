-- Hambre de Más · recetas y perfil ampliado
--
-- Cada producto guarda su receta (la que abre el QR de la tarjeta):
--   { "youAdd": ["agua"], "steps": [{ "title": "…", "text": "…" }], "tips": ["…"] }
-- y el perfil del cliente recoge los datos del registro ampliado.

alter table public.products
  add column recipe jsonb not null default '{}'::jsonb
    check (jsonb_typeof(recipe) = 'object');

comment on column public.products.recipe is
  'Receta paso a paso que abre el QR del kit: youAdd (texto[]), steps ({title,text}[]), tips (texto[]).';

alter table public.profiles
  add column birth_date date check (birth_date is null or (birth_date > date '1900-01-01' and birth_date <= current_date)),
  add column guardian_consent_at timestamptz,
  add column cooking_level smallint check (cooking_level is null or cooking_level between 1 and 3),
  add column avoid_allergens text[] not null default '{}' check (public.valid_allergens(avoid_allergens));

comment on column public.profiles.guardian_consent_at is
  'Cuándo se declaró el permiso de la madre, padre o tutor (obligatorio por debajo de 14 años, art. 7 LOPDGDD).';

-- El cliente puede editar estos datos de su perfil (nunca el rol).
grant update (birth_date, cooking_level, avoid_allergens) on public.profiles to authenticated;

-- El alta copia los datos que llegan en los metadatos del registro.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_birth date;
  v_level smallint;
  v_avoid text[];
begin
  begin
    v_birth := nullif(meta ->> 'birth_date', '')::date;
    if v_birth is not null and (v_birth <= date '1900-01-01' or v_birth > current_date) then
      v_birth := null;
    end if;
  exception when others then
    v_birth := null;
  end;

  v_level := case when meta ->> 'cooking_level' in ('1', '2', '3') then (meta ->> 'cooking_level')::smallint end;

  select coalesce(array_agg(a), '{}') into v_avoid
  from jsonb_array_elements_text(case when jsonb_typeof(meta -> 'avoid_allergens') = 'array' then meta -> 'avoid_allergens' else '[]'::jsonb end) as a
  where public.valid_allergens(array[a]);

  insert into public.profiles (id, email, full_name, phone, birth_date, guardian_consent_at, cooking_level, avoid_allergens, marketing_opt_in)
  values (
    new.id,
    new.email,
    nullif(left(coalesce(meta ->> 'full_name', ''), 120), ''),
    nullif(left(coalesce(meta ->> 'phone', ''), 30), ''),
    v_birth,
    case when (meta ->> 'guardian_consent') = 'true' then now() end,
    v_level,
    v_avoid,
    coalesce((meta ->> 'marketing_opt_in') = 'true', false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
