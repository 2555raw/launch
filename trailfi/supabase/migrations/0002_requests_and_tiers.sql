-- Stepit — payout requests from walkers, and private tiered reward rates.

-- Walkers can now ask to be paid: a payout starts as 'requested' and the
-- owner pays it from the admin console.
alter table payouts drop constraint if exists payouts_status_check;
alter table payouts add constraint payouts_status_check
  check (status in ('requested', 'prepared', 'submitted', 'confirmed', 'failed', 'cancelled'));
alter table payouts add column if not exists requested_at timestamptz;

-- Reward rates. Private: only the admin API exposes them.
--   < tier_min steps                → 0
--   tier_min … tier_threshold        → around tier_avg
--   ≥ tier_threshold                 → a bit more, up to tier_max
alter table platform_settings add column if not exists tier_min integer not null default 1000;
alter table platform_settings add column if not exists tier_avg numeric(12, 2) not null default 4;
alter table platform_settings add column if not exists tier_threshold integer not null default 7000;
alter table platform_settings add column if not exists tier_max numeric(12, 2) not null default 6;
