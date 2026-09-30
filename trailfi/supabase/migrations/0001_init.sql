-- TrailFi — initial schema.
--
-- Runs unchanged on Supabase (Postgres 15+) and on the embedded PGlite database
-- used for local demos. Every table has row level security switched on and no
-- policies, so the public `anon` / `authenticated` Supabase keys can read and
-- write nothing: all access goes through the Next.js API, which connects with
-- the database owner role from DATABASE_URL on the server only.

-- gen_random_uuid() is built into Postgres 13+, so no extension is needed.

-- ---------------------------------------------------------------------------
-- Users: one row per public wallet address. No private keys, seed phrases or
-- wallet credentials are ever stored — only the public address.
-- ---------------------------------------------------------------------------
create table if not exists users (
  id                uuid primary key default gen_random_uuid(),
  short_id          serial unique,
  wallet_address    text not null unique check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  role              text not null default 'user' check (role in ('user', 'admin')),
  status            text not null default 'active' check (status in ('active', 'suspended')),
  payout_consent_at timestamptz,
  created_at        timestamptz not null default now(),
  last_login_at     timestamptz
);

-- ---------------------------------------------------------------------------
-- Step history. One entry per user, day and source. Entries submitted from the
-- browser are never created as `verified`; only signed provider ingestion or a
-- manual admin review can verify them.
-- ---------------------------------------------------------------------------
create table if not exists step_entries (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  day             date not null,
  steps           integer not null check (steps >= 0 and steps <= 100000),
  source          text not null check (source in ('manual_demo', 'apple_health', 'health_connect', 'fitness_api')),
  verification    text not null default 'unverified'
                    check (verification in ('unverified', 'verified', 'flagged', 'rejected')),
  flags           text[] not null default '{}',
  external_id     text,
  payload_hash    text,
  reviewed_by     text,
  reviewed_at     timestamptz,
  review_note     text,
  created_at      timestamptz not null default now(),
  unique (user_id, day, source)
);
create unique index if not exists step_entries_external_uq on step_entries (source, external_id) where external_id is not null;
create index if not exists step_entries_day_idx on step_entries (day);
create index if not exists step_entries_user_day_idx on step_entries (user_id, day desc);

-- ---------------------------------------------------------------------------
-- Platform settings: a single row (id = 1) that the admin panel edits, plus a
-- history table with every previous version.
-- ---------------------------------------------------------------------------
create table if not exists platform_settings (
  id                      integer primary key default 1 check (id = 1),
  reward_percent          numeric(5, 2) not null default 30 check (reward_percent >= 0 and reward_percent <= 100),
  daily_step_goal         integer not null default 10000 check (daily_step_goal between 1000 and 100000),
  max_reward_per_user     numeric(24, 6) not null default 25 check (max_reward_per_user >= 0),
  step_cap_multiplier     numeric(4, 2) not null default 2 check (step_cap_multiplier >= 1 and step_cap_multiplier <= 10),
  distribution_frequency  text not null default 'daily' check (distribution_frequency in ('daily', 'weekly')),
  payout_token_symbol     text not null default 'USDC',
  payout_token_address    text not null default '0x036cbd53842c5426634e7929541ec2318f3dcf7e',
  payout_token_decimals   integer not null default 6 check (payout_token_decimals between 0 and 36),
  estimated_daily_fees    numeric(24, 6) not null default 100 check (estimated_daily_fees >= 0),
  redistribute_excess     boolean not null default true,
  updated_by              text,
  updated_at              timestamptz not null default now()
);
insert into platform_settings (id) values (1) on conflict (id) do nothing;

create table if not exists settings_history (
  id          bigserial primary key,
  snapshot    jsonb not null,
  changed_by  text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Distributions: one run of the reward engine over a period, with a snapshot
-- of the configuration it used, so later settings changes never rewrite it.
-- ---------------------------------------------------------------------------
create table if not exists distributions (
  id                uuid primary key default gen_random_uuid(),
  period_start      date not null,
  period_end        date not null,
  eligible_fees     numeric(24, 6) not null check (eligible_fees >= 0),
  reward_percent    numeric(5, 2) not null,
  pool_amount       numeric(24, 6) not null,
  total_allocated   numeric(24, 6) not null,
  participants      integer not null,
  config            jsonb not null,
  token_symbol      text not null,
  created_by        text not null,
  created_at        timestamptz not null default now(),
  check (period_end >= period_start)
);
create index if not exists distributions_period_idx on distributions (period_start, period_end);

-- ---------------------------------------------------------------------------
-- Rewards: a user's allocation inside a distribution. Admin approval is
-- required before a reward can be included in a payout.
-- ---------------------------------------------------------------------------
create table if not exists rewards (
  id               uuid primary key default gen_random_uuid(),
  distribution_id  uuid not null references distributions(id) on delete cascade,
  user_id          uuid not null references users(id) on delete cascade,
  period_start     date not null,
  period_end       date not null,
  valid_steps      integer not null,
  eligible_days    integer not null,
  weight           numeric(24, 6) not null,
  amount           numeric(24, 6) not null check (amount >= 0),
  capped           boolean not null default false,
  token_symbol     text not null,
  status           text not null default 'pending'
                     check (status in ('pending', 'approved', 'rejected', 'processing', 'paid')),
  reviewed_by      text,
  reviewed_at      timestamptz,
  rejection_reason text,
  payout_id        uuid,
  created_at       timestamptz not null default now(),
  unique (distribution_id, user_id)
);
create index if not exists rewards_user_idx on rewards (user_id, status);
create index if not exists rewards_status_idx on rewards (status);

-- ---------------------------------------------------------------------------
-- Payouts: an admin-prepared transfer to a user's wallet. Nothing is sent by
-- the server: the transfer is signed by an authorised payout wallet in the
-- admin's browser, and the server then verifies the transaction on-chain.
-- ---------------------------------------------------------------------------
create table if not exists payouts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete restrict,
  wallet_address  text not null,
  amount          numeric(24, 6) not null check (amount > 0),
  token_symbol    text not null,
  token_address   text not null,
  token_decimals  integer not null,
  chain_id        integer not null,
  status          text not null default 'prepared'
                    check (status in ('prepared', 'submitted', 'confirmed', 'failed', 'cancelled')),
  simulated       boolean not null default false,
  tx_hash         text unique,
  from_address    text,
  gas_used        text,
  error           text,
  prepared_by     text not null,
  created_at      timestamptz not null default now(),
  submitted_at    timestamptz,
  confirmed_at    timestamptz
);
create index if not exists payouts_user_idx on payouts (user_id, created_at desc);
create index if not exists payouts_status_idx on payouts (status);

alter table rewards drop constraint if exists rewards_payout_fk;
alter table rewards add constraint rewards_payout_fk foreign key (payout_id) references payouts(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Audit log of every admin action and every sign-in.
-- ---------------------------------------------------------------------------
create table if not exists audit_log (
  id          bigserial primary key,
  actor       text not null,
  action      text not null,
  entity      text,
  entity_id   text,
  details     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_created_idx on audit_log (created_at desc);

-- Lock the tables away from Supabase's public API roles.
alter table users             enable row level security;
alter table step_entries      enable row level security;
alter table platform_settings enable row level security;
alter table settings_history  enable row level security;
alter table distributions     enable row level security;
alter table rewards           enable row level security;
alter table payouts           enable row level security;
alter table audit_log         enable row level security;
