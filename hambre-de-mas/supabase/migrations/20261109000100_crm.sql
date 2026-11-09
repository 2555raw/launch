-- CRM: notas, tareas de seguimiento y etiquetas de cada cliente.
-- Un cliente es un email (con o sin cuenta: los invitados también cuentan).
-- Solo los administradores pueden ver y editar nada de esto.

create table public.crm_notes (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  body text not null check (char_length(body) between 1 and 2000),
  author text not null check (char_length(author) between 1 and 120),
  created_at timestamptz not null default now()
);
create index crm_notes_email_idx on public.crm_notes (email, created_at desc);

create table public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  title text not null check (char_length(title) between 1 and 200),
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index crm_tasks_open_idx on public.crm_tasks (done, due_date);

create table public.crm_tags (
  email text not null check (email = lower(email) and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  tag text not null check (char_length(tag) between 1 and 40),
  created_at timestamptz not null default now(),
  primary key (email, tag)
);

revoke all on public.crm_notes, public.crm_tasks, public.crm_tags from anon, authenticated;
grant all on public.crm_notes, public.crm_tasks, public.crm_tags to service_role;
grant select, insert, delete on public.crm_notes, public.crm_tags to authenticated;
grant select, insert, update, delete on public.crm_tasks to authenticated;

alter table public.crm_notes enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.crm_tags enable row level security;

create policy "Admin gestiona notas CRM" on public.crm_notes
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admin gestiona tareas CRM" on public.crm_tasks
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admin gestiona etiquetas CRM" on public.crm_tags
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
