-- Daily step reminders sent as browser / app notifications. Each device that opted in
-- stores its push subscription and timezone; reminders go out in the evening, local
-- time, only on days the walker hasn't uploaded yet.
create table if not exists push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  timezone      text not null default 'UTC',
  remind_hour   integer not null default 19 check (remind_hour between 0 and 23),
  last_sent_day date,
  created_at    timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

-- Keys that sign push messages (VAPID). Generated once by the server and kept here.
create table if not exists app_keys (
  name        text primary key,
  public_key  text not null,
  private_key text not null,
  created_at  timestamptz not null default now()
);
