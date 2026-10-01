-- Emails left in the footer newsletter form. Only the server reads them.
create table if not exists newsletter_subscribers (
  email       text primary key,
  created_at  timestamptz not null default now()
);
alter table newsletter_subscribers enable row level security;
